import { GoogleGenAI } from "@google/genai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const hasGeminiKey = GEMINI_API_KEY.length > 0;

if (!hasGeminiKey) {
  console.warn("⚠️  GEMINI_API_KEY não configurada - Geração de conteúdo limitada");
}

const ai = hasGeminiKey ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

export interface ContentSuggestions {
  title: string;
  description: string;
  hashtags: string;
}

export async function generatePublicationContent(
  analysis: string,
  transcription: string
): Promise<ContentSuggestions> {
  if (!hasGeminiKey || !ai) {
    console.warn("[content-generator] GEMINI_API_KEY não configurada - Usando sugestões padrão");
    return {
      title: "Vídeo incrível!",
      description: "Confira este momento impactante! Configure GEMINI_API_KEY para sugestões personalizadas. 🔥",
      hashtags: "#viral #fyp #trending #shorts #reels"
    };
  }

  try {
    const prompt = `Você é um especialista em marketing de conteúdo para redes sociais (TikTok, YouTube Shorts, Instagram Reels, Facebook).

ANÁLISE DO VÍDEO:
${analysis}

TRANSCRIÇÃO DO ÁUDIO:
${transcription}

TAREFA:
Crie sugestões otimizadas para publicação nas redes sociais. As sugestões devem ser:
- **Chamativas e virais** - que gerem cliques e engajamento
- **Otimizadas para algoritmos** - com palavras-chave relevantes
- **Curtas e impactantes** - diretas ao ponto

REQUISITOS:
1. **TÍTULO**: Máximo 100 caracteres, chamativo, que gere curiosidade
2. **DESCRIÇÃO**: Entre 150-300 caracteres, com call-to-action e contexto
3. **HASHTAGS**: Entre 5-10 hashtags relevantes e populares, separadas por espaço

IMPORTANTE:
- Use linguagem natural e envolvente
- Inclua emojis estratégicos (mas com moderação)
- Foque no momento mais impactante do vídeo
- As hashtags devem ser em português e inglês quando relevante

RESPONDA APENAS COM UM JSON VÁLIDO neste formato:
{
  "title": "título chamativo aqui",
  "description": "descrição completa aqui com call-to-action",
  "hashtags": "#hashtag1 #hashtag2 #hashtag3"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            hashtags: { type: "string" }
          },
          required: ["title", "description", "hashtags"]
        }
      }
    });

    const result = JSON.parse(response.text || "{}");

    return {
      title: result.title || "Vídeo incrível!",
      description: result.description || "Confira este momento impactante!",
      hashtags: result.hashtags || "#viral #fyp #trending"
    };
  } catch (error) {
    console.error("Erro ao gerar sugestões de conteúdo:", error);
    
    // Fallback básico
    return {
      title: "Vídeo incrível!",
      description: "Confira este momento impactante! 🔥",
      hashtags: "#viral #fyp #trending #shorts #reels"
    };
  }
}
