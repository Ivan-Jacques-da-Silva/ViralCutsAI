import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeVideo } from "./gemini";
import { insertVideoSchema } from "@shared/schema";
import { isSocialMediaUrl, downloadVideoFromPlatform } from "./video-downloader";

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${file.originalname}`;
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
    fileSize: 100 * 1024 * 1024,
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

      const analysis = await analyzeVideo(videoPath);

      const video = await storage.createVideo({
        title: title || req.file.originalname,
        videoPath,
        source: "upload",
        analysis,
      });

      res.json(video);
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

        const filename = `${Date.now()}-${path.basename(url) || "video.mp4"}`;
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

      const analysis = await analyzeVideo(videoPath);

      const video = await storage.createVideo({
        title: videoTitle,
        videoPath,
        source: "url",
        analysis,
      });

      res.json(video);
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
      res.json(video);
    } catch (error: any) {
      console.error("Erro ao buscar vídeo:", error);
      res.status(500).json({ error: error.message || "Erro ao buscar vídeo" });
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

      const stat = fs.statSync(videoPath);
      const fileSize = stat.size;
      const range = req.headers.range;

      const ext = path.extname(videoPath).toLowerCase();
      const contentType = ext === ".webm"
        ? "video/webm"
        : ext === ".mkv"
        ? "video/x-matroska"
        : "video/mp4";

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = end - start + 1;
        const file = fs.createReadStream(videoPath, { start, end });
        const head = {
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunksize,
          "Content-Type": contentType,
        };
        res.writeHead(206, head);
        file.pipe(res);
      } else {
        const head = {
          "Content-Length": fileSize,
          "Content-Type": contentType,
        };
        res.writeHead(200, head);
        fs.createReadStream(videoPath).pipe(res);
      }
    } catch (error: any) {
      console.error("Erro ao fazer stream do vídeo:", error);
      res.status(500).json({ error: error.message || "Erro ao fazer stream do vídeo" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
