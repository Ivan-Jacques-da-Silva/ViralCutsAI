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

    // Validar tempos e calcular duração
    if (!fs.existsSync(inputPath)) {
      throw new Error("Arquivo de vídeo não encontrado");
    }
    const clipDuration = Math.max(0, endTime - startTime);
    if (clipDuration <= 0) {
      throw new Error("Intervalo de corte inválido (fim deve ser maior que início)");
    }

    const args: string[] = [
      "-y",
      "-ss", startTime.toString(),
      "-t", clipDuration.toString(),
      "-i", inputPath,
      "-map", "0:v:0",
      "-map", "0:a:0?",
    ];

    if (format === "vertical") {
      args.push(
        "-vf", "crop=ih*9/16:ih,scale=1080:1920",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-shortest",
        outputPath
      );
    } else {
      args.push(
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        "-shortest",
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
    const useAss = subtitlesContent.trim().startsWith("[Script Info]");
    const subExt = useAss ? ".ass" : ".srt";
    const srtFilename = `subtitles_${timestamp}${subExt}`;
    const srtPath = path.join(outputDir, srtFilename);

    fs.writeFileSync(srtPath, subtitlesContent, "utf-8");
    try {
      const preview = subtitlesContent.split(/\r?\n/).slice(0, 6).join("\\n");
      console.log(`[subtitles] SUB written: ${srtPath} length=${subtitlesContent.length} preview="${preview}"`);
    } catch {}
    if (!fs.existsSync(srtPath) || (fs.statSync(srtPath).size === 0)) {
      throw new Error("Falha ao criar arquivo de legendas");
    }

    const outputFilename = `with_subtitles_${timestamp}.mp4`;
    const outputPath = path.join(outputDir, outputFilename);

    // Forma compatível no Windows: usar barras normais e citar o caminho
    const srtPathForFilter = srtPath.replace(/\\/g, "/");
    const escapedForFilter = srtPathForFilter
      .replace(/:/g, "\\:")
      .replace(/'/g, "\\'")
      .replace(/,/g, "\\,");
    const forceStyle = useAss ? "" : ":force_style='FontName=Arial,FontSize=28,PrimaryColour=&H00FFFFFF,OutlineColour=&H000000,BorderStyle=3,Outline=2,Shadow=0,BackColour=&H00000000'";
    const subtitlesFilter = `subtitles=filename='${escapedForFilter}':charenc=UTF-8${forceStyle}`;

    const args: string[] = [
      "-y",
      "-i", videoPath,
      "-map", "0:v:0",
      "-map", "0:a:0?",
      "-vf", subtitlesFilter,
      "-c:v", "libx264",
      "-preset", "fast",
      "-crf", "23",
      // reencode audio to ensure compatibility and avoid copy issues
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "-shortest",
      outputPath
    ];

    await execFileAsync(resolveFFmpeg(), args, {
      timeout: 300000,
      maxBuffer: 50 * 1024 * 1024,
    });

    // Limpar arquivos temporários
    if (fs.existsSync(videoPath) && videoPath !== outputPath) {
      fs.unlinkSync(videoPath);
    }

    if (fs.existsSync(srtPath) && process.env.KEEP_SRT !== '1') {
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