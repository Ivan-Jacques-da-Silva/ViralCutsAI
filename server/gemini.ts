import * as fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeVideo(videoPath: string): Promise<string> {
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
      `Analise este vídeo em detalhes e descreva:
      - O que está acontecendo no vídeo
      - Objetos e pessoas presentes
      - Ações e eventos principais
      - Contexto e cenário
      - Qualquer texto ou informação relevante visível`,
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: contents,
    });

    return response.text || "Não foi possível analisar o vídeo";
  } catch (error) {
    console.error("Erro ao analisar vídeo:", error);
    throw new Error(`Falha ao analisar vídeo: ${error}`);
  }
}
