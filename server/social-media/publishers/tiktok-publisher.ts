import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { PostContent, PublishResult } from '../config';

export class TikTokPublisher {
  private baseUrl = 'https://open.tiktokapis.com';

  /**
   * Publica um vídeo no TikTok
   */
  async publishVideo(
    accessToken: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      // Primeiro, faz upload do vídeo
      const uploadResult = await this.uploadVideo(accessToken, content.videoPath);
      
      if (!uploadResult.success) {
        return {
          platform: 'tiktok',
          success: false,
          error: uploadResult.error
        };
      }

      // Depois, publica o vídeo
      const publishResult = await this.createPost(
        accessToken,
        uploadResult.publish_id!,
        content
      );

      return publishResult;
    } catch (error) {
      console.error('Erro ao publicar no TikTok:', error);
      return {
        platform: 'tiktok',
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  /**
   * Faz upload do vídeo para o TikTok
   */
  private async uploadVideo(
    accessToken: string,
    videoPath: string
  ): Promise<{
    success: boolean;
    publish_id?: string;
    error?: string;
  }> {
    try {
      // Verifica se o arquivo existe
      if (!fs.existsSync(videoPath)) {
        throw new Error('Arquivo de vídeo não encontrado');
      }

      const videoStats = fs.statSync(videoPath);
      const videoSize = videoStats.size;

      // Verifica o tamanho do arquivo (máximo 128MB para TikTok)
      if (videoSize > 128 * 1024 * 1024) {
        throw new Error('Arquivo muito grande. Máximo permitido: 128MB');
      }

      // Inicia o upload
      const initResponse = await axios.post(
        `${this.baseUrl}/v2/post/publish/video/init/`,
        {
          post_info: {
            title: 'Video Upload',
            privacy_level: 'SELF_ONLY', // Será alterado na publicação
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: videoSize,
            chunk_size: Math.min(videoSize, 10 * 1024 * 1024), // 10MB chunks
            total_chunk_count: Math.ceil(videoSize / (10 * 1024 * 1024))
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (initResponse.data.error) {
        throw new Error(`Erro ao iniciar upload: ${initResponse.data.error.message}`);
      }

      const { publish_id, upload_url } = initResponse.data.data;

      // Faz upload do arquivo em chunks
      const videoBuffer = fs.readFileSync(videoPath);
      const chunkSize = 10 * 1024 * 1024; // 10MB
      const totalChunks = Math.ceil(videoBuffer.length / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, videoBuffer.length);
        const chunk = videoBuffer.slice(start, end);

        const formData = new FormData();
        formData.append('video', chunk, {
          filename: path.basename(videoPath),
          contentType: 'video/mp4'
        });

        await axios.put(upload_url, formData, {
          headers: {
            ...formData.getHeaders(),
            'Content-Range': `bytes ${start}-${end - 1}/${videoBuffer.length}`
          }
        });
      }

      return {
        success: true,
        publish_id
      };
    } catch (error) {
      console.error('Erro no upload do vídeo TikTok:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro no upload'
      };
    }
  }

  /**
   * Cria o post no TikTok
   */
  private async createPost(
    accessToken: string,
    publishId: string,
    content: PostContent
  ): Promise<PublishResult> {
    try {
      // Combina título, descrição e hashtags
      const caption = this.formatCaption(content);

      const response = await axios.post(
        `${this.baseUrl}/v2/post/publish/`,
        {
          post_id: publishId,
          post_info: {
            title: content.title.substring(0, 150), // TikTok tem limite de caracteres
            text: caption.substring(0, 2200), // Limite do TikTok para descrição
            privacy_level: this.mapPrivacyLevel(content.privacy),
            disable_duet: false,
            disable_comment: false,
            disable_stitch: false,
            video_cover_timestamp_ms: 1000
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.error) {
        throw new Error(`Erro ao publicar: ${response.data.error.message}`);
      }

      const postId = response.data.data.publish_id;
      
      return {
        platform: 'tiktok',
        success: true,
        postId: postId,
        postUrl: `https://www.tiktok.com/@username/video/${postId}` // URL genérica
      };
    } catch (error) {
      console.error('Erro ao criar post no TikTok:', error);
      return {
        platform: 'tiktok',
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar post'
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
   * Mapeia o nível de privacidade para o formato do TikTok
   */
  private mapPrivacyLevel(privacy: string): string {
    switch (privacy) {
      case 'public':
        return 'PUBLIC_TO_EVERYONE';
      case 'private':
        return 'SELF_ONLY';
      case 'unlisted':
        return 'MUTUAL_FOLLOW_FRIENDS';
      default:
        return 'PUBLIC_TO_EVERYONE';
    }
  }

  /**
   * Verifica o status de uma publicação
   */
  async getPublishStatus(
    accessToken: string,
    publishId: string
  ): Promise<{
    status: 'processing' | 'success' | 'failed';
    video_id?: string;
    error?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/v2/post/publish/status/`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          },
          params: {
            publish_id: publishId
          }
        }
      );

      if (response.data.error) {
        return {
          status: 'failed',
          error: response.data.error.message
        };
      }

      const data = response.data.data;
      return {
        status: data.status,
        video_id: data.video_id,
        error: data.fail_reason
      };
    } catch (error) {
      console.error('Erro ao verificar status da publicação TikTok:', error);
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }
}