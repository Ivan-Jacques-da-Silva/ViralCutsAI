import crypto from 'crypto';

export interface OAuthProvider {
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret: string;
}

export const OAUTH_PROVIDERS: Record<string, () => OAuthProvider> = {
  youtube: () => ({
    name: 'youtube',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: [
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  }),
  instagram: () => ({
    name: 'instagram',
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: [
      'user_profile',
      'user_media'
    ],
    clientId: process.env.INSTAGRAM_CLIENT_ID || '',
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
  }),
  tiktok: () => ({
    name: 'tiktok',
    authUrl: 'https://www.tiktok.com/v2/auth/authorize',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token',
    scopes: [
      'user.info.basic',
      'video.list',
      'video.upload'
    ],
    clientId: process.env.TIKTOK_CLIENT_KEY || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
  }),
  facebook: () => ({
    name: 'facebook',
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: [
      'public_profile',
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts'
    ],
    clientId: process.env.FACEBOOK_APP_ID || '',
    clientSecret: process.env.FACEBOOK_APP_SECRET || '',
  }),
};

export function generateState(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function buildAuthorizationUrl(
  provider: OAuthProvider,
  state: string,
  redirectUri: string
): string {
  if (provider.name === 'tiktok') {
    const params = new URLSearchParams({
      client_key: provider.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(','),
      state,
    });
    return `${provider.authUrl}?${params.toString()}`;
  } else if (provider.name === 'instagram' || provider.name === 'facebook') {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(','),
      state,
    });
    return `${provider.authUrl}?${params.toString()}`;
  } else {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: provider.scopes.join(' '),
      state,
      access_type: 'offline',
      prompt: 'consent',
    });
    return `${provider.authUrl}?${params.toString()}`;
  }
}

export async function exchangeCodeForToken(
  provider: OAuthProvider,
  code: string,
  redirectUri: string
): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}> {
  if (provider.name === 'tiktok') {
    const body = {
      client_key: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    };

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body as any).toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    const data = await response.json();
    return {
      access_token: data.data?.access_token || data.access_token,
      refresh_token: data.data?.refresh_token || data.refresh_token,
      expires_in: data.data?.expires_in || data.expires_in,
      token_type: data.data?.token_type || data.token_type,
    };
  } else {
    const params = new URLSearchParams({
      client_id: provider.clientId,
      client_secret: provider.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to exchange code for token: ${error}`);
    }

    return await response.json();
  }
}

export async function getUserInfo(provider: string, accessToken: string): Promise<{
  id: string;
  name: string;
  username?: string;
  profile_picture?: string;
  email?: string;
}> {
  let url = '';
  let headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
  };

  switch (provider) {
    case 'youtube':
      url = 'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true';
      break;
    case 'instagram':
      url = 'https://graph.instagram.com/me?fields=id,username,account_type,media_count';
      break;
    case 'tiktok':
      url = 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name';
      break;
    case 'facebook':
      url = 'https://graph.facebook.com/me?fields=id,name,picture';
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }

  const data = await response.json();

  switch (provider) {
    case 'youtube':
      const channel = data.items?.[0];
      return {
        id: channel.id,
        name: channel.snippet.title,
        username: channel.snippet.customUrl,
        profile_picture: channel.snippet.thumbnails.default.url,
      };
    case 'instagram':
      return {
        id: data.id,
        name: data.username,
        username: data.username,
      };
    case 'tiktok':
      return {
        id: data.data.user.open_id,
        name: data.data.user.display_name,
        profile_picture: data.data.user.avatar_url,
      };
    case 'facebook':
      return {
        id: data.id,
        name: data.name,
        profile_picture: data.picture?.data?.url,
      };
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
