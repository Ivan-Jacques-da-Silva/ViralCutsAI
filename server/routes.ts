import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeVideoForCuts, generateSubtitles } from "./gemini";
import { isSocialMediaUrl, downloadVideoFromPlatform } from "./video-downloader";
import { cutVideo, addSubtitlesToVideo } from "./video-processor";

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
      const video = await storage.getVideo(req.params.id);
      if (!video) {
        return res.status(404).json({ error: "Vídeo não encontrado" });
      }

      const videoPath = video.videoPath;
      if (!fs.existsSync(videoPath)) {
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
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          'Content-Length': fileSize,
          'Content-Type': contentType,
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
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
        startTime: startTime ?? cut.startTime,
        endTime: endTime ?? cut.endTime,
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

      const subtitles = await generateSubtitles(video.videoPath, cut.startTime, cut.endTime);

      let outputPath = await cutVideo(
        video.videoPath,
        cut.startTime,
        cut.endTime,
        format,
        processedDir
      );

      if (subtitles) {
        outputPath = await addSubtitlesToVideo(outputPath, subtitles, processedDir);
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
