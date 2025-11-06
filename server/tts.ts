import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

function resolvePiper(): string {
  const envPath = process.env.PIPER_PATH;
  const candidates: string[] = [];
  if (envPath) candidates.push(envPath);
  // Common Windows locations
  candidates.push(
    "C:/ProgramData/chocolatey/bin/piper.exe",
    "C:/piper/piper.exe",
    "C:/Program Files/piper/piper.exe",
    "C:/Program Files (x86)/piper/piper.exe",
    "piper"
  );
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return "piper";
}

export interface TTSOptions {
  text: string;
  voiceModelPath?: string; // path to .onnx/.onnx.json model for Piper
  sampleRate?: number; // e.g., 22050
  outDir: string;
}

export interface TTSResult {
  audioPath: string;
  durationSec: number;
}

export async function synthesizeWithPiper(opts: TTSOptions): Promise<TTSResult> {
  const text = (opts.text || "").trim();
  if (!text) throw new Error("Texto vazio para TTS");

  const model = opts.voiceModelPath || process.env.PIPER_MODEL || "";
  if (!model || !fs.existsSync(model)) {
    throw new Error("Modelo Piper não encontrado. Defina PIPER_MODEL com o caminho do modelo PT-BR.");
  }
  if (!fs.existsSync(opts.outDir)) fs.mkdirSync(opts.outDir, { recursive: true });

  const ts = Date.now();
  const wavPath = path.join(opts.outDir, `tts_${ts}.wav`);

  // Piper CLI: piper -m model -f out.wav -t "texto" -s <sampleRate>
  const args: string[] = [
    "-m", model,
    "-f", wavPath,
    "-t", text,
  ];
  if (opts.sampleRate) {
    args.push("-s", String(opts.sampleRate));
  }

  await execFileAsync(resolvePiper(), args, {
    timeout: 300000,
    maxBuffer: 50 * 1024 * 1024,
  });

  if (!fs.existsSync(wavPath)) {
    throw new Error("Falha ao gerar áudio com Piper");
  }

  const durationSec = await getAudioDuration(wavPath);
  return { audioPath: wavPath, durationSec };
}

function resolveFFprobe(): string {
  const envPath = process.env.FFPROBE_PATH;
  const candidates: string[] = [];
  if (envPath) candidates.push(envPath);
  candidates.push(
    "C:/ProgramData/chocolatey/bin/ffprobe.exe",
    "C:/ffmpeg/bin/ffprobe.exe",
    "C:/Program Files/ffmpeg/bin/ffprobe.exe",
    "C:/Program Files (x86)/ffmpeg/bin/ffprobe.exe",
    "ffprobe"
  );
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return "ffprobe";
}

async function getAudioDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync(resolveFFprobe(), [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const d = parseFloat(String(stdout).trim());
  if (!isNaN(d)) return d;
  return 0;
}

