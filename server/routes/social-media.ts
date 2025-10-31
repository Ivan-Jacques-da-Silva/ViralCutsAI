import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { SocialMediaManager, PublishRequest } from '../social-media/social-media-manager';

const router = express.Router();

// Configuração do multer para upload de vídeos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'social-media');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `video-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|wmv|flv|webm|mkv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas arquivos de vídeo são permitidos!'));
    }
  }
});

// Inicializa o gerenciador de redes sociais
const dbPath = path.join(process.cwd(), 'data', 'social-media.db');
const geminiApiKey = process.env.GEMINI_API_KEY;

// Cria diretório de dados se não existir
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const socialMediaManager = new SocialMediaManager(dbPath, geminiApiKey);

/**
 * GET /api/social-media/platforms
 * Lista plataformas disponíveis
 */
router.get('/platforms', (req, res) => {
  res.json({
    success: true,
    platforms: [
      {
        id: 'tiktok',
        name: 'TikTok',
        description: 'Publique vídeos curtos e virais',
        icon: '🎵',
        maxDuration: 180, // 3 minutos
        supportedFormats: ['mp4', 'mov', 'avi']
      },
      {
        id: 'instagram',
        name: 'Instagram',
        description: 'Publique Reels e posts',
        icon: '📸',
        maxDuration: 90, // 1.5 minutos para Reels
        supportedFormats: ['mp4', 'mov']
      },
      {
        id: 'youtube',
        name: 'YouTube',
        description: 'Publique vídeos e Shorts',
        icon: '📺',
        maxDuration: null, // Sem limite
        supportedFormats: ['mp4', 'mov', 'avi', 'wmv', 'flv', 'webm', 'mkv']
      },
      {
        id: 'facebook',
        name: 'Facebook',
        description: 'Publique vídeos na sua página',
        icon: '👥',
        maxDuration: 240, // 4 minutos
        supportedFormats: ['mp4', 'mov', 'avi']
      }
    ]
  });
});

/**
 * GET /api/social-media/auth/:platform
 * Obtém URL de autorização para uma plataforma
 */
router.get('/auth/:platform', (req, res) => {
  try {
    const { platform } = req.params;
    const { state } = req.query;
    
    const authUrl = socialMediaManager.getAuthUrl(platform, state as string);
    
    res.json({
      success: true,
      authUrl,
      platform
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

/**
 * POST /api/social-media/auth/:platform/callback
 * Processa callback de autorização
 */
router.post('/auth/:platform/callback', async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Código de autorização não fornecido'
      });
    }
    
    const account = await socialMediaManager.connectAccount(platform, code, state as string | undefined);
    
    res.json({
      success: true,
      account: {
        id: account.id,
        platform: account.platform,
        accountName: account.accountName,
        isActive: account.isActive,
        createdAt: account.createdAt
      }
    });
  } catch (error) {
    console.error('Erro no callback de autorização:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao conectar conta'
    });
  }
});

/**
 * GET /auth/:platform/callback
 * Facilita o callback direto do provedor (ex.: TikTok) via querystring
 */
