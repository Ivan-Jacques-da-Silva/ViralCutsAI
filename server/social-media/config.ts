// Configurações das APIs das redes sociais
export interface SocialMediaConfig {
  tiktok: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
  instagram: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
  youtube: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
  facebook: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scope: string[];
  };
}

export const socialMediaConfig: SocialMediaConfig = {
  tiktok: {
    clientId: process.env.TIKTOK_CLIENT_ID || '',
    clientSecret: process.env.TIKTOK_CLIENT_SECRET || '',
    redirectUri: process.env.TIKTOK_REDIRECT_URI || 'http://localhost:5000/auth/tiktok/callback',
    scope: ['user.info.basic', 'video.upload', 'video.publish']
  },
  instagram: {
    clientId: process.env.INSTAGRAM_CLIENT_ID || '',
    clientSecret: process.env.INSTAGRAM_CLIENT_SECRET || '',
    redirectUri: process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:5000/auth/instagram/callback',
    scope: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'business_management']
  },
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID || '',
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET || '',
    redirectUri: process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:5000/auth/youtube/callback',
    scope: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube']
  },
  facebook: {
    clientId: process.env.FACEBOOK_CLIENT_ID || '',
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
    redirectUri: process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:5000/auth/facebook/callback',
    scope: ['pages_manage_posts', 'pages_read_engagement', 'business_management']
  }
};

export interface SocialMediaAccount {
  id: string;
  platform: 'tiktok' | 'instagram' | 'youtube' | 'facebook';
  accountId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostContent {
  title: string;
  description: string;
  hashtags: string[];
  videoPath: string;
  thumbnailPath?: string;
  platforms: string[];
  scheduledAt?: Date;
  privacy: 'public' | 'private' | 'unlisted';
}

export interface PublishResult {
  platform: string;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}