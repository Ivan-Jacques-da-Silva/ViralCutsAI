import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execAsync = promisify(exec);

const SUPPORTED_PLATFORMS = [
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "instagram.com",
  "facebook.com",
  "twitter.com",
  "x.com",
  "vimeo.com",
];

export function isSocialMediaUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();

    return SUPPORTED_PLATFORMS.some((platform) => {
      return (
        hostname === platform ||
        hostname === `www.${platform}` ||
        hostname.endsWith(`.${platform}`)
      );
    });
  } catch {
    return false;
  }
}

export async function downloadVideoFromPlatform(
  url: string,
  outputDir: string,
  maxSizeBytes: number = 100 * 1024 * 1024
): Promise<string> {
  const timestamp = Date.now();
  const outputTemplate = path.join(outputDir, `${timestamp}-%(title)s.%(ext)s`);

  try {
    // Try multiple strategies to maximize compatibility across platforms/videos.
    const commands: string[] = [
      // Prefer MP4 when available.
      `yt-dlp --restrict-filenames -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]" --merge-output-format mp4 --print after_move:filepath -o "${outputTemplate}" "${url}"`,
      // Fallback to best available streams (any ext), merge to MKV for broad codec/container support.
      `yt-dlp --restrict-filenames -f "bv*+ba/b" --merge-output-format mkv --print after_move:filepath -o "${outputTemplate}" "${url}"`,
      // Last resort: best single file without forcing a merge.
      `yt-dlp --restrict-filenames -f "best" --print after_move:filepath -o "${outputTemplate}" "${url}"`,
    ];

    let absolutePath: string | undefined;
    let lastError: any;

    for (const command of commands) {
      try {
        const { stdout } = await execAsync(command, {
          timeout: 180000,
          maxBuffer: 10 * 1024 * 1024,
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        });

        const downloadedFilename = stdout
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .pop();
        if (!downloadedFilename) {
          throw new Error("Não foi possível determinar o arquivo baixado");
        }

        absolutePath = path.isAbsolute(downloadedFilename)
          ? downloadedFilename
          : path.join(outputDir, downloadedFilename);

        if (fs.existsSync(absolutePath)) {
          break;
        }
        // Fallback: search by timestamped prefix in outputDir (handles encoding quirks)
        const prefix = `${timestamp}-`;
        const candidates = fs
          .readdirSync(outputDir)
          .filter((name) => name.startsWith(prefix))
          .map((name) => path.join(outputDir, name))
          .filter((p) => fs.existsSync(p));

        if (candidates.length > 0) {
          candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
          absolutePath = candidates[0];
          break;
        }

        throw new Error(`Arquivo não encontrado após download: ${absolutePath}`);
      } catch (err) {
        lastError = err;
        // Continue to next strategy
      }
    }

    if (!absolutePath) {
      throw lastError || new Error("Falha ao baixar o vídeo com os formatos disponíveis");
    }

    const stats = fs.statSync(absolutePath);
    if (stats.size > maxSizeBytes) {
      fs.unlinkSync(absolutePath);
      throw new Error(
        `Vídeo muito grande (${(stats.size / 1024 / 1024).toFixed(2)}MB). Máximo permitido: ${
          maxSizeBytes / 1024 / 1024
        }MB`
      );
    }

    return absolutePath;
  } catch (error: any) {
    console.error("Erro ao baixar vídeo:", error);
    throw new Error(`Falha ao baixar vídeo: ${error.message}`);
  }
}