router.get('/auth/:platform/callback', async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    const account = await socialMediaManager.connectAccount(platform, code, state);

    // Responde com uma página simples que fecha o popup
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html><html><body>
      <script>
        try { window.opener && window.opener.postMessage({ type: 'social-auth', platform: '${platform}', success: true }, '*'); } catch {}
        window.close();
      </script>
      <p>Conta conectada. Você pode fechar esta janela.</p>
    </body></html>`);
  } catch (error) {
    console.error('Erro no callback GET de autorização:', error);
    res.status(500).send('Erro ao conectar conta');
  }
});

/**
 * GET /api/social-media/accounts
 * Lista contas conectadas
 */
router.get('/accounts', (req, res) => {
  try {
    const accounts = socialMediaManager.getConnectedAccounts();
    
    res.json({
      success: true,
      accounts: accounts.map(account => ({
        id: account.id,
        platform: account.platform,
        accountName: account.accountName,
        isActive: account.isActive,
        createdAt: account.createdAt,
        expiresAt: account.expiresAt
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao listar contas'
    });
  }
});

/**
 * DELETE /api/social-media/accounts/:accountId
 * Desconecta uma conta
 */
router.delete('/accounts/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const success = await socialMediaManager.disconnectAccount(accountId);
    
    if (success) {
      res.json({
        success: true,
        message: 'Conta desconectada com sucesso'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Conta não encontrada'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao desconectar conta'
    });
  }
});

/**
 * POST /api/social-media/generate-content
 * Gera conteúdo com IA
 */
router.post('/generate-content', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Arquivo de vídeo é obrigatório'
      });
    }

    const { platforms, tone, targetAudience, keywords } = req.body;
    
    if (!platforms) {
      return res.status(400).json({
        success: false,
        error: 'Plataformas são obrigatórias'
      });
    }

    const platformList = Array.isArray(platforms) ? platforms : JSON.parse(platforms);
    const keywordList = keywords ? (Array.isArray(keywords) ? keywords : JSON.parse(keywords)) : undefined;

    const generatedContent = await socialMediaManager.generateContentWithAI(
      req.file.path,
      platformList,
      {
        tone: tone || 'casual',
        targetAudience: targetAudience || 'geral',
        keywords: keywordList
      }
    );

    res.json({
      success: true,
      content: generatedContent,
      videoPath: req.file.path
    });
  } catch (error) {
    console.error('Erro ao gerar conteúdo:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar conteúdo'
    });
  }
});

/**
 * POST /api/social-media/publish
 * Publica conteúdo em redes sociais
 */
router.post('/publish', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Arquivo de vídeo é obrigatório'
      });
    }

    const {
      title,
      description,
      hashtags,
      accounts,
      privacy,
      generateContent,
      contentOptions
    } = req.body;

    if (!accounts || !Array.isArray(JSON.parse(accounts)) || JSON.parse(accounts).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Pelo menos uma conta deve ser selecionada'
      });
    }

    const publishRequest: PublishRequest = {
      content: {
        title: title || 'Vídeo sem título',
        description: description || '',
        videoPath: req.file.path,
        hashtags: hashtags ? JSON.parse(hashtags) : [],
        privacy: privacy || 'public'
      },
      accounts: JSON.parse(accounts),
      generateContent: generateContent === 'true',
      contentOptions: contentOptions ? JSON.parse(contentOptions) : undefined
    };

    const result = await socialMediaManager.publishContent(publishRequest);

    res.json(result);
  } catch (error) {
    console.error('Erro ao publicar conteúdo:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao publicar conteúdo'
    });
  }
});

/**
 * POST /api/social-media/preview
 * Gera preview do conteúdo antes da publicação
 */
router.post('/preview', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Arquivo de vídeo é obrigatório'
      });
    }

    const {
      title,
      description,
      hashtags,
      accounts,
      generateContent,
      contentOptions
    } = req.body;

    let finalContent = {
      title: title || 'Vídeo sem título',
      description: description || '',
      hashtags: hashtags ? JSON.parse(hashtags) : []
    };

    let generatedContent = null;

    // Gera conteúdo com IA se solicitado
    if (generateContent === 'true' && contentOptions) {
      const accountList = JSON.parse(accounts);
      const platforms = await Promise.all(
        accountList.map(async (accountId: string) => {
          const connectedAccounts = socialMediaManager.getConnectedAccounts();
          const account = connectedAccounts.find(acc => acc.id === accountId);
          return account?.platform || 'unknown';
        })
      );

      const options = JSON.parse(contentOptions);
      generatedContent = await socialMediaManager.generateContentWithAI(
        req.file.path,
        platforms.filter(p => p !== 'unknown'),
        options
      );

      // Aplica sugestões da IA
      if (generatedContent.suggestions.bestTitle) {
        finalContent.title = generatedContent.suggestions.bestTitle;
      }
      if (generatedContent.suggestions.bestDescription) {
        finalContent.description = generatedContent.suggestions.bestDescription;
      }
      if (generatedContent.suggestions.recommendedHashtags) {
        finalContent.hashtags = generatedContent.suggestions.recommendedHashtags;
      }
    }

    res.json({
      success: true,
      preview: {
        content: finalContent,
        generatedContent,
        videoInfo: {
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          path: req.file.path
        }
      }
    });
  } catch (error) {
    console.error('Erro ao gerar preview:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao gerar preview'
    });
  }
});

/**
 * GET /api/social-media/status
 * Verifica status do sistema
 */
router.get('/status', (req, res) => {
  const accounts = socialMediaManager.getConnectedAccounts();
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  res.json({
    success: true,
    status: {
      connectedAccounts: accounts.length,
      platforms: [...new Set(accounts.map(acc => acc.platform))],
      aiEnabled: hasGeminiKey,
      uptime: process.uptime(),
      version: '1.0.0'
    }
  });
});

/**
 * POST /api/social-media/schedule
 * Agenda uma publicação
 */
router.post('/schedule', upload.single('video'), async (req, res) => {
  try {
    const { content, accounts, scheduleOptions } = req.body;
    
    const parsedContent = JSON.parse(content);
    if (req.file) {
      parsedContent.videoPath = req.file.path;
    }

    const postId = await socialMediaManager.schedulePost(
      parsedContent,
      JSON.parse(accounts),
      JSON.parse(scheduleOptions)
    );

    res.json({ success: true, postId });
  } catch (error) {
    console.error('Erro ao agendar publicação:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

/**
 * GET /api/social-media/scheduled
 * Lista posts agendados
 */
router.get('/scheduled', async (req, res) => {
  try {
    const filters = req.query;
    const posts = await socialMediaManager.getScheduledPosts(filters);
    res.json({ success: true, posts });
  } catch (error) {
    console.error('Erro ao buscar posts agendados:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

/**
 * DELETE /api/social-media/scheduled/:postId
 * Cancela post agendado
 */
router.delete('/scheduled/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const success = await socialMediaManager.cancelScheduledPost(postId);
    res.json({ success });
  } catch (error) {
    console.error('Erro ao cancelar post agendado:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

/**
 * GET /api/social-media/scheduler/stats
 * Estatísticas do scheduler
 */
router.get('/scheduler/stats', async (req, res) => {
  try {
    const stats = await socialMediaManager.getSchedulerStats();
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Erro ao buscar estatísticas do scheduler:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

/**
 * GET /api/social-media/logs
 * Logs de publicação
 */
router.get('/logs', async (req, res) => {
  try {
    const filters = req.query;
    const logs = await socialMediaManager.getPublicationLogs(filters);
    res.json({ success: true, logs });
  } catch (error) {
    console.error('Erro ao buscar logs:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

/**
 * GET /api/social-media/metrics
 * Métricas do sistema
 */
router.get('/metrics', async (req, res) => {
  try {
    const metrics = await socialMediaManager.getSystemMetrics();
    res.json({ success: true, metrics });
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

/**
 * GET /api/social-media/accounts/:accountId/stats
 * Estatísticas de conta específica
 */
router.get('/accounts/:accountId/stats', async (req, res) => {
  try {
    const { accountId } = req.params;
    const stats = await socialMediaManager.getAccountStats(accountId);
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Erro ao buscar estatísticas da conta:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

/**
 * GET /api/social-media/logs/export
 * Exporta logs
 */
router.get('/logs/export', async (req, res) => {
  try {
    const format = req.query.format as 'csv' | 'json' || 'csv';
    const data = await socialMediaManager.exportLogs(format);
    
    const filename = `social-media-logs-${new Date().toISOString().split('T')[0]}.${format}`;
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(data);
  } catch (error) {
    console.error('Erro ao exportar logs:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

/**
 * POST /api/social-media/scheduler/start
 * Inicia o scheduler
 */
router.post('/scheduler/start', async (req, res) => {
  try {
    socialMediaManager.startScheduler();
    res.json({ success: true, message: 'Scheduler iniciado' });
  } catch (error) {
    console.error('Erro ao iniciar scheduler:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

/**
 * POST /api/social-media/scheduler/stop
 * Para o scheduler
 */
router.post('/scheduler/stop', async (req, res) => {
  try {
    socialMediaManager.stopScheduler();
    res.json({ success: true, message: 'Scheduler parado' });
  } catch (error) {
    console.error('Erro ao parar scheduler:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro interno do servidor' 
    });
  }
});

export default router;
