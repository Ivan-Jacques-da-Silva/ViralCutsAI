import axios from 'axios';
import crypto from 'crypto';
import { socialMediaConfig } from '../config';
import { SocialMediaAccount } from '../config';

export class TikTokAuth {
  private config = socialMediaConfig.tiktok;
  private baseUrl = 'https://www.tiktok.com/v2/auth/authorize/';
  private tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
  private pkceStore: Map<string, { verifier: string; createdAt: number }> = new Map();

  private generateState(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateCodeVerifier(): string {
    return crypto.randomBytes(64).toString('base64url');
  }

  /**
   * Gera a URL de autorização para o TikTok
   */
  getAuthUrl(state?: string): string {
    const finalState = state || this.generateState();
    const verifier = this.generateCodeVerifier();
    this.pkceStore.set(finalState, { verifier, createdAt: Date.now() });

    const challenge = crypto
      .createHash('sha256')
      .update(verifier)
      .digest('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

    const params = new URLSearchParams({
      client_key: this.config.clientId,
      scope: this.config.scope.join(' '),
      response_type: 'code',
      redirect_uri: this.config.redirectUri,
      state: finalState,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    return `${this.baseUrl}?${params.toString()}`;
  }

  /**
   * Troca o código de autorização por tokens de acesso
   */
  async exchangeCodeForTokens(code: string, state?: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
  }> {
    try {
      const verifier = state ? this.pkceStore.get(state)?.verifier : undefined;
      if (!verifier) {
        throw new Error('PKCE code_verifier não encontrado para o state. Reinicie a autenticação.');
      }

      const body = new URLSearchParams({
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: this.config.redirectUri,
        code_verifier: verifier
      });

      const response = await axios.post(this.tokenUrl, body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data.error) {
        throw new Error(`TikTok OAuth Error: ${response.data.error_description}`);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao trocar código por tokens do TikTok:', error);
      throw error;
    }
  }

  /**
   * Atualiza o token de acesso usando o refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
  }> {
    try {
      const response = await axios.post(this.tokenUrl, {
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data.error) {
        throw new Error(`TikTok Refresh Token Error: ${response.data.error_description}`);
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar token do TikTok:', error);
      throw error;
    }
  }

  /**
   * Obtém informações do usuário autenticado
   */
  async getUserInfo(accessToken: string): Promise<{
    open_id: string;
    union_id: string;
    avatar_url: string;
    display_name: string;
    username: string;
  }> {
    try {
      const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        params: {
          fields: 'open_id,union_id,avatar_url,display_name,username'
        }
      });

      if (response.data.error) {
        throw new Error(`TikTok User Info Error: ${response.data.error.message}`);
      }

      return response.data.data.user;
    } catch (error) {
      console.error('Erro ao obter informações do usuário TikTok:', error);
      throw error;
    }
  }

  /**
   * Revoga o token de acesso
   */
  async revokeToken(accessToken: string): Promise<boolean> {
    try {
      const response = await axios.post('https://open.tiktokapis.com/v2/oauth/revoke/', {
        client_key: this.config.clientId,
        client_secret: this.config.clientSecret,
        token: accessToken
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return response.status === 200;
    } catch (error) {
      console.error('Erro ao revogar token do TikTok:', error);
      return false;
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
}

