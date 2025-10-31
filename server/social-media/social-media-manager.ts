import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Importa autenticadores
import { TikTokAuth } from './auth/tiktok-auth';
import { InstagramAuth } from './auth/instagram-auth';
import { YouTubeAuth } from './auth/youtube-auth';

// Importa publicadores
import { TikTokPublisher } from './publishers/tiktok-publisher';
import { InstagramPublisher } from './publishers/instagram-publisher';
import { YouTubePublisher } from './publishers/youtube-publisher';

// Importa gerador de conteúdo
import { ContentGenerator } from './ai/content-generator';

// Importa scheduler e monitoring
import { PostScheduler, ScheduleOptions } from './scheduler';
import { PublicationMonitor } from './monitoring';

import type { 
  SocialAccount, 
  PostContent, 
  PublishResult,
  ContentGenerationOptions,
  GeneratedContent
} from './config';

export interface PublishRequest {
  content: PostContent;
  accounts: string[]; // IDs das contas conectadas
  generateContent?: boolean;
  contentOptions?: {
    tone: 'casual' | 'professional' | 'funny' | 'inspiring' | 'educational';
    targetAudience: string;
    keywords?: string[];
  };
}

export interface PublishResponse {
  success: boolean;
  results: PublishResult[];
  generatedContent?: any;
  errors?: string[];
}

export class SocialMediaManager {
  private db: Database.Database;
  private tiktokAuth: TikTokAuth;
  private instagramAuth: InstagramAuth;
  private youtubeAuth: YouTubeAuth;
  private tiktokPublisher: TikTokPublisher;
  private instagramPublisher: InstagramPublisher;
  private youtubePublisher: YouTubePublisher;
  private contentGenerator?: ContentGenerator;
  private scheduler: PostScheduler;
  private monitor: PublicationMonitor;

  constructor(dbPath: string, geminiApiKey?: string) {
    this.db = new Database(dbPath);
    this.initializeDatabase();
    
    // Inicializa autenticadores
    this.tiktokAuth = new TikTokAuth();
    this.instagramAuth = new InstagramAuth();
    this.youtubeAuth = new YouTubeAuth();
    
    // Inicializa publishers
    this.tiktokPublisher = new TikTokPublisher();
    this.instagramPublisher = new InstagramPublisher();
    this.youtubePublisher = new YouTubePublisher(this.youtubeAuth.getOAuth2Client());
    
    // Inicializa gerador de conteúdo se API key fornecida
    if (geminiApiKey) {
      this.contentGenerator = new ContentGenerator(geminiApiKey);
    }

    // Inicializa scheduler e monitor
    this.scheduler = new PostScheduler(this.db, this);
    this.monitor = new PublicationMonitor(this.db);
  }

