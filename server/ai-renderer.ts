import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { synthesizeWithPiper } from "./tts";

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

async function getDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync(resolveFFprobe(), [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const d = parseFloat(String(stdout).trim());
  if (isNaN(d)) throw new Error("Não foi possível obter duração do áudio");
  return d;
}

export interface RenderOptions {
  text: string;
  orientation: "vertical" | "horizontal";
  outDir: string;
  backgroundColor?: string; // e.g., #0F0F10
}

export interface RenderResult {
  outputPath: string;
  audioPath: string;
  durationSec: number;
}

export async function renderAnimatedVideo(opts: RenderOptions): Promise<RenderResult> {
  const text = (opts.text || "").trim();
  if (!text) throw new Error("Texto vazio para renderização");
  if (!fs.existsSync(opts.outDir)) fs.mkdirSync(opts.outDir, { recursive: true });

  // 1) TTS com Piper
  const tts = await synthesizeWithPiper({ text, outDir: opts.outDir, sampleRate: Number(process.env.PIPER_SAMPLE_RATE) || 22050 });
  const duration = tts.durationSec || (await getDuration(tts.audioPath));

  // 2) Gerar ASS aproximando tempos por palavra (karaokê)
  const words = text.split(/\s+/).filter(Boolean);
  const per = Math.max(0.2, duration / Math.max(1, words.length));
  const ass = buildApproxAss(words, { duration, vertical: opts.orientation === "vertical" });
  const assPath = path.join(opts.outDir, `overlay_${Date.now()}.ass`);
  fs.writeFileSync(assPath, ass, "utf-8");

  // 3) Render base (cor) + overlay de legendas + áudio
  const w = opts.orientation === "vertical" ? 1080 : 1920;
  const h = opts.orientation === "vertical" ? 1920 : 1080;
  const bg = (opts.backgroundColor || "#0F0F10").replace("#", "#");
  const outPath = path.join(opts.outDir, `ai_video_${Date.now()}.mp4`);

  const filter = `subtitles='${assPath.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'" )}'`;
  const args: string[] = [
    "-y",
    "-f", "lavfi",
    "-i", `color=c=${bg}:s=${w}x${h}:r=30:d=${duration.toFixed(3)}`,
    "-i", tts.audioPath,
    "-map", "0:v:0",
    "-map", "1:a:0",
    "-vf", filter,
    "-c:v", "libx264",
    "-preset", "fast",
    "-crf", "23",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-shortest",
    outPath,
  ];

  await execFileAsync(resolveFFmpeg(), args, { timeout: 600000, maxBuffer: 80 * 1024 * 1024 });
  if (!fs.existsSync(outPath)) throw new Error("Falha ao renderizar vídeo com IA");

  return { outputPath: outPath, audioPath: tts.audioPath, durationSec: duration };
}

function buildApproxAss(words: string[], opts: { duration: number; vertical: boolean }): string {
  const playResX = opts.vertical ? 1080 : 1920;
  const playResY = opts.vertical ? 1920 : 1080;
  const fontSize = opts.vertical ? 56 : 48;
  const marginV = opts.vertical ? 120 : 90;
  const header = `[
Script Info]
ScriptType: v4.00+
Collisions: Normal
PlayResX: ${playResX}
PlayResY: ${playResY}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},&H00FFFFFF,&H00FFFFFF,&H000000,&H00000000,0,0,0,0,100,100,0,0,1,3,0,2,20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  if (!words.length) return header;
  const total = Math.max(0.5, opts.duration);
  const per = Math.max(0.2, total / words.length);

  // Agrupar palavras em linhas de até ~42 chars, com respiro pequeno
  type Line = { start: number; end: number; tokens: string[] };
  const lines: Line[] = [];
  let t = 0;
  let buf: string[] = [];
  let chars = 0;
  for (const w of words) {
    const dur = per; // duração aproximada por palavra
    if (chars + w.length + 1 > 42 && buf.length) {
      lines.push({ start: Math.max(0, t - per * buf.length), end: t, tokens: buf });
      buf = [];
      chars = 0;
    }
    buf.push(w);
    chars += w.length + 1;
    t += dur;
  }
  if (buf.length) {
    lines.push({ start: Math.max(0, t - per * buf.length), end: t, tokens: buf });
  }

  const toTime = (s: number) => {
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = Math.floor(s % 60);
    const cs = Math.floor((s - Math.floor(s)) * 100);
    return `${String(hh).padStart(1,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  };

  const events: string[] = [];
  for (const ln of lines) {
    let text = '';
    const each = Math.max(1, Math.round(((ln.end - ln.start) / ln.tokens.length) * 100));
    for (const tok of ln.tokens) {
      text += `{\\kf${each}}${tok} `;
    }
    events.push(`Dialogue: 0,${toTime(ln.start)},${toTime(ln.end + 0.02)},Default,,0,0,0,,{\\an2}${text.trim()}`);
  }
  return header + events.join("\n") + "\n";
}

