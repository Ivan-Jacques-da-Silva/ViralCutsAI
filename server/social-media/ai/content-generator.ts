import { GoogleGenAI } from '@google/genai';
import { analyzeVideo } from '../../gemini';

export interface ContentGenerationRequest {
  videoPath?: string;
  videoTitle?: string;
  videoDescription?: string;
  targetPlatforms: string[];
  contentType: 'reel' | 'short' | 'video' | 'post';
  tone: 'casual' | 'professional' | 'funny' | 'inspiring' | 'educational';
  targetAudience: string;
  keywords?: string[];
}

export interface GeneratedContent {
  titles: string[];
  descriptions: { [platform: string]: string };
  hashtags: { [platform: string]: string[] };
  captions: string[];
  suggestions: {
    bestTitle: string;
    bestDescription: string;
    recommendedHashtags: string[];
    platformSpecific: {
      [platform: string]: {
        title: string;
        description: string;
        hashtags: string[];
      };
    };
  };
}

export class ContentGenerator {
  private ai: GoogleGenAI | null;

  constructor(apiKey: string) {
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  /**
   * Gera conteúdo completo para redes sociais
   */
  async generateContent(request: ContentGenerationRequest): Promise<GeneratedContent> {
    try {
      if (!this.ai) throw new Error('GEMINI_API_KEY no configurada');
      const prompt = this.buildPrompt(request);
      const response = await (this.ai as any).models.generateContent({
        model: 'gemini-2.0-flash',
        contents: [prompt]
      });
      const text = (response as any).text || (typeof (response as any).candidates?.[0]?.content?.parts?.[0]?.text === 'string' ? (response as any).candidates[0].content.parts[0].text : '');

      return this.parseGeneratedContent(text, request.targetPlatforms);
    } catch (error) {
      console.error('Erro ao gerar conteúdo com IA:', error);
      throw error;
    }
  }

  /**
   * Gera apenas títulos virais
   */
  async generateViralTitles(
    context: string,
    platform: string,
    count: number = 5
  ): Promise<string[]> {
    try {
      const prompt = `
Gere ${count} títulos virais e chamativos para ${platform} baseado no seguinte contexto:
"${context}"

Requisitos:
- Títulos que geram curiosidade e cliques
- Adequados para ${platform}
- Em português brasileiro
- Máximo 60 caracteres para TikTok/Instagram, 100 para YouTube
- Use emojis estrategicamente
- Foque em gatilhos emocionais (surpresa, curiosidade, urgência)

Formato: Retorne apenas os títulos, um por linha, sem numeração.
`;

      if (!this.ai) throw new Error('GEMINI_API_KEY no configurada');
      const response = await (this.ai as any).models.generateContent({ model: 'gemini-2.0-flash', contents: [prompt] });
      const text = (response as any).text || (typeof (response as any).candidates?.[0]?.content?.parts?.[0]?.text === 'string' ? (response as any).candidates[0].content.parts[0].text : '');

      return text.split('\n')
        .filter(line => line.trim())
        .map(line => line.trim())
        .slice(0, count);
    } catch (error) {
      console.error('Erro ao gerar títulos virais:', error);
      throw error;
    }
  }

  /**
   * Gera descrições otimizadas
   */
  async generateDescriptions(
    title: string,
    context: string,
    platforms: string[],
    tone: string = 'casual'
  ): Promise<{ [platform: string]: string }> {
    try {
      const descriptions: { [platform: string]: string } = {};

      for (const platform of platforms) {
        const prompt = `
Crie uma descrição envolvente para ${platform} baseada no título: "${title}"
Contexto adicional: "${context}"
Tom: ${tone}

Requisitos para ${platform}:
${this.getPlatformRequirements(platform)}

A descrição deve:
- Ser cativante e engajadora
- Incluir call-to-action apropriado
- Usar linguagem adequada ao tom "${tone}"
- Ser otimizada para ${platform}
- Estar em português brasileiro

Retorne apenas a descrição, sem formatação extra.
`;

        if (!this.ai) throw new Error('GEMINI_API_KEY no configurada');
        const response = await (this.ai as any).models.generateContent({ model: 'gemini-2.0-flash', contents: [prompt] });
        const text = (response as any).text || (typeof (response as any).candidates?.[0]?.content?.parts?.[0]?.text === 'string' ? (response as any).candidates[0].content.parts[0].text : '');
        descriptions[platform] = (text || '').trim();
      }

      return descriptions;
    } catch (error) {
      console.error('Erro ao gerar descrições:', error);
      throw error;
    }
  }

  /**
   * Gera hashtags relevantes e virais
   */
  async generateHashtags(
    content: string,
    platforms: string[],
    niche?: string
  ): Promise<{ [platform: string]: string[] }> {
    try {
      const hashtags: { [platform: string]: string[] } = {};

      for (const platform of platforms) {
        const prompt = `
Gere hashtags estratégicas para ${platform} baseado no conteúdo: "${content}"
${niche ? `Nicho: ${niche}` : ''}

Requisitos para ${platform}:
- ${this.getHashtagLimits(platform)}
- Mix de hashtags populares e de nicho
- Hashtags em português e inglês quando apropriado
- Incluir hashtags trending quando relevante
- Evitar hashtags banidas ou shadowbanned

Categorias de hashtags:
1. Hashtags de nicho específico
2. Hashtags populares/trending
3. Hashtags de comunidade
4. Hashtags de localização (Brasil)
5. Hashtags de call-to-action

Retorne apenas as hashtags separadas por vírgula, sem o símbolo #.
`;

        if (!this.ai) throw new Error('GEMINI_API_KEY no configurada');
        const response = await (this.ai as any).models.generateContent({ model: 'gemini-2.0-flash', contents: [prompt] });
        const raw = (response as any).text || (typeof (response as any).candidates?.[0]?.content?.parts?.[0]?.text === 'string' ? (response as any).candidates[0].content.parts[0].text : '');
        const hashtagList = (raw || '')
          .split(',')
          .map(tag => tag.trim().replace('#', ''))
          .filter(tag => tag.length > 0)
          .slice(0, this.getMaxHashtags(platform));

        hashtags[platform] = hashtagList;
      }

      return hashtags;
    } catch (error) {
      console.error('Erro ao gerar hashtags:', error);
      throw error;
    }
  }

  /**
   * Analisa um vídeo e sugere conteúdo baseado no contexto visual
   */
  async analyzeVideoAndGenerateContent(
    videoPath: string,
    platforms: string[],
    options?: {
      tone?: 'casual' | 'professional' | 'funny' | 'inspiring' | 'educational';
      targetAudience?: string;
      keywords?: string[];
    }
  ): Promise<GeneratedContent> {
    try {
      // Nota: Para análise de vídeo, você precisaria implementar:
      // 1. Extração de frames do vídeo
      // 2. Análise de imagem com Gemini Vision
      // 3. Transcrição de áudio (se houver)
      
      // Por enquanto, vamos usar uma abordagem baseada no nome do arquivo
      const fileName = videoPath.split(/[/\\]/).pop() || '';
      // Analisa o video com IA (com fallback local se preciso)
      const analysisRaw = await analyzeVideo(videoPath);
      const analysis = (analysisRaw || '').toString().trim();
      // Limita o tamanho do contexto para o prompt
      const maxCtx = 6000;
      const analysisCtx = analysis.length > maxCtx ? analysis.slice(0, maxCtx) + '\n[...]' : analysis;
      const context = `Vídeo: ${fileName}`;

      return this.generateContent({
        videoPath,
        targetPlatforms: platforms,
        contentType: 'video',
        tone: (options?.tone as any) || 'casual',
        targetAudience: options?.targetAudience || 'geral',
        videoTitle: fileName,
        videoDescription: `Analise detalhada do video (base para geracao de conteudo):\n${analysisCtx}`,
        keywords: options?.keywords
      });
    } catch (error) {
      console.error('Erro ao analisar vídeo:', error);
      throw error;
    }
  }

  /**
   * Constrói o prompt principal para geração de conteúdo
   */
  private buildPrompt(request: ContentGenerationRequest): string {
    return `
Você é um especialista em marketing digital e criação de conteúdo viral para redes sociais.
Crie conteúdo otimizado para as seguintes plataformas: ${request.targetPlatforms.join(', ')}

CONTEXTO:
- Tipo de conteúdo: ${request.contentType}
- Tom: ${request.tone}
- Público-alvo: ${request.targetAudience}
- Título do vídeo: ${request.videoTitle || 'Não informado'}
- Descrição: ${request.videoDescription || 'Não informada'}
- Palavras-chave: ${request.keywords?.join(', ') || 'Não informadas'}

TAREFA:
Gere conteúdo completo incluindo:

1. TÍTULOS (5 opções virais):
- Que geram curiosidade e cliques
- Adequados para cada plataforma
- Com emojis estratégicos
- Focados em gatilhos emocionais

2. DESCRIÇÕES (para cada plataforma):
- Envolventes e engajadoras
- Com call-to-action apropriado
- Otimizadas para algoritmo de cada rede
- No tom especificado

3. HASHTAGS (para cada plataforma):
- Mix de populares e de nicho
- Estratégicas para alcance
- Adequadas aos limites de cada rede

4. SUGESTÕES ESTRATÉGICAS:
- Melhor título geral
- Melhor descrição geral
- Hashtags mais recomendadas
- Adaptações específicas por plataforma

FORMATO DE RESPOSTA:
Organize a resposta em JSON com a seguinte estrutura:
{
  "titles": ["título1", "título2", ...],
  "descriptions": {
    "tiktok": "descrição para tiktok",
    "instagram": "descrição para instagram",
    "youtube": "descrição para youtube"
  },
  "hashtags": {
    "tiktok": ["tag1", "tag2", ...],
    "instagram": ["tag1", "tag2", ...],
    "youtube": ["tag1", "tag2", ...]
  },
  "suggestions": {
    "bestTitle": "melhor título",
    "bestDescription": "melhor descrição",
    "recommendedHashtags": ["tag1", "tag2", ...],
    "platformSpecific": {
      "tiktok": {"title": "", "description": "", "hashtags": []},
      "instagram": {"title": "", "description": "", "hashtags": []},
      "youtube": {"title": "", "description": "", "hashtags": []}
    }
  }
}

Responda APENAS com o JSON, sem texto adicional.
`;
  }

  /**
   * Faz parse do conteúdo gerado pela IA
   */
  private parseGeneratedContent(text: string, platforms: string[]): GeneratedContent {
    try {
      // Tenta fazer parse do JSON
      const parsed = JSON.parse(text);
      
      // Valida e ajusta a estrutura se necessário
      return {
        titles: parsed.titles || [],
        descriptions: parsed.descriptions || {},
        hashtags: parsed.hashtags || {},
        captions: [], // Pode ser derivado das descrições
        suggestions: parsed.suggestions || {
          bestTitle: parsed.titles?.[0] || '',
          bestDescription: '',
          recommendedHashtags: [],
          platformSpecific: {}
        }
      };
    } catch (error) {
      console.error('Erro ao fazer parse do conteúdo gerado:', error);
      
      // Fallback: tenta extrair conteúdo manualmente
      return this.extractContentManually(text, platforms);
    }
  }

  /**
   * Extrai conteúdo manualmente se o JSON falhar
   */
  private extractContentManually(text: string, platforms: string[]): GeneratedContent {
    const lines = text.split('\n').filter(line => line.trim());
    
    return {
      titles: lines.slice(0, 5).map(line => line.replace(/^\d+\.?\s*/, '').trim()),
      descriptions: platforms.reduce((acc, platform) => {
        acc[platform] = `Conteúdo gerado para ${platform}`;
        return acc;
      }, {} as { [key: string]: string }),
      hashtags: platforms.reduce((acc, platform) => {
        acc[platform] = ['viral', 'conteudo', 'brasil'];
        return acc;
      }, {} as { [key: string]: string[] }),
      captions: [],
      suggestions: {
        bestTitle: lines[0] || 'Título gerado',
        bestDescription: 'Descrição gerada',
        recommendedHashtags: ['viral', 'conteudo'],
        platformSpecific: {}
      }
    };
  }

  /**
   * Retorna requisitos específicos da plataforma
   */
  private getPlatformRequirements(platform: string): string {
    const requirements = {
      tiktok: '- Máximo 2200 caracteres\n- Linguagem casual e divertida\n- Foco em trends e challenges\n- Call-to-action para engajamento',
      instagram: '- Máximo 2200 caracteres\n- Visual e inspiracional\n- Uso estratégico de emojis\n- Incentivo para salvar e compartilhar',
      youtube: '- Máximo 5000 caracteres\n- Mais detalhado e informativo\n- Timestamps se aplicável\n- Links e recursos adicionais',
      facebook: '- Foco em conversação\n- Perguntas para engajamento\n- Conteúdo que gera discussão'
    };

    return requirements[platform.toLowerCase()] || requirements.instagram;
  }

  /**
   * Retorna limites de hashtags por plataforma
   */
  private getHashtagLimits(platform: string): string {
    const limits = {
      tiktok: 'Máximo 100 caracteres total para hashtags',
      instagram: 'Máximo 30 hashtags, recomendado 5-10',
      youtube: 'Máximo 500 caracteres total, foco em palavras-chave',
      facebook: 'Máximo 2-3 hashtags, foco em relevância'
    };

    return limits[platform.toLowerCase()] || limits.instagram;
  }

  /**
   * Retorna número máximo de hashtags por plataforma
   */
  private getMaxHashtags(platform: string): number {
    const maxHashtags = {
      tiktok: 10,
      instagram: 15,
      youtube: 10,
      facebook: 3
    };

    return maxHashtags[platform.toLowerCase()] || 10;
  }
}