  /**
   * Inicializa as tabelas do banco de dados
   */
  private initializeDatabase(): void {
    // Tabela de contas conectadas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS social_accounts (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        account_id TEXT NOT NULL,
        account_name TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at INTEGER,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Tabela de publicações
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS publications (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        video_path TEXT NOT NULL,
        thumbnail_path TEXT,
        platforms TEXT NOT NULL, -- JSON array
        hashtags TEXT, -- JSON array
        privacy TEXT DEFAULT 'public',
        scheduled_at INTEGER,
        status TEXT DEFAULT 'draft', -- draft, scheduled, publishing, published, failed
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `);

    // Tabela de resultados de publicação
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS publication_results (
        id TEXT PRIMARY KEY,
        publication_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        account_id TEXT NOT NULL,
        post_id TEXT,
        post_url TEXT,
        status TEXT NOT NULL, -- success, failed, pending
        error_message TEXT,
        published_at INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (publication_id) REFERENCES publications (id)
      )
    `);

    // Tabela de conteúdo gerado por IA
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS generated_content (
        id TEXT PRIMARY KEY,
        publication_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        generated_title TEXT,
        generated_description TEXT,
        generated_hashtags TEXT, -- JSON array
        ai_suggestions TEXT, -- JSON object
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (publication_id) REFERENCES publications (id)
      )
    `);
  }

  /**
   * Conecta uma conta de rede social
   */
  async connectAccount(platform: string, authCode: string, state?: string): Promise<SocialMediaAccount> {
    try {
      let accountData: any;
      let tokens: any;

      switch (platform.toLowerCase()) {
        case 'tiktok':
          tokens = await this.tiktokAuth.exchangeCodeForTokens(authCode, state);
          const tiktokUser = await this.tiktokAuth.getUserInfo(tokens.access_token);
          accountData = {
            platform: 'tiktok',
            accountId: tiktokUser.open_id,
            accountName: tiktokUser.display_name || tiktokUser.username,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(Date.now() + tokens.expires_in * 1000)
          };
          break;

        case 'instagram':
          const shortToken = await this.instagramAuth.exchangeCodeForShortToken(authCode);
          const longToken = await this.instagramAuth.exchangeForLongLivedToken(shortToken.access_token);
          const instagramUser = await this.instagramAuth.getUserInfo(longToken.access_token);
          accountData = {
            platform: 'instagram',
            accountId: instagramUser.id,
            accountName: instagramUser.username,
            accessToken: longToken.access_token,
            expiresAt: new Date(Date.now() + longToken.expires_in * 1000)
          };
          break;

        case 'youtube':
          tokens = await this.youtubeAuth.exchangeCodeForTokens(authCode);
          this.youtubeAuth.setCredentials(tokens);
          const youtubeChannel = await this.youtubeAuth.getChannelInfo(tokens.access_token);
          accountData = {
            platform: 'youtube',
            accountId: youtubeChannel.id,
            accountName: youtubeChannel.title,
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: new Date(tokens.expiry_date)
          };
          break;

        default:
          throw new Error(`Plataforma não suportada: ${platform}`);
      }

      // Salva no banco de dados
      const account: SocialMediaAccount = {
        id: `${platform}_${accountData.accountId}_${Date.now()}`,
        platform: accountData.platform,
        accountId: accountData.accountId,
        accountName: accountData.accountName,
        accessToken: accountData.accessToken,
        refreshToken: accountData.refreshToken,
        expiresAt: accountData.expiresAt,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.saveAccount(account);
      return account;
    } catch (error) {
      console.error(`Erro ao conectar conta ${platform}:`, error);
      throw error;
    }
  }

  /**
   * Publica conteúdo em múltiplas redes sociais
   */
  async publishContent(request: PublishRequest): Promise<PublishResponse> {
    const results: PublishResult[] = [];
    const errors: string[] = [];
    let generatedContent: any = null;

    try {
      // Gera conteúdo com IA se solicitado
      if (request.generateContent && this.contentGenerator && request.contentOptions) {
        const platforms = await this.getAccountPlatforms(request.accounts);
        generatedContent = await this.contentGenerator.generateContent({
          videoPath: request.content.videoPath,
          videoTitle: request.content.title,
          videoDescription: request.content.description,
          targetPlatforms: platforms,
          contentType: 'video',
          tone: request.contentOptions.tone,
          targetAudience: request.contentOptions.targetAudience,
          keywords: request.contentOptions.keywords
        });

        // Atualiza o conteúdo com as sugestões da IA
        if (generatedContent.suggestions.bestTitle) {
          request.content.title = generatedContent.suggestions.bestTitle;
        }
        if (generatedContent.suggestions.bestDescription) {
          request.content.description = generatedContent.suggestions.bestDescription;
        }
        if (generatedContent.suggestions.recommendedHashtags) {
          request.content.hashtags = generatedContent.suggestions.recommendedHashtags;
        }
      }

      // Publica em cada conta
      for (const accountId of request.accounts) {
        try {
          const account = this.getAccount(accountId);
          if (!account || !account.isActive) {
            errors.push(`Conta ${accountId} não encontrada ou inativa`);
            continue;
          }

          // Verifica se o token precisa ser renovado
          await this.refreshTokenIfNeeded(account);

          let result: PublishResult;

          switch (account.platform) {
            case 'tiktok':
              result = await this.tiktokPublisher.publishVideo(account.accessToken, request.content);
              break;

            case 'instagram':
              // Para Instagram, precisamos do page access token
              const pages = await this.instagramAuth.getFacebookPages(account.accessToken);
              const page = pages.find(p => p.instagram_business_account?.id === account.accountId);
              if (!page) {
                throw new Error('Página do Facebook não encontrada para esta conta Instagram');
              }
              result = await this.instagramPublisher.publishReel(
                page.access_token,
                account.accountId,
                request.content
              );
              break;

            case 'youtube':
              this.youtubePublisher = new YouTubePublisher(this.youtubeAuth.getOAuth2Client());
              const isShort = this.isVideoShort(request.content.videoPath);
              result = await this.youtubePublisher.publishVideo(
                account.accessToken,
                request.content,
                isShort
              );
              break;

            default:
              throw new Error(`Plataforma não suportada: ${account.platform}`);
          }

          results.push(result);

          // Salva o resultado no banco
          this.savePublicationResult(accountId, result);

        } catch (error) {
          const errorMsg = `Erro ao publicar na conta ${accountId}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
          errors.push(errorMsg);
          
          results.push({
            platform: this.getAccount(accountId)?.platform || 'unknown',
            success: false,
            error: errorMsg
          });
        }
      }

      const success = results.some(r => r.success);

      return {
        success,
        results,
        generatedContent,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('Erro geral na publicação:', error);
      return {
        success: false,
        results,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido']
      };
    }
  }

  /**
   * Obtém URL de autorização para uma plataforma
   */
  getAuthUrl(platform: string, state?: string): string {
    switch (platform.toLowerCase()) {
      case 'tiktok':
        return this.tiktokAuth.getAuthUrl(state);
      case 'instagram':
        return this.instagramAuth.getAuthUrl(state);
      case 'youtube':
        return this.youtubeAuth.getAuthUrl(state);
      default:
        throw new Error(`Plataforma não suportada: ${platform}`);
    }
  }

  /**
   * Lista contas conectadas
   */
  getConnectedAccounts(): SocialMediaAccount[] {
    const stmt = this.db.prepare('SELECT * FROM social_accounts WHERE is_active = 1 ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      platform: row.platform,
      accountId: row.account_id,
      accountName: row.account_name,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at ? new Date(row.expires_at * 1000) : undefined,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000)
    }));
  }

  /**
   * Desconecta uma conta
   */
  async disconnectAccount(accountId: string): Promise<boolean> {
    try {
      const account = this.getAccount(accountId);
      if (!account) return false;

      // Revoga o token na plataforma
      switch (account.platform) {
        case 'tiktok':
          await this.tiktokAuth.revokeToken(account.accessToken);
          break;
        case 'youtube':
          await this.youtubeAuth.revokeToken(account.accessToken);
          break;
        // Instagram não tem revogação direta via API
      }

      // Marca como inativa no banco
      const stmt = this.db.prepare('UPDATE social_accounts SET is_active = 0, updated_at = ? WHERE id = ?');
      stmt.run(Math.floor(Date.now() / 1000), accountId);

      return true;
    } catch (error) {
      console.error('Erro ao desconectar conta:', error);
      return false;
    }
  }

  /**
   * Gera conteúdo com IA
   */
  async generateContentWithAI(
    videoPath: string,
    platforms: string[],
    options: {
      tone: string;
      targetAudience: string;
      keywords?: string[];
    }
  ): Promise<any> {
    if (!this.contentGenerator) {
      throw new Error('Gerador de conteúdo não configurado. Forneça uma API key do Gemini.');
    }

    return this.contentGenerator.analyzeVideoAndGenerateContent(
      videoPath,
      platforms,
      {
        tone: options.tone as any,
        targetAudience: options.targetAudience,
        keywords: options.keywords,
      }
    );
  }

  // Métodos privados auxiliares

  private saveAccount(account: SocialMediaAccount): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO social_accounts 
      (id, platform, account_id, account_name, access_token, refresh_token, expires_at, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      account.id,
      account.platform,
      account.accountId,
      account.accountName,
      account.accessToken,
      account.refreshToken || null,
      account.expiresAt ? Math.floor(account.expiresAt.getTime() / 1000) : null,
      account.isActive ? 1 : 0,
      Math.floor(account.createdAt.getTime() / 1000),
      Math.floor(account.updatedAt.getTime() / 1000)
    );
  }

  private getAccount(accountId: string): SocialMediaAccount | null {
    const stmt = this.db.prepare('SELECT * FROM social_accounts WHERE id = ? AND is_active = 1');
    const row = stmt.get(accountId) as any;
    
    if (!row) return null;

    return {
      id: row.id,
      platform: row.platform,
      accountId: row.account_id,
      accountName: row.account_name,
      accessToken: row.access_token,
      refreshToken: row.refresh_token,
      expiresAt: row.expires_at ? new Date(row.expires_at * 1000) : undefined,
      isActive: Boolean(row.is_active),
      createdAt: new Date(row.created_at * 1000),
      updatedAt: new Date(row.updated_at * 1000)
    };
  }

  private async getAccountPlatforms(accountIds: string[]): Promise<string[]> {
    const platforms = new Set<string>();
    for (const id of accountIds) {
      const account = this.getAccount(id);
      if (account) {
        platforms.add(account.platform);
      }
    }
    return Array.from(platforms);
  }

  private async refreshTokenIfNeeded(account: SocialMediaAccount): Promise<void> {
    if (!account.expiresAt || !account.refreshToken) return;

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    
    if (account.expiresAt <= fiveMinutesFromNow) {
      try {
        let newTokens: any;

        switch (account.platform) {
          case 'tiktok':
            newTokens = await this.tiktokAuth.refreshAccessToken(account.refreshToken);
            break;
          case 'instagram':
            newTokens = await this.instagramAuth.refreshLongLivedToken(account.accessToken);
            break;
          case 'youtube':
            newTokens = await this.youtubeAuth.refreshAccessToken(account.refreshToken);
            break;
        }

        if (newTokens) {
          account.accessToken = newTokens.access_token;
          if (newTokens.refresh_token) {
            account.refreshToken = newTokens.refresh_token;
          }
          if (newTokens.expires_in) {
            account.expiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
          } else if (newTokens.expiry_date) {
            account.expiresAt = new Date(newTokens.expiry_date);
          }
          account.updatedAt = new Date();

          this.saveAccount(account);
        }
      } catch (error) {
        console.error('Erro ao renovar token:', error);
      }
    }
  }

  private savePublicationResult(accountId: string, result: PublishResult): void {
    const stmt = this.db.prepare(`
      INSERT INTO publication_results 
      (id, publication_id, platform, account_id, post_id, post_url, status, error_message, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      'temp_publication_id', // Seria o ID real da publicação
      result.platform,
      accountId,
      result.postId || null,
      result.postUrl || null,
      result.success ? 'success' : 'failed',
      result.error || null,
      result.success ? Math.floor(Date.now() / 1000) : null
    );
  }

  // Métodos do Scheduler
  async schedulePost(content: PostContent, accounts: string[], scheduleOptions: ScheduleOptions): Promise<string> {
    return await this.scheduler.schedulePost(content, accounts, scheduleOptions);
  }

  async getScheduledPosts(filters?: any): Promise<any[]> {
    return await this.scheduler.getScheduledPosts(filters);
  }

  async cancelScheduledPost(postId: string): Promise<boolean> {
    return await this.scheduler.cancelPost(postId);
  }

  async getSchedulerStats(): Promise<any> {
    return await this.scheduler.getStats();
  }

  startScheduler(): void {
    this.scheduler.start();
  }

  stopScheduler(): void {
    this.scheduler.stop();
  }

  // Métodos do Monitor
  async getPublicationLogs(filters?: any): Promise<any[]> {
    return await this.monitor.getLogs(filters);
  }

  async getSystemMetrics(): Promise<any> {
    return await this.monitor.getSystemMetrics();
  }

  async getAccountStats(accountId: string): Promise<any> {
    return await this.monitor.getAccountStats(accountId);
  }

  async exportLogs(format: 'csv' | 'json' = 'csv'): Promise<string> {
    if (format === 'csv') {
      return await this.monitor.exportLogsToCSV();
    }
    // Para JSON, retorna os logs como string
    const logs = await this.monitor.getLogs();
    return JSON.stringify(logs, null, 2);
  }

  // Método para preview de conteúdo
  async previewContent(content: PostContent, platform: string): Promise<any> {
    const preview = {
      platform,
      content: {
        title: content.title,
        description: content.description,
        hashtags: content.hashtags,
        videoPath: content.videoPath,
        thumbnailPath: content.thumbnailPath
      },
      estimatedReach: this.calculateEstimatedReach(platform, content.hashtags?.length || 0),
      suggestedImprovements: this.getSuggestedImprovements(content, platform)
    };

    return preview;
  }

  private calculateEstimatedReach(platform: string, hashtagCount: number): number {
    // Lógica simples para estimar alcance baseado na plataforma e hashtags
    const baseReach = {
      'tiktok': 1000,
      'instagram': 500,
      'youtube': 200
    };

    const base = baseReach[platform as keyof typeof baseReach] || 100;
    return base + (hashtagCount * 50);
  }

  private getSuggestedImprovements(content: PostContent, platform: string): string[] {
    const suggestions: string[] = [];

    if (!content.title || content.title.length < 10) {
      suggestions.push('Considere um título mais descritivo e atrativo');
    }

    if (!content.hashtags || content.hashtags.length < 3) {
      suggestions.push('Adicione mais hashtags relevantes para aumentar o alcance');
    }

    if (platform === 'youtube' && (!content.description || content.description.length < 100)) {
      suggestions.push('Descrições mais detalhadas performam melhor no YouTube');
    }

    if (platform === 'tiktok' && content.hashtags && !content.hashtags.some(tag => tag.toLowerCase().includes('fyp'))) {
      suggestions.push('Considere adicionar hashtags populares do TikTok como #fyp');
    }

    return suggestions;
  }

  private isVideoShort(videoPath: string): boolean {
    // Implementação simplificada - em produção, você analisaria a duração real do vídeo
    // Por enquanto, assume que vídeos com "short" no nome são Shorts
    return videoPath.toLowerCase().includes('short') || videoPath.toLowerCase().includes('reel');
  }
}
