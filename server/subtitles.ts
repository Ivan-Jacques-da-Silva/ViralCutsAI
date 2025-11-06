import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

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

function resolveWhisperCpp(): string | null {
  const env = process.env.WHISPER_CPP_PATH;
  const candidates = [
    env,
    "./bin/whisper.cpp/main.exe",
    "./whisper/main.exe",
    "whisper",
    "main",
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return null;
}

export async function transcribeWithWhisperCpp(
  videoPath: string,
  lang: string = "pt",
  workdir: string = path.dirname(videoPath)
): Promise<string> {
  const whisperBin = resolveWhisperCpp();
  const modelPath = process.env.WHISPER_CPP_MODEL; // e.g., ./models/ggml-small.bin
  if (!whisperBin || !modelPath || !fs.existsSync(modelPath)) {
    throw new Error("whisper.cpp não configurado. Defina WHISPER_CPP_PATH e WHISPER_CPP_MODEL");
  }

  const base = path.join(workdir, `aud_${Date.now()}`);
  const wavPath = `${base}.wav`;

  // Extrai áudio mono 16kHz para melhor acurácia
  await execFileAsync(resolveFFmpeg(), [
    "-y",
    "-i", videoPath,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    wavPath,
  ], { timeout: 300000 });

  if (!fs.existsSync(wavPath)) {
    throw new Error("Falha ao extrair áudio do clipe");
  }

  const outBase = `${base}`; // whisper.cpp gera outBase.srt com -osrt -of outBase
  const args = [
    "-f", wavPath,
    "-m", modelPath,
    "-l", lang,
    "-osrt",
    "-oj", // JSON com palavras (se suportado)
    "-of", outBase,
  ];

  await execFileAsync(whisperBin, args, { cwd: process.cwd(), timeout: 900000, maxBuffer: 50 * 1024 * 1024 });

  const srtPath = `${outBase}.srt`;
  if (!fs.existsSync(srtPath)) {
    throw new Error("Transcrição não gerou SRT");
  }

  const srt = fs.readFileSync(srtPath, "utf-8");

  // Limpa temporários
  try { fs.unlinkSync(wavPath); } catch {}
  try { fs.unlinkSync(srtPath); } catch {}

  return srt.trim();
}

export function sanitizeSrt(srt: string): string {
  if (!srt) return "";
  let t = srt.replace(/\r\n/g, "\n").trim();
  // Remove cercas de código e markdown
  t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, "").trim());
  t = t.replace(/^```.*$|^\s*```\s*$/gm, "");
  // Normaliza setas e separadores
  t = t.replace(/–>|—>|->/g, "-->");
  // Substitui ponto por vírgula e adiciona ms quando ausente
  t = t.replace(/(\d{1,2}:\d{2}:\d{2})\.(\d{1,3})/g, (m, hms, ms) => `${hms},${ms.padEnd(3,'0')}`);
  t = t.replace(/(\d{1,2}:\d{2}:\d{2})(\s*-->\s*)(\d{1,2}:\d{2}:\d{2})(?![,\.])/g, `$1,000$2$3,000`);
  // Se ainda não houver nenhum range, aborta
  if (!/\d{1,2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2},\d{3}/.test(t)) return "";

  // Reconstrói SRT reindexando blocos e colando texto
  const parts = t.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const out: string[] = [];
  let idx = 1;
  for (const p of parts) {
    const lines = p.split(/\n/).filter(Boolean);
    // Remove numeração inicial se houver
    if (lines.length && /^\d+$/.test(lines[0])) lines.shift();
    // Garimpa a primeira linha com range
    const rangeIdx = lines.findIndex(l => /\d{1,2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2},\d{3}/.test(l));
    if (rangeIdx === -1) continue;
    const range = lines[rangeIdx];
    const text = lines.slice(rangeIdx + 1).join("\n").trim();
    if (!text) continue;
    out.push(String(idx++));
    out.push(range);
    out.push(text);
    out.push("");
  }
  const final = out.join("\n").trim();
  return final ? final + "\n" : "";
}

export type WordTiming = { start: number; end: number; text: string };

