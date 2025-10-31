import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { socialMediaConfig } from '../config';

export class YouTubeAuth {
  private config = socialMediaConfig.youtube;
  private oauth2Client: any;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      this.config.redirectUri
    );
  }

  /**
   * Gera a URL de autorização para o YouTube
   */
  getAuthUrl(state?: string): string {
    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline', // Necessário para refresh token
      scope: this.config.scope,
      state: state || 'default_state',
      prompt: 'consent' // Força a tela de consentimento para obter refresh token
    });

    return authUrl;
  }

  /**
   * Troca o código de autorização por tokens de acesso
   */
  async exchangeCodeForTokens(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    scope: string;
    token_type: string;
    expiry_date: number;
  }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token) {
        throw new Error('Não foi possível obter o token de acesso');
      }

      // Define as credenciais no cliente OAuth2
      this.oauth2Client.setCredentials(tokens);

      return {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope || this.config.scope.join(' '),
        token_type: tokens.token_type || 'Bearer',
        expiry_date: tokens.expiry_date || Date.now() + 3600000 // 1 hora por padrão
      };
    } catch (error) {
      console.error('Erro ao trocar código por tokens do YouTube:', error);
      throw error;
    }
  }

  /**
   * Atualiza o token de acesso usando o refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    expiry_date: number;
    token_type: string;
  }> {
    try {
      this.oauth2Client.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      return {
        access_token: credentials.access_token!,
        expiry_date: credentials.expiry_date!,
        token_type: credentials.token_type || 'Bearer'
      };
    } catch (error) {
      console.error('Erro ao atualizar token do YouTube:', error);
      throw error;
    }
  }

  /**
   * Obtém informações do canal do usuário autenticado
   */
  async getChannelInfo(accessToken: string): Promise<{
    id: string;
    title: string;
    description: string;
    customUrl?: string;
    thumbnails: any;
    statistics: {
      viewCount: string;
      subscriberCount: string;
      videoCount: string;
    };
  }> {
    try {
      // Configura as credenciais
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });

      const response = await youtube.channels.list({
        part: ['snippet', 'statistics', 'contentDetails'],
        mine: true
      });

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('Nenhum canal encontrado para este usuário');
      }

      const channel = response.data.items[0];

      return {
        id: channel.id!,
        title: channel.snippet!.title!,
        description: channel.snippet!.description!,
        customUrl: channel.snippet!.customUrl,
        thumbnails: channel.snippet!.thumbnails,
        statistics: {
          viewCount: channel.statistics!.viewCount!,
          subscriberCount: channel.statistics!.subscriberCount!,
          videoCount: channel.statistics!.videoCount!
        }
      };
    } catch (error) {
      console.error('Erro ao obter informações do canal YouTube:', error);
      throw error;
    }
  }

  /**
   * Verifica se o token ainda é válido
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getChannelInfo(accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoga o token de acesso
   */
  async revokeToken(accessToken: string): Promise<boolean> {
    try {
      this.oauth2Client.setCredentials({
        access_token: accessToken
      });

      await this.oauth2Client.revokeCredentials();
      return true;
    } catch (error) {
      console.error('Erro ao revogar token do YouTube:', error);
      return false;
    }
  }

  /**
   * Carrega credenciais de um arquivo JSON (client_secrets.json)
   */
  static loadCredentialsFromFile(filePath: string): {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  } {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`Arquivo de credenciais não encontrado: ${filePath}`);
      }

      const credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      // Suporte para diferentes formatos de arquivo de credenciais
      let clientInfo;
      if (credentials.web) {
        clientInfo = credentials.web;
      } else if (credentials.installed) {
        clientInfo = credentials.installed;
      } else {
        clientInfo = credentials;
      }

      return {
        clientId: clientInfo.client_id,
        clientSecret: clientInfo.client_secret,
        redirectUri: clientInfo.redirect_uris ? clientInfo.redirect_uris[0] : clientInfo.redirect_uri
      };
    } catch (error) {
      console.error('Erro ao carregar credenciais do arquivo:', error);
      throw error;
    }
  }

  /**
   * Salva tokens em um arquivo para uso posterior
   */
  static saveTokensToFile(tokens: any, filePath: string): void {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(tokens, null, 2));
    } catch (error) {
      console.error('Erro ao salvar tokens no arquivo:', error);
      throw error;
    }
  }

  /**
   * Carrega tokens de um arquivo
   */
  static loadTokensFromFile(filePath: string): any {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }

      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.error('Erro ao carregar tokens do arquivo:', error);
      return null;
    }
  }

  /**
   * Obtém o cliente OAuth2 configurado
   */
  getOAuth2Client(): any {
    return this.oauth2Client;
  }

  /**
   * Define as credenciais no cliente OAuth2
   */
  setCredentials(credentials: any): void {
    this.oauth2Client.setCredentials(credentials);
  }

  /**
   * Verifica se o token está próximo do vencimento (dentro de 5 minutos)
   */
  isTokenExpiringSoon(expiryDate: number): boolean {
    const fiveMinutesFromNow = Date.now() + (5 * 60 * 1000);
    return expiryDate <= fiveMinutesFromNow;
  }
}