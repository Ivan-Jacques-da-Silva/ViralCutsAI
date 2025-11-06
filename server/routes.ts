import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeVideoForCuts, generateSubtitles } from "./gemini";
import { transcribeWithWhisperCpp, transcribeWordsWhisperCpp, buildAssFromWords, sanitizeSrt } from "./subtitles";
import { isSocialMediaUrl, downloadVideoFromPlatform } from "./video-downloader";
import { cutVideo, addSubtitlesToVideo } from "./video-processor";
import { synthesizeWithPiper } from "./tts";
import { renderAnimatedVideo } from "./ai-renderer";
import { generatePublicationContent } from "./content-generator";

const uploadDir = path.join(process.cwd(), "uploads");
  const processedDir = path.join(process.cwd(), "processed");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(processedDir)) {
  fs.mkdirSync(processedDir, { recursive: true });
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const sanitized = sanitizeFilename(file.originalname);
      const uniqueName = `${Date.now()}-${sanitized}`;
      cb(null, uniqueName);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("video/")) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos de vídeo são permitidos"));
    }
  },
  limits: {
    fileSize: 2 * 1024 * 1024 * 1024, // 2GB
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Publicação em redes sociais (opcional, habilite SOCIAL_MEDIA_ENABLED=1)
  if (process.env.SOCIAL_MEDIA_ENABLED === '1') {
    try {
      const { default: socialMediaRouter } = await import('./routes/social-media');
      app.use("/api/social-media", socialMediaRouter);

      const { SocialMediaManager } = await import('./social-media/social-media-manager');
      const smManager = new SocialMediaManager(path.join(process.cwd(), 'data', 'social-media.db'), process.env.GEMINI_API_KEY);

      app.get("/api/social-accounts", (req, res) => {
        try {
          const accounts = smManager.getConnectedAccounts().map(a => ({
            id: a.id,
            provider: a.platform,
            name: a.accountName,
            username: null as string | null,
            authorized: !!a.isActive,
          }));
          res.json(accounts);
        } catch (e: any) {
          res.status(500).json({ error: e?.message || 'Erro ao listar contas' });
        }
      });

      app.post("/api/social-accounts", (req, res) => {
        try {
          const { provider, name, username, providerId, accessToken } = req.body || {};
          if (!provider || !name || !providerId || !accessToken) {
            return res.status(400).json({ error: "Campos obrigatórios: provider, name, providerId, accessToken" });
          }
          const acc = smManager.addManualAccount({
            platform: String(provider),
            accountId: String(providerId),
            accountName: String(name),
            accessToken: String(accessToken),
          });
          return res.json({
            id: acc.id,
            provider: acc.platform,
            name: acc.accountName,
            username: username || null,
            authorized: true,
          });
        } catch (e: any) {
          res.status(500).json({ error: e?.message || 'Erro ao adicionar conta' });
        }
      });

      app.delete("/api/social-accounts/:id", async (req, res) => {
        try {
          const ok = await smManager.disconnectAccount(req.params.id);
          if (!ok) return res.status(404).json({ error: 'Conta não encontrada' });
          return res.json({ success: true });
        } catch (e: any) {
          res.status(500).json({ error: e?.message || 'Erro ao remover conta' });
        }
      });

      app.get('/api/oauth/connect/:provider', (req, res) => {
        try {
          const provider = String(req.params.provider || '').toLowerCase();
          const authUrl = smManager.getAuthUrl(provider, undefined);
          return res.json({ authUrl });
        } catch (e: any) {
          return res.status(400).json({ error: e?.message || 'Configuração de OAuth ausente', setup_required: true });
        }
      });
    } catch (err: any) {
      console.warn('[social-media] Desabilitado por dependências ausentes:', err?.message || err);
    }
  }

  // Bridge para o botão OAuth do front (/api/oauth/connect/:provider)
  app.get('/api/oauth/connect/:provider', (req, res) => {
    try {
      const provider = String(req.params.provider || '').toLowerCase();
      const authUrl = smManager.getAuthUrl(provider, undefined);
      return res.json({ authUrl });
    } catch (e: any) {
      // Se faltar configuração, indique setup_required para o front avisar o usuário
      return res.status(400).json({
        error: e?.message || 'Configuração de OAuth ausente',
        setup_required: true,
      });
    }
  });

  // AI TTS (Piper)
  app.post("/api/ai/tts", async (req, res) => {
    try {
      const { text, sampleRate, modelPath } = req.body || {};
      if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: "Texto é obrigatório" });
      }
      const out = await synthesizeWithPiper({
        text: text.trim(),
        sampleRate: sampleRate ? Number(sampleRate) : undefined,
        voiceModelPath: modelPath,
        outDir: path.join(process.cwd(), 'uploads', 'audio'),
      });
      return res.json(out);
    } catch (e: any) {
      console.error('Erro TTS:', e);
      return res.status(500).json({ error: e?.message || 'Erro no TTS' });
    }
  });

  // AI Render (vídeo animado com TTS)
  app.post("/api/ai/render", async (req, res) => {
    try {
      const { text, orientation, backgroundColor } = req.body || {};
      if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: "Texto é obrigatório" });
      }
      const orient: 'vertical' | 'horizontal' = (orientation === 'horizontal') ? 'horizontal' : 'vertical';
      const out = await renderAnimatedVideo({
        text: text.trim(),
        orientation: orient,
        outDir: path.join(process.cwd(), 'uploads', 'created-videos'),
        backgroundColor: backgroundColor,
      });
      return res.json(out);
    } catch (e: any) {
      console.error('Erro Render:', e);
      return res.status(500).json({ error: e?.message || 'Erro ao renderizar vídeo' });
    }
  });

  // Download helper for AICreator (serves files within uploads/ or processed/ only)
  app.get('/api/processed/download', async (req, res) => {
    try {
      const file = String(req.query.file || '');
      if (!file) return res.status(400).json({ error: 'file é obrigatório' });
      const allowedRoots = [
        path.join(process.cwd(), 'uploads'),
        path.join(process.cwd(), 'processed'),
      ];
      const abs = path.resolve(file);
      if (!allowedRoots.some(root => abs.startsWith(root))) {
        return res.status(400).json({ error: 'Caminho não permitido' });
      }
      if (!fs.existsSync(abs)) return res.status(404).json({ error: 'Arquivo não encontrado' });
      return res.download(abs, path.basename(abs));
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Erro no download' });
    }
  });

  // Geração de conteúdo (título/descrição/hashtags) com IA baseado no corte
  app.post("/api/cuts/:cutId/content", async (req, res) => {
    try {
      const { cutId } = req.params;
      const cut = await storage.getVideoCut(cutId);
      if (!cut) return res.status(404).json({ error: 'Corte não encontrado' });

      const video = await storage.getVideo(cut.videoId);
      if (!video) return res.status(404).json({ error: 'Vídeo não encontrado' });

      // Se existir um processado, preferir o arquivo já cortado
      const processedOfCut = await storage.getProcessedCutsByCutId(cut.id);
      const processedLatest = processedOfCut[0];
      const clipPath = processedLatest?.outputPath && fs.existsSync(processedLatest.outputPath)
        ? processedLatest.outputPath
        : video.videoPath;

      const clipDuration = Math.max(1, cut.endTime - cut.startTime);

      // Transcrição/legenda bruta
      let transcript = '';
      try {
        const words = await transcribeWordsWhisperCpp(clipPath, 'pt', processedDir);
        transcript = words.map(w => w.text).join(' ').trim();
      } catch (e) {
        // fallback via Gemini SRT
        const srt = await generateSubtitles(clipPath, processedLatest ? 0 : cut.startTime, processedLatest ? clipDuration : cut.endTime);
        transcript = srt
          .replace(/\r\n/g, '\n')
          .split(/\n\n/)
          .map(block => block.replace(/^\d+\n.*?-->.*?\n/m, ''))
          .join(' ')
          .replace(/\n+/g, ' ')
          .trim();
      }

      const analysis = `Corte do vídeo: ${video.title}\n`+
        `Intervalo: ${cut.startTime}s a ${cut.endTime}s (≈${clipDuration}s)\n`+
        (cut.description ? `Descrição do corte: ${cut.description}\n` : '');

      const content = await generatePublicationContent(analysis, transcript);
      return res.json(content);
    } catch (e: any) {
      console.error('Erro ao gerar conteúdo do corte:', e);
      return res.status(500).json({ error: e?.message || 'Erro ao gerar conteúdo do corte' });
    }
  });

  // Biblioteca local: lista arquivos já existentes nas pastas
  app.get('/api/library/uploads', async (req, res) => {
    try {
      const roots = [
        path.join(process.cwd(), 'uploads'),
        path.join(process.cwd(), 'uploads', 'created-videos'),
      ];
      const files: Array<{ path: string; size: number; mtime: number }> = [];
      for (const root of roots) {
        if (!fs.existsSync(root)) continue;
        const entries = fs.readdirSync(root);
        for (const name of entries) {
          const full = path.join(root, name);
          try {
            const st = fs.statSync(full);
            if (st.isFile() && /\.(mp4|mov|mkv|webm|avi)$/i.test(name)) {
              files.push({ path: full, size: st.size, mtime: st.mtimeMs });
            }
          } catch {}
        }
      }
      files.sort((a,b)=> b.mtime - a.mtime);
      res.json({ files });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Erro ao listar uploads locais' });
    }
  });

  // Importa um arquivo local (já existente) para a base e analisa cortes
  app.post('/api/library/import', async (req, res) => {
    try {
      const { filePath, title } = req.body || {};
      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ error: 'filePath é obrigatório' });
      }
      const abs = path.resolve(filePath);
      const allowedRoots = [
        path.join(process.cwd(), 'uploads'),
        path.join(process.cwd(), 'uploads', 'created-videos'),
      ];
      if (!allowedRoots.some(r => abs.startsWith(r))) {
        return res.status(400).json({ error: 'Arquivo fora das pastas permitidas' });
      }
      if (!fs.existsSync(abs)) {
        return res.status(404).json({ error: 'Arquivo não encontrado' });
      }

      const video = await storage.createVideo({
        title: title || path.basename(abs),
        videoPath: abs,
        source: 'library',
      });

      const cuts = await analyzeVideoForCuts(abs);
      for (const cut of cuts) {
        await storage.createVideoCut({
          videoId: video.id,
          startTime: cut.startTime,
          endTime: cut.endTime,
          description: cut.description,
        });
      }
      const videoCuts = await storage.getVideoCutsByVideoId(video.id);
      res.json({ video, cuts: videoCuts });
    } catch (e: any) {
      res.status(500).json({ error: e?.message || 'Erro ao importar arquivo' });
    }
  });
  app.post("/api/videos/upload", upload.single("video"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado" });
      }

      const { title } = req.body;
      const videoPath = req.file.path;

      const video = await storage.createVideo({
        title: title || req.file.originalname,
        videoPath,
        source: "upload",
      });

      const cuts = await analyzeVideoForCuts(videoPath);

      for (const cut of cuts) {
        await storage.createVideoCut({
          videoId: video.id,
          startTime: cut.startTime,
          endTime: cut.endTime,
          description: cut.description,
        });
      }

      const videoCuts = await storage.getVideoCutsByVideoId(video.id);

      res.json({ video, cuts: videoCuts });
    } catch (error: any) {
      console.error("Erro no upload:", error);
      res.status(500).json({ error: error.message || "Erro ao processar vídeo" });
    }
  });

  app.post("/api/videos/url", async (req, res) => {
    try {
      const { url, title } = req.body;

      if (!url) {
        return res.status(400).json({ error: "URL é obrigatória" });
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        return res.status(400).json({ error: "URL inválida" });
      }

      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: "Apenas URLs HTTP/HTTPS são permitidas" });
      }

      if (parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname.startsWith("192.168.") || parsedUrl.hostname.startsWith("10.")) {
        return res.status(400).json({ error: "URLs internas não são permitidas" });
      }

      let videoPath: string;
      let videoTitle: string;

      if (isSocialMediaUrl(url)) {
        videoPath = await downloadVideoFromPlatform(url, uploadDir);
        videoTitle = title || path.basename(videoPath, path.extname(videoPath));
      } else {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'VideoAnalyzer/1.0'
          },
          signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
          return res.status(400).json({ error: "Não foi possível baixar o vídeo da URL" });
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.startsWith("video/")) {
          return res.status(400).json({ error: "A URL não aponta para um arquivo de vídeo" });
        }

        const contentLength = response.headers.get("content-length");
        if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
          return res.status(400).json({ error: "Vídeo muito grande (máximo 100MB)" });
        }

        const urlBasename = sanitizeFilename(path.basename(url) || "video.mp4");
        const filename = `${Date.now()}-${urlBasename}`;
        videoPath = path.join(uploadDir, filename);

        const writeStream = fs.createWriteStream(videoPath);

        await new Promise((resolve, reject) => {
          if (!response.body) {
            reject(new Error("Sem corpo de resposta"));
            return;
          }

          const reader = response.body.getReader();
          let totalBytes = 0;
          const maxSize = 100 * 1024 * 1024;

          const pump = async () => {
            try {
              const { done, value } = await reader.read();
              if (done) {
                writeStream.end();
                resolve(true);
                return;
              }

              totalBytes += value.length;
              if (totalBytes > maxSize) {
                writeStream.destroy();
                fs.unlinkSync(videoPath);
                reject(new Error("Vídeo excedeu o tamanho máximo"));
                return;
              }

              if (!writeStream.write(value)) {
                writeStream.once('drain', pump);
              } else {
                pump();
              }
            } catch (err) {
              reject(err);
            }
          };

          pump();
          writeStream.on('error', reject);
        });

        videoTitle = title || filename;
      }

      const video = await storage.createVideo({
        title: videoTitle,
        videoPath,
        source: "url",
      });

      const cuts = await analyzeVideoForCuts(videoPath);

      for (const cut of cuts) {
        await storage.createVideoCut({
          videoId: video.id,
          startTime: cut.startTime,
          endTime: cut.endTime,
          description: cut.description,
        });
      }

      const videoCuts = await storage.getVideoCutsByVideoId(video.id);

      res.json({ video, cuts: videoCuts });
    } catch (error: any) {
      console.error("Erro ao processar URL:", error);
      res.status(500).json({ error: error.message || "Erro ao processar vídeo" });
    }
  });

  app.get("/api/videos", async (req, res) => {
    try {
      const videos = await storage.getAllVideos();
      res.json(videos);
    } catch (error: any) {
      console.error("Erro ao listar vídeos:", error);
      res.status(500).json({ error: error.message || "Erro ao listar vídeos" });
    }
  });

  app.get("/api/videos/:id", async (req, res) => {
    try {
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Vídeo não encontrado" });
      }
      const cuts = await storage.getVideoCutsByVideoId(video.id);
      res.json({ video, cuts });
    } catch (error: any) {
      console.error("Erro ao buscar vídeo:", error);
      res.status(500).json({ error: error.message || "Erro ao buscar vídeo" });
    }
  });

  app.get("/api/videos/:videoId/cuts", async (req, res) => {
    try {
      const cuts = await storage.getVideoCutsByVideoId(req.params.videoId);
      res.json(cuts);
    } catch (error: any) {
      console.error("Erro ao listar cortes:", error);
      res.status(500).json({ error: error.message || "Erro ao listar cortes" });
    }
  });

  app.get("/api/videos/:id/stream", async (req, res) => {
    try {
      const videoId = req.params.id;
      console.log('Streaming video ID:', videoId);
      
      const video = await storage.getVideo(videoId);
      if (!video) {
        console.error('Vídeo não encontrado no banco:', videoId);
        return res.status(404).json({ error: "Vídeo não encontrado" });
      }

      const videoPath = video.videoPath;
      console.log('Video path:', videoPath);
      
      if (!fs.existsSync(videoPath)) {
        console.error('Arquivo não existe:', videoPath);
        return res.status(404).json({ error: "Arquivo de vídeo não encontrado" });
      }

      const ext = path.extname(videoPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mkv': 'video/x-matroska',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.flv': 'video/x-flv',
        '.wmv': 'video/x-ms-wmv',
        '.m4v': 'video/x-m4v',
      };
      const contentType = mimeTypes[ext] || 'video/mp4';

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
          'Cache-Control': 'no-cache',
        };
        res.writeHead(206, head);
        file.on('error', (err) => {
          console.error('Stream error (range):', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Falha no stream do vídeo' });
          } else {
            res.destroy(err);
          }
        });
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
          'Access-Control-Allow-Headers': 'Range',
          'Cache-Control': 'no-cache',
        };
        res.writeHead(200, head);
        const file = fs.createReadStream(videoPath);
        file.on('error', (err) => {
          console.error('Stream error (full):', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Falha no stream do vídeo' });
          } else {
            res.destroy(err);
          }
        });
        file.pipe(res);
      }
    } catch (error: any) {
      console.error("Erro ao fazer stream do vídeo:", error);
      res.status(500).json({ error: error.message || "Erro ao fazer stream do vídeo" });
    }
  });

  app.put("/api/cuts/:cutId", async (req, res) => {
    try {
      const { cutId } = req.params;
      const { startTime, endTime, description } = req.body;
      const normalizedStart = startTime !== undefined ? Math.max(0, Math.floor(Number(startTime))) : undefined;
      const normalizedEnd = endTime !== undefined ? Math.max(0, Math.ceil(Number(endTime))) : undefined;
      if (normalizedStart !== undefined && normalizedEnd !== undefined) {
        if (normalizedStart < 0 || normalizedEnd <= normalizedStart) {
          return res.status(400).json({ error: "Tempos de corte inválidos" });
        }
      }

      const cut = await storage.getVideoCut(cutId);
      if (!cut) {
        return res.status(404).json({ error: "Corte não encontrado" });
      }

      if (startTime !== undefined && endTime !== undefined) {
        if (startTime < 0 || endTime <= startTime) {
          return res.status(400).json({ error: "Tempos de corte inválidos" });
        }
      }

      const updatedCut = await storage.updateVideoCut(cutId, {
        startTime: normalizedStart ?? cut.startTime,
        endTime: normalizedEnd ?? cut.endTime,
        description: description ?? cut.description,
      });

      res.json(updatedCut);
    } catch (error: any) {
      console.error("Erro ao atualizar corte:", error);
      res.status(500).json({ error: error.message || "Erro ao atualizar corte" });
    }
  });

  app.post("/api/cuts/:cutId/process", async (req, res) => {
    try {
      const { cutId } = req.params;
      const { format } = req.body;

      if (!format || (format !== "horizontal" && format !== "vertical")) {
        return res.status(400).json({ error: "Formato inválido. Use 'horizontal' ou 'vertical'" });
      }

      const cut = await storage.getVideoCut(cutId);
      if (!cut) {
        return res.status(404).json({ error: "Corte não encontrado" });
      }

      const video = await storage.getVideo(cut.videoId);
      if (!video) {
        return res.status(404).json({ error: "Vídeo não encontrado" });
      }

      // 1) Corte primeiro para garantir timestamps relativos (00:00:00)
      const clipDuration = Math.max(0, cut.endTime - cut.startTime);
      let outputPath = await cutVideo(
        video.videoPath,
        cut.startTime,
        cut.endTime,
        format,
        processedDir
      );

      // 2) Gera legendas sobre o arquivo já cortado para garantir alinhamento
      let rawSubtitles: string = "";
      let assContent: string = "";
      try {
        // Preferir whisper.cpp se configurado (WHISPER_CPP_PATH e WHISPER_CPP_MODEL)
        const words = await transcribeWordsWhisperCpp(outputPath, "pt", processedDir);
        console.log(`[subtitles] whisper.cpp words count=${words.length}`);
        assContent = buildAssFromWords(words, { vertical: format === 'vertical' });
      } catch (e) {
        // Fallback: tentar via Gemini como antes
        console.warn(`[subtitles] whisper.cpp unavailable or failed: ${String((e as Error)?.message || e)}`);
        rawSubtitles = await generateSubtitles(outputPath, 0, clipDuration);
        console.log(`[subtitles] gemini generated SRT length=${rawSubtitles?.length ?? 0}`);
      }

      // 3) Sanitiza o SRT para evitar formatações inconsistentes
      const subtitles = assContent || sanitizeSrt(rawSubtitles);
      if (subtitles) {
        console.log(`[subtitles] Sub content length=${subtitles.length}. Proceeding to burn.`);
        outputPath = await addSubtitlesToVideo(outputPath, subtitles, processedDir);
      } else {
        console.warn('[subtitles] No valid SRT after sanitize; skipping burn-in.');
      }

      const processedCut = await storage.createProcessedCut({
        cutId: cut.id,
        format,
        outputPath,
        subtitles: subtitles || null,
      });

      res.json(processedCut);
    } catch (error: any) {
      console.error("Erro ao processar corte:", error);
      res.status(500).json({ error: error.message || "Erro ao processar corte" });
    }
  });

  app.get("/api/processed/:id/download", async (req, res) => {
    try {
      const processed = await storage.getProcessedCut(req.params.id);
      if (!processed) {
        return res.status(404).json({ error: "Corte processado não encontrado" });
      }

      const filePath = processed.outputPath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }

      const filename = path.basename(filePath);
      res.download(filePath, filename);
    } catch (error: any) {
      console.error("Erro ao fazer download:", error);
      res.status(500).json({ error: error.message || "Erro ao fazer download" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