export async function transcribeWordsWhisperCpp(
  videoPath: string,
  lang: string = "pt",
  workdir: string = path.dirname(videoPath)
): Promise<WordTiming[]> {
  const whisperBin = resolveWhisperCpp();
  const modelPath = process.env.WHISPER_CPP_MODEL;
  if (!whisperBin || !modelPath || !fs.existsSync(modelPath)) {
    throw new Error("whisper.cpp não configurado. Defina WHISPER_CPP_PATH e WHISPER_CPP_MODEL");
  }

  const base = path.join(workdir, `aud_${Date.now()}`);
  const wavPath = `${base}.wav`;

  await execFileAsync(resolveFFmpeg(), [
    "-y",
    "-i", videoPath,
    "-vn",
    "-ac", "1",
    "-ar", "16000",
    wavPath,
  ], { timeout: 300000 });

  const outBase = `${base}`;
  await execFileAsync(whisperBin, [
    "-f", wavPath,
    "-m", modelPath,
    "-l", lang,
    "-oj",
    "-of", outBase,
  ], { cwd: process.cwd(), timeout: 900000, maxBuffer: 50 * 1024 * 1024 });

  const jsonPath = `${outBase}.json`;
  let words: WordTiming[] = [];
  if (fs.existsSync(jsonPath)) {
    try {
      const obj = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const segments = obj.segments || [];
      for (const seg of segments) {
        const segStart = seg.start ?? 0;
        if (Array.isArray(seg.words)) {
          for (const w of seg.words) {
            const ws = typeof w.start === 'number' ? w.start : segStart;
            const we = typeof w.end === 'number' ? w.end : (ws + 0.3);
            const txt = String(w.word ?? w.text ?? '').trim();
            if (txt) words.push({ start: ws, end: we, text: txt });
          }
        } else if (typeof seg.text === 'string') {
          // Fallback: divide texto em palavras com fatia uniforme no segmento
          const txt = seg.text.trim();
          const parts = txt.split(/\s+/).filter(Boolean);
          const duration = Math.max(0.01, (seg.end ?? segStart) - segStart);
          const slot = duration / Math.max(1, parts.length);
          let t = segStart;
          for (const p of parts) {
            words.push({ start: t, end: t + slot, text: p });
            t += slot;
          }
        }
      }
    } catch {}
  }

  try { fs.unlinkSync(wavPath); } catch {}
  try { fs.unlinkSync(jsonPath); } catch {}

  return words.sort((a,b)=> a.start - b.start);
}

export function buildAssFromWords(words: WordTiming[], opts?: { vertical?: boolean }): string {
  const vertical = !!opts?.vertical;
  const playResX = vertical ? 1080 : 1920;
  const playResY = vertical ? 1920 : 1080;
  const fontSize = vertical ? 48 : 42;
  const marginV = vertical ? 80 : 60;

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

  // Agrupa em linhas com base em respiros (>300ms) e limite de caracteres
  const lines: { start: number; end: number; words: WordTiming[] }[] = [];
  let buf: WordTiming[] = [];
  const flush = () => {
    if (!buf.length) return;
    lines.push({ start: buf[0].start, end: buf[buf.length-1].end, words: buf });
    buf = [];
  };
  let lastEnd = words[0].start;
  for (const w of words) {
    const gap = w.start - lastEnd;
    const lineChars = buf.reduce((s,x)=> s + x.text.length + 1, 0);
    if (gap > 0.35 || lineChars > 40) flush();
    buf.push(w);
    lastEnd = w.end;
  }
  flush();

  const toTime = (t: number) => {
    const hh = Math.floor(t / 3600);
    const mm = Math.floor((t % 3600) / 60);
    const ss = Math.floor(t % 60);
    const cs = Math.floor((t - Math.floor(t)) * 100);
    return `${String(hh).padStart(1,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}.${String(cs).padStart(2,'0')}`;
  };

  const events: string[] = [];
  for (const line of lines) {
    const total = Math.max(0.01, line.end - line.start);
    let text = '';
    for (const w of line.words) {
      const durCs = Math.max(1, Math.round((w.end - w.start) * 100));
      text += `{\\kf${durCs}}${w.text} `;
    }
    const start = toTime(line.start);
    const end = toTime(line.end + 0.01);
    events.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an2}${text.trim()}`);
  }

  return header + events.join("\n") + "\n";
}
