import axios from 'axios';
import { socialMediaConfig } from '../config';

export class InstagramAuth {
  private config = socialMediaConfig.instagram;
  private baseUrl = 'https://api.instagram.com';
  private graphUrl = 'https://graph.facebook.com/v18.0';

  /**
   * Gera a URL de autorização para o Instagram
   */
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(','),
      response_type: 'code',
      state: state || 'default_state'
    });

    return `${this.baseUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Troca o código de autorização por um token de acesso de curta duração
   */
  async exchangeCodeForShortToken(code: string): Promise<{
    access_token: string;
    user_id: number;
  }> {
    try {
      const response = await axios.post(`${this.baseUrl}/oauth/access_token`, {
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
        code: code
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data.error) {
        throw new Error(`Instagram OAuth Error: ${response.data.error_description}`);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao trocar código por token do Instagram:', error);
      throw error;
    }
  }

  /**
   * Converte token de curta duração em token de longa duração
   */
  async exchangeForLongLivedToken(shortToken: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }> {
    try {
      const response = await axios.get(`${this.graphUrl}/access_token`, {
        params: {
          grant_type: 'ig_exchange_token',
          client_secret: this.config.clientSecret,
          access_token: shortToken
        }
      });

      if (response.data.error) {
        throw new Error(`Instagram Long-lived Token Error: ${response.data.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao obter token de longa duração do Instagram:', error);
      throw error;
    }
  }

  /**
   * Atualiza o token de longa duração
   */
  async refreshLongLivedToken(longLivedToken: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }> {
    try {
      const response = await axios.get(`${this.graphUrl}/refresh_access_token`, {
        params: {
          grant_type: 'ig_refresh_token',
          access_token: longLivedToken
        }
      });

      if (response.data.error) {
        throw new Error(`Instagram Refresh Token Error: ${response.data.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar token do Instagram:', error);
      throw error;
    }
  }

  /**
   * Obtém informações do usuário autenticado
   */
  async getUserInfo(accessToken: string): Promise<{
    id: string;
    username: string;
    account_type: string;
    media_count: number;
  }> {
    try {
      const response = await axios.get(`${this.graphUrl}/me`, {
        params: {
          fields: 'id,username,account_type,media_count',
          access_token: accessToken
        }
      });

      if (response.data.error) {
        throw new Error(`Instagram User Info Error: ${response.data.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao obter informações do usuário Instagram:', error);
      throw error;
    }
  }

  /**
   * Obtém as páginas do Facebook associadas (necessário para Instagram Business)
   */
  async getFacebookPages(accessToken: string): Promise<Array<{
    id: string;
    name: string;
    access_token: string;
    instagram_business_account?: {
      id: string;
    };
  }>> {
    try {
      const response = await axios.get(`${this.graphUrl}/me/accounts`, {
        params: {
          fields: 'id,name,access_token,instagram_business_account{id}',
          access_token: accessToken
        }
      });

      if (response.data.error) {
        throw new Error(`Facebook Pages Error: ${response.data.error.message}`);
      }

      return response.data.data;
    } catch (error) {
      console.error('Erro ao obter páginas do Facebook:', error);
      throw error;
    }
  }

  /**
   * Obtém informações da conta Instagram Business
   */
  async getInstagramBusinessAccount(
    pageAccessToken: string,
    instagramAccountId: string
  ): Promise<{
    id: string;
    username: string;
    name: string;
    profile_picture_url: string;
    followers_count: number;
    media_count: number;
  }> {
    try {
      const response = await axios.get(`${this.graphUrl}/${instagramAccountId}`, {
        params: {
          fields: 'id,username,name,profile_picture_url,followers_count,media_count',
          access_token: pageAccessToken
        }
      });

      if (response.data.error) {
        throw new Error(`Instagram Business Account Error: ${response.data.error.message}`);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao obter conta Instagram Business:', error);
      throw error;
    }
  }

  /**
   * Verifica se o token ainda é válido
   */
  async validateToken(accessToken: string): Promise<boolean> {
    try {
      await this.getUserInfo(accessToken);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtém informações sobre o token (incluindo tempo de expiração)
   */
  async getTokenInfo(accessToken: string): Promise<{
    app_id: string;
    type: string;
    application: string;
    data_access_expires_at: number;
    expires_at: number;
    is_valid: boolean;
    scopes: string[];
    user_id: string;
  }> {
    try {
      const response = await axios.get(`${this.graphUrl}/debug_token`, {
        params: {
          input_token: accessToken,
          access_token: `${this.config.clientId}|${this.config.clientSecret}`
        }
      });

      if (response.data.error) {
        throw new Error(`Token Info Error: ${response.data.error.message}`);
      }

      return response.data.data;
    } catch (error) {
      console.error('Erro ao obter informações do token:', error);
      throw error;
    }
  }
}