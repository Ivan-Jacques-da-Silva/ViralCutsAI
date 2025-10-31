import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { PostContent, PublishResult } from '../config';

export class YouTubePublisher {
  private oauth2Client: any;

  constructor(oauth2Client: any) {
    this.oauth2Client = oauth2Client;
  }

  /**
   * Publica um vídeo no YouTube
   */
  async publishVideo(
    accessToken: string,
    content: PostContent,
    isShort: boolean = false
  ): Promise<PublishResult> {
    try {
      // Configura as credenciais
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

      // Verifica se o arquivo existe
      if (!fs.existsSync(content.videoPath)) {
        throw new Error('Arquivo de vídeo não encontrado');
      }

      // Prepara os metadados do vídeo
      const videoMetadata = this.prepareVideoMetadata(content, isShort);

      // Faz upload do vídeo
      const response = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: videoMetadata,
        media: {
          body: fs.createReadStream(content.videoPath)
        }
      });

      if (!response.data.id) {
        throw new Error('Falha no upload do vídeo');
      }

      const videoId = response.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      // Se for um Short, tenta definir como Short (não há API oficial, mas podemos usar tags)
      if (isShort) {
        await this.markAsShort(youtube, videoId);
      }

      return {
        platform: 'youtube',
        success: true,
        postId: videoId,
        postUrl: videoUrl
      };
    } catch (error) {
      console.error('Erro ao publicar vídeo no YouTube:', error);
      return {
        platform: 'youtube',
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Prepara os metadados do vídeo
   */
  private prepareVideoMetadata(content: PostContent, isShort: boolean = false) {
    // Formata a descrição
    const description = this.formatDescription(content, isShort);

    // Prepara as tags
    const tags = this.prepareTags(content.hashtags, isShort);

    return {
      snippet: {
        title: content.title.substring(0, 100), // YouTube tem limite de 100 caracteres para título
        description: description.substring(0, 5000), // Limite de 5000 caracteres para descrição
        tags: tags,
        categoryId: '22', // Categoria "People & Blogs" por padrão
        defaultLanguage: 'pt-BR',
        defaultAudioLanguage: 'pt-BR'
      },
      status: {
        privacyStatus: this.mapPrivacyStatus(content.privacy),
        selfDeclaredMadeForKids: false,
        embeddable: true,
        license: 'youtube',
        publicStatsViewable: true
      }
    };
  }

  /**
   * Formata a descrição do vídeo
   */
  private formatDescription(content: PostContent, isShort: boolean): string {
    let description = '';

    if (content.description) {
      description += content.description + '\n\n';
    }

    // Adiciona hashtags na descrição
    if (content.hashtags && content.hashtags.length > 0) {
      const hashtags = content.hashtags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ');
      description += hashtags + '\n\n';
    }

    // Adiciona informações específicas para Shorts
    if (isShort) {
      description += '#Shorts #YouTubeShorts\n\n';
    }

    // Adiciona informações padrão
    description += '🔔 Inscreva-se no canal e ative o sininho!\n';
    description += '👍 Deixe seu like se gostou do conteúdo!\n';
    description += '💬 Comente sua opinião!\n\n';

    // Adiciona timestamp se necessário
    description += '⏰ Criado automaticamente pelo ViralCutsAI';

    return description;
  }

  /**
   * Prepara as tags do vídeo
   */
  private prepareTags(hashtags: string[], isShort: boolean = false): string[] {
    const tags: string[] = [];

    // Adiciona hashtags como tags (remove o #)
    if (hashtags && hashtags.length > 0) {
      hashtags.forEach(tag => {
        const cleanTag = tag.replace('#', '').trim();
        if (cleanTag && cleanTag.length <= 30) { // YouTube tem limite de 30 caracteres por tag
          tags.push(cleanTag);
        }
      });
    }

    // Adiciona tags específicas para Shorts
    if (isShort) {
      tags.push('Shorts', 'YouTubeShorts', 'Short', 'Viral');
    }

    // Adiciona tags padrão
    tags.push('ViralCutsAI', 'Conteúdo', 'Brasil');

    // YouTube permite máximo 500 caracteres total para tags
    const maxLength = 500;
    let totalLength = 0;
    const finalTags: string[] = [];

    for (const tag of tags) {
      if (totalLength + tag.length + 1 <= maxLength) { // +1 para a vírgula
        finalTags.push(tag);
        totalLength += tag.length + 1;
      } else {
        break;
      }
    }

    return finalTags;
  }

  /**
   * Mapeia o status de privacidade
   */
  private mapPrivacyStatus(privacy: string): string {
    switch (privacy) {
      case 'public':
        return 'public';
      case 'private':
        return 'private';
      case 'unlisted':
        return 'unlisted';
      default:
        return 'public';
    }
  }

  /**
   * Tenta marcar o vídeo como Short (método não oficial)
   */
  private async markAsShort(youtube: any, videoId: string): Promise<void> {
    try {
      // Não há uma API oficial para marcar como Short
      // O YouTube detecta automaticamente baseado na duração (≤60s) e orientação (vertical)
      // Aqui podemos adicionar tags específicas ou outras estratégias
      
      console.log(`Vídeo ${videoId} será detectado automaticamente como Short se tiver ≤60s e orientação vertical`);
    } catch (error) {
      console.warn('Não foi possível marcar como Short:', error);
    }
  }

  /**
   * Atualiza os metadados de um vídeo existente
   */
  async updateVideo(
    accessToken: string,
    videoId: string,
    updates: {
      title?: string;
      description?: string;
      tags?: string[];
      privacy?: string;
    }
  ): Promise<boolean> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

      // Primeiro, obtém os dados atuais do vídeo
      const currentVideo = await youtube.videos.list({
        part: ['snippet', 'status'],
        id: [videoId]
      });

      if (!currentVideo.data.items || currentVideo.data.items.length === 0) {
        throw new Error('Vídeo não encontrado');
      }

      const video = currentVideo.data.items[0];
      
      // Prepara os dados atualizados
      const updatedSnippet = {
        ...video.snippet,
        title: updates.title || video.snippet!.title,
        description: updates.description || video.snippet!.description,
        tags: updates.tags || video.snippet!.tags
      };

      const updatedStatus = {
        ...video.status,
        privacyStatus: updates.privacy ? this.mapPrivacyStatus(updates.privacy) : video.status!.privacyStatus
      };

      // Atualiza o vídeo
      await youtube.videos.update({
        part: ['snippet', 'status'],
        requestBody: {
          id: videoId,
          snippet: updatedSnippet,
          status: updatedStatus
        }
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar vídeo no YouTube:', error);
      return false;
    }
  }

  /**
   * Deleta um vídeo
   */
  async deleteVideo(accessToken: string, videoId: string): Promise<boolean> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

      await youtube.videos.delete({
        id: videoId
      });

      return true;
    } catch (error) {
      console.error('Erro ao deletar vídeo no YouTube:', error);
      return false;
    }
  }

  /**
   * Obtém informações de um vídeo
   */
  async getVideoInfo(accessToken: string, videoId: string): Promise<{
    id: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: any;
    duration: string;
    viewCount: string;
    likeCount: string;
    commentCount: string;
    tags?: string[];
  }> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

      const response = await youtube.videos.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        id: [videoId]
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Vídeo não encontrado');
      }

      const video = response.data.items[0];

      return {
        id: video.id!,
        title: video.snippet!.title!,
        description: video.snippet!.description!,
        publishedAt: video.snippet!.publishedAt!,
        thumbnails: video.snippet!.thumbnails,
        duration: video.contentDetails!.duration!,
        viewCount: video.statistics!.viewCount!,
        likeCount: video.statistics!.likeCount!,
        commentCount: video.statistics!.commentCount!,
        tags: video.snippet!.tags
      };
    } catch (error) {
      console.error('Erro ao obter informações do vídeo YouTube:', error);
      throw error;
    }
  }

  /**
   * Lista os vídeos do canal
   */
  async getChannelVideos(
    accessToken: string,
    maxResults: number = 25
  ): Promise<Array<{
    id: string;
    title: string;
    description: string;
    publishedAt: string;
    thumbnails: any;
  }>> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

      // Primeiro, obtém o canal
      const channelResponse = await youtube.channels.list({
        part: ['contentDetails'],
        mine: true
      });

      if (!channelResponse.data.items || channelResponse.data.items.length === 0) {
        throw new Error('Canal não encontrado');
      }

      const uploadsPlaylistId = channelResponse.data.items[0].contentDetails!.relatedPlaylists!.uploads;

      // Obtém os vídeos da playlist de uploads
      const playlistResponse = await youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults: maxResults
      });

      return playlistResponse.data.items?.map(item => ({
        id: item.snippet!.resourceId!.videoId!,
        title: item.snippet!.title!,
        description: item.snippet!.description!,
        publishedAt: item.snippet!.publishedAt!,
        thumbnails: item.snippet!.thumbnails
      })) || [];
    } catch (error) {
      console.error('Erro ao obter vídeos do canal YouTube:', error);
      throw error;
    }
  }

  /**
   * Verifica se um vídeo é um Short baseado na duração
   */
  isVideoShort(duration: string): boolean {
    // Converte duração ISO 8601 para segundos
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return false;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    
    // Shorts devem ter 60 segundos ou menos
    return totalSeconds <= 60;
  }
}