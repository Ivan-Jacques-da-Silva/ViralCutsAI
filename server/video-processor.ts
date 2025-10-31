import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";

const execFileAsync = promisify(execFile);

function resolveFFmpeg(): string {
  const envPath = process.env.FFMPEG_PATH;
  const candidates: string[] = [];
  if (envPath) candidates.push(envPath);
  candidates.push(
    "C:/ProgramData/chocolatey/bin/ffmpeg.exe",
    "C:/ffmpeg/bin/ffmpeg.exe",
    "C:/Program Files/ffmpeg/bin/ffmpeg.exe",
    "C:/Program Files (x86)/ffmpeg/bin/ffmpeg.exe",
    "ffmpeg"
  );
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return "ffmpeg";
}

export async function cutVideo(
  inputPath: string,
  startTime: number,
  endTime: number,
  format: "horizontal" | "vertical",
  outputDir: string
): Promise<string> {
  try {
    const timestamp = Date.now();
    const outputFilename = `cut_${timestamp}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    const args: string[] = [
      "-i", inputPath,
      "-ss", startTime.toString(),
      "-to", endTime.toString(),
    ];

    if (format === "vertical") {
      args.push(
        // garanta que o áudio seja mantido se existir
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-vf", "crop=ih*9/16:ih,scale=1080:1920",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        outputPath
      );
    } else {
      args.push(
        // garanta que o áudio seja mantido se existir
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        outputPath
      );
    }

    await execFileAsync(resolveFFmpeg(), args, {
      timeout: 300000,
      maxBuffer: 50 * 1024 * 1024,
    });

    if (!fs.existsSync(outputPath)) {
      throw new Error("Vídeo cortado não foi criado");
    }

    return outputPath;
  } catch (error: any) {
    console.error("Erro ao cortar vídeo:", error);
    if (error.message?.includes('não é reconhecido') || error.message?.includes('not found')) {
      throw new Error("FFmpeg não está instalado. Por favor, instale FFmpeg: https://ffmpeg.org/download.html");
    }
    throw new Error(`Falha ao cortar vídeo: ${error.message}`);
  }
}

export async function addSubtitlesToVideo(
  videoPath: string,
  subtitlesContent: string,
  outputDir: string
): Promise<string> {
  try {
    if (!subtitlesContent || subtitlesContent.trim() === "") {
      return videoPath;
    }

    const timestamp = Date.now();
    const srtFilename = `subtitles_${timestamp}.srt`;
    const srtPath = path.join(outputDir, srtFilename);

    fs.writeFileSync(srtPath, subtitlesContent, "utf-8");

    const outputFilename = `with_subtitles_${timestamp}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    // Build filter using only the SRT filename and run ffmpeg with cwd=outputDir to avoid Windows drive colon issues
    const subtitlesFilter = `subtitles=filename='${srtFilename}':force_style='FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3,Outline=2,Shadow=0,BackColour=&H00000000'`;

    const args: string[] = [
      "-i", videoPath,
      // mantenha o primeiro vídeo e o primeiro áudio (se existir)
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-vf", subtitlesFilter,
      "-c:a", "copy",
      outputPath
    ];

    await execFileAsync(resolveFFmpeg(), args, {
      timeout: 300000,
      maxBuffer: 50 * 1024 * 1024,
      cwd: outputDir,
    });

    if (fs.existsSync(videoPath) && videoPath !== outputPath) {
      fs.unlinkSync(videoPath);
    }

    if (fs.existsSync(srtPath)) {
      fs.unlinkSync(srtPath);
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error("Vídeo com legendas não foi criado");
    }

    return outputPath;
  } catch (error: any) {
    console.error("Erro ao adicionar legendas:", error);
    if (error.message?.includes('não é reconhecido') || error.message?.includes('not found')) {
      throw new Error("FFmpeg não está instalado. Por favor, instale FFmpeg: https://ffmpeg.org/download.html");
    }
    throw new Error(`Falha ao adicionar legendas: ${error.message}`);
  }
}
