import * as fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import { exec } from "child_process";
import { execFile as execFileCb } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFileCb);
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

interface VideoCutSegment {
  startTime: number;
  endTime: number;
  description: string;
}

function resolveBinary(bin: "ffprobe" | "ffmpeg"): string {
  const envPath = bin === "ffprobe" ? process.env.FFPROBE_PATH : process.env.FFMPEG_PATH;
  const candidates: string[] = [];
  if (envPath) candidates.push(envPath);
  // Common Windows installs
  candidates.push(
    `C:/ProgramData/chocolatey/bin/${bin}.exe`,
    `C:/ProgramData/chocolatey/lib/ffmpeg/tools/ffmpeg/bin/${bin}.exe`,
    `C:/ffmpeg/bin/${bin}.exe`,
    `C:/Program Files/ffmpeg/bin/${bin}.exe`,
    `C:/Program Files (x86)/ffmpeg/bin/${bin}.exe`
  );
  // Use plain name last (PATH)
  candidates.push(bin);
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {}
  }
  return bin;
}

// Fallback duration getter using execFile for reliable ENOENT detection
async function getVideoDurationFixed(videoPath: string): Promise<number> {
  try {
    const ffprobeBin = resolveBinary("ffprobe");
    const { stdout } = await execFileAsync(ffprobeBin, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);
    const duration = parseFloat(String(stdout).trim());
    if (isNaN(duration)) {
      throw new Error("Duração inválida");
    }
    return duration;
  } catch (error: any) {
    const msg = String(error?.message || "").toLowerCase();
    if (error?.code === 'ENOENT' || msg.includes('not found') || msg.includes('is not recognized') || msg.includes('not recognized')) {
      throw new Error("FFmpeg/ffprobe não foi encontrado no PATH. Defina FFPROBE_PATH/FFMPEG_PATH ou instale o FFmpeg: https://ffmpeg.org/download.html");
    }
    throw new Error("Não foi possível obter a duração do vídeo");
  }
}

async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    const duration = parseFloat(stdout.trim());
    if (isNaN(duration)) {
      throw new Error("Duração inválida");
    }
    return duration;
  } catch (error: any) {
    console.error("Erro ao obter duração do vídeo:", error);

    if (error.message?.includes('não é reconhecido') || error.message?.includes('not found')) {
      throw new Error("FFmpeg não está instalado. Por favor, instale FFmpeg em seu sistema: https://ffmpeg.org/download.html");
    }

    throw new Error("Não foi possível obter a duração do vídeo");
  }
}

export async function analyzeVideoForCuts(
  videoPath: string
): Promise<{ startTime: number; endTime: number; description: string }[]> {
  try {
    let duration: number;
    try {
      duration = await getVideoDurationFixed(videoPath);
    } catch (durationError: any) {
      console.error("Erro ao obter duração:", durationError);
      throw new Error(`Falha ao obter duração do vídeo: ${durationError.message}`);
    }

    const videoBytes = fs.readFileSync(videoPath);
    const ext = path.extname(videoPath).toLowerCase();
    const mimeType =
      ext === ".webm"
        ? "video/webm"
        : ext === ".mkv"
        ? "video/x-matroska"
        : "video/mp4";

    const contents = [
      {
        inlineData: {
          data: videoBytes.toString("base64"),
          mimeType,
        },
      },
      `Analise este vídeo completo que tem ${duration} segundos de duração.

Identifique os melhores momentos para criar cortes para Reels/Stories, seguindo estas regras OBRIGATÓRIAS:
- Cada corte deve ter entre 60 e 120 segundos (1-2 minutos)
- NÃO crie cortes abruptos no meio de uma frase ou ação
- Identifique momentos naturais de início e fim (início de nova cena, nova fala, novo tópico)
- Priorize segmentos com conteúdo interessante e engajador
- Evite momentos de silêncio ou transição no início/fim dos cortes

Retorne sua resposta EXATAMENTE neste formato JSON (sem texto adicional):
[
  {
    "startTime": tempo_inicial_em_segundos,
    "endTime": tempo_final_em_segundos,
    "description": "Descrição breve do que acontece neste segmento"
  }
]

IMPORTANTE: O tempo deve ser em segundos inteiros. Cada corte deve ter duração mínima de 60s e máxima de 120s.`,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: contents,
    });

    const responseText = response.text || "";

    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("IA não retornou formato válido");
    }

    const cuts: VideoCutSegment[] = JSON.parse(jsonMatch[0]);

    const validCuts = cuts.filter(cut => {
      const cutDuration = cut.endTime - cut.startTime;
      return cutDuration >= 60 && cutDuration <= 120 && cut.endTime <= duration;
    });

    if (validCuts.length === 0) {
      const numCuts = Math.floor(duration / 90);
      const fallbackCuts: VideoCutSegment[] = [];
      for (let i = 0; i < numCuts; i++) {
        const start = i * 90;
        const end = Math.min(start + 90, duration);
        if (end - start >= 60) {
          fallbackCuts.push({
            startTime: start,
            endTime: end,
            description: `Segmento ${i + 1} do vídeo`,
          });
        }
      }
      return fallbackCuts;
    }

    return validCuts;
  } catch (error: any) {
    console.error("Erro ao analisar vídeo:", error);
    throw new Error(`Falha ao analisar vídeo para cortes: ${error.message}`);
  }
}

export async function generateSubtitles(videoPath: string, startTime: number, endTime: number): Promise<string> {
  try {
    const videoBytes = fs.readFileSync(videoPath);
    const ext = path.extname(videoPath).toLowerCase();
    const mimeType =
      ext === ".webm"
        ? "video/webm"
        : ext === ".mkv"
        ? "video/x-matroska"
        : "video/mp4";

    const contents = [
      {
        inlineData: {
          data: videoBytes.toString("base64"),
          mimeType,
        },
      },
      `Analise este vídeo do segundo ${startTime} até o segundo ${endTime}.

Extraia TODAS as falas e crie legendas no formato SRT (SubRip).

Formato SRT esperado:
1
00:00:00,000 --> 00:00:02,500
Primeira fala

2
00:00:02,500 --> 00:00:05,000
Segunda fala

Regras:
- Use timestamps relativos (começando de 00:00:00)
- Quebre as legendas em partes de até 2 linhas e 42 caracteres por linha
- Sincronize com as falas do vídeo
- Se não houver falas, retorne "SEM_FALAS"

Retorne APENAS o conteúdo SRT, sem explicações.`,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: contents,
    });

    const subtitles = response.text || "";

    if (subtitles.includes("SEM_FALAS")) {
      return "";
    }

    return subtitles.trim();
  } catch (error: any) {
    console.error("Erro ao gerar legendas:", error);
    return "";
  }
}
