import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { PostContent, PublishResult } from '../config';

export class InstagramPublisher {
  private graphUrl = 'https://graph.facebook.com/v18.0';

  /**
   * Publica um Reel no Instagram
   */
  async publishReel(
    pageAccessToken: string,
    instagramAccountId: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      // Primeiro, cria o container do media
      const containerResult = await this.createMediaContainer(
        pageAccessToken,
        instagramAccountId,
        content
      );

      if (!containerResult.success) {
        return {
          platform: 'instagram',
          success: false,
          error: containerResult.error
        };
      }

      // Aguarda o processamento do container
      await this.waitForContainerProcessing(
        pageAccessToken,
        containerResult.container_id!
      );

      // Publica o container
      const publishResult = await this.publishContainer(
        pageAccessToken,
        instagramAccountId,
        containerResult.container_id!
      );

      return publishResult;
    } catch (error) {
      console.error('Erro ao publicar Reel no Instagram:', error);
      return {
        platform: 'instagram',
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Cria um container de media para o Reel
   */
  private async createMediaContainer(
    pageAccessToken: string,
    instagramAccountId: string,
    content: PostContent
  ): Promise<{
    success: boolean;
    container_id?: string;
    error?: string;
  }> {
    try {
      // Verifica se o arquivo existe
      if (!fs.existsSync(content.videoPath)) {
        throw new Error('Arquivo de vídeo não encontrado');
      }

      // Primeiro, faz upload do vídeo para um servidor temporário ou usa URL pública
      // Para desenvolvimento local, você precisará de um servidor público ou usar ngrok
      const videoUrl = await this.uploadVideoToPublicUrl(content.videoPath);

      // Formata a legenda
      const caption = this.formatCaption(content);

      const response = await axios.post(
        `${this.graphUrl}/${instagramAccountId}/media`,
        {
          media_type: 'REELS',
          video_url: videoUrl,
          caption: caption.substring(0, 2200), // Limite do Instagram
          share_to_feed: true, // Compartilha no feed também
          cover_url: content.thumbnailPath ? await this.uploadImageToPublicUrl(content.thumbnailPath) : undefined
        },
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Erro ao criar container: ${response.data.error.message}`);
      }

      return {
        success: true,
        container_id: response.data.id
      };
    } catch (error) {
      console.error('Erro ao criar container do Instagram:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar container'
      };
    }
  }

  /**
   * Aguarda o processamento do container
   */
  private async waitForContainerProcessing(
    pageAccessToken: string,
    containerId: string,
    maxAttempts: number = 30
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const response = await axios.get(
          `${this.graphUrl}/${containerId}`,
          {
            params: {
              fields: 'status_code',
              access_token: pageAccessToken
            }
          }
        );

        const statusCode = response.data.status_code;

        if (statusCode === 'FINISHED') {
          return; // Processamento concluído
        } else if (statusCode === 'ERROR') {
          throw new Error('Erro no processamento do vídeo');
        }

        // Aguarda 2 segundos antes da próxima verificação
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('Timeout no processamento do vídeo');
  }

  /**
   * Publica o container processado
   */
  private async publishContainer(
    pageAccessToken: string,
    instagramAccountId: string,
    containerId: string
  ): Promise<PublishResult> {
    try {
      const response = await axios.post(
        `${this.graphUrl}/${instagramAccountId}/media_publish`,
        {
          creation_id: containerId
        },
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Erro ao publicar: ${response.data.error.message}`);
      }

      const mediaId = response.data.id;

      return {
        platform: 'instagram',
        success: true,
        postId: mediaId,
        postUrl: `https://www.instagram.com/reel/${mediaId}/`
      };
    } catch (error) {
      console.error('Erro ao publicar container do Instagram:', error);
      return {
        platform: 'instagram',
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao publicar'
      };
    }
  }

  /**
   * Publica uma foto no Instagram
   */
  async publishPhoto(
    pageAccessToken: string,
    instagramAccountId: string,
    imagePath: string,
    caption: string
  ): Promise<PublishResult> {
    try {
      // Upload da imagem
      const imageUrl = await this.uploadImageToPublicUrl(imagePath);

      // Cria container
      const containerResponse = await axios.post(
        `${this.graphUrl}/${instagramAccountId}/media`,
        {
          image_url: imageUrl,
          caption: caption.substring(0, 2200)
        },
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      if (containerResponse.data.error) {
        throw new Error(`Erro ao criar container de imagem: ${containerResponse.data.error.message}`);
      }

      const containerId = containerResponse.data.id;

      // Publica
      const publishResponse = await axios.post(
        `${this.graphUrl}/${instagramAccountId}/media_publish`,
        {
          creation_id: containerId
        },
        {
          params: {
            access_token: pageAccessToken
          }
        }
      );

      if (publishResponse.data.error) {
        throw new Error(`Erro ao publicar imagem: ${publishResponse.data.error.message}`);
      }

      return {
        platform: 'instagram',
        success: true,
        postId: publishResponse.data.id,
        postUrl: `https://www.instagram.com/p/${publishResponse.data.id}/`
      };
    } catch (error) {
      console.error('Erro ao publicar foto no Instagram:', error);
      return {
        platform: 'instagram',
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Formata a legenda combinando título, descrição e hashtags
   */
  private formatCaption(content: PostContent): string {
    let caption = '';
    
    if (content.title) {
      caption += content.title + '\n\n';
    }
    
    if (content.description) {
      caption += content.description + '\n\n';
    }
    
    if (content.hashtags && content.hashtags.length > 0) {
      const hashtags = content.hashtags
        .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
        .join(' ');
      caption += hashtags;
    }
    
    return caption.trim();
  }

  /**
   * Faz upload do vídeo para uma URL pública (implementação simplificada)
   * NOTA: Em produção, você precisará implementar um serviço de upload real
   */
  private async uploadVideoToPublicUrl(videoPath: string): Promise<string> {
    // Esta é uma implementação placeholder
    // Em um ambiente real, você precisaria:
    // 1. Fazer upload para um serviço como AWS S3, Cloudinary, etc.
    // 2. Ou usar ngrok para expor seu servidor local
    // 3. Ou implementar um endpoint público temporário
    
    console.warn('AVISO: uploadVideoToPublicUrl precisa ser implementado com um serviço real');
    
    // Por enquanto, retorna uma URL placeholder
    // Você deve substituir isso por uma implementação real
    return `https://your-public-server.com/uploads/${path.basename(videoPath)}`;
  }

  /**
   * Faz upload da imagem para uma URL pública (implementação simplificada)
   */
  private async uploadImageToPublicUrl(imagePath: string): Promise<string> {
    // Mesma observação do método acima
    console.warn('AVISO: uploadImageToPublicUrl precisa ser implementado com um serviço real');
    
    return `https://your-public-server.com/uploads/${path.basename(imagePath)}`;
  }

  /**
   * Obtém informações sobre uma publicação
   */
  async getMediaInfo(
    pageAccessToken: string,
    mediaId: string
  ): Promise<{
    id: string;
    media_type: string;
    media_url: string;
    permalink: string;
    timestamp: string;
    caption?: string;
    like_count?: number;
    comments_count?: number;
  }> {
    try {
      const response = await axios.get(
        `${this.graphUrl}/${mediaId}`,
        {
          params: {
            fields: 'id,media_type,media_url,permalink,timestamp,caption,like_count,comments_count',
            access_token: pageAccessToken
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Erro ao obter informações da mídia: ${response.data.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao obter informações da mídia Instagram:', error);
      throw error;
    }
  }

  /**
   * Lista as publicações recentes
   */
  async getRecentMedia(
    pageAccessToken: string,
    instagramAccountId: string,
    limit: number = 25
  ): Promise<Array<{
    id: string;
    media_type: string;
    media_url: string;
    permalink: string;
    timestamp: string;
    caption?: string;
  }>> {
    try {
      const response = await axios.get(
        `${this.graphUrl}/${instagramAccountId}/media`,
        {
          params: {
            fields: 'id,media_type,media_url,permalink,timestamp,caption',
            limit: limit,
            access_token: pageAccessToken
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Erro ao obter mídias recentes: ${response.data.error.message}`);
      }

      return response.data.data;
    } catch (error) {
      console.error('Erro ao obter mídias recentes do Instagram:', error);
      throw error;
    }
  }
}