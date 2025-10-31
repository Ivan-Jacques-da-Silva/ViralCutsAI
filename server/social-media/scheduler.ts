import { Database } from 'better-sqlite3';
import cron from 'node-cron';
import { SocialMediaManager } from './social-media-manager';

export interface ScheduledPost {
  id: string;
  videoPath: string;
  title: string;
  description: string;
  hashtags: string[];
  accounts: string[];
  privacy: string;
  scheduledFor: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  publishedAt?: Date;
  error?: string;
  results?: any[];
}

export interface ScheduleOptions {
  videoPath: string;
  title: string;
  description: string;
  hashtags: string[];
  accounts: string[];
  privacy: string;
  scheduledFor: Date;
  generateContent?: boolean;
  contentOptions?: {
    tone: string;
    targetAudience: string;
    keywords: string[];
  };
}

export class PostScheduler {
  private db: Database;
  private socialMediaManager: SocialMediaManager;
  private isRunning: boolean = false;

  constructor(db: Database, socialMediaManager: SocialMediaManager) {
    this.db = db;
    this.socialMediaManager = socialMediaManager;
    this.initializeDatabase();
    this.startScheduler();
  }

  private initializeDatabase() {
    // Tabela para posts agendados
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scheduled_posts (
        id TEXT PRIMARY KEY,
        video_path TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        hashtags TEXT NOT NULL,
        accounts TEXT NOT NULL,
        privacy TEXT DEFAULT 'public',
        scheduled_for DATETIME NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        published_at DATETIME,
        error TEXT,
        results TEXT
      )
    `);

    // Índices para performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON scheduled_posts(status);
      CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_for ON scheduled_posts(scheduled_for);
    `);
  }

  /**
   * Agenda uma nova publicação
   */
  schedulePost(options: ScheduleOptions): string {
    const id = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO scheduled_posts (
        id, video_path, title, description, hashtags, accounts, 
        privacy, scheduled_for, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
    `);

    stmt.run(
      id,
      options.videoPath,
      options.title,
      options.description,
      JSON.stringify(options.hashtags),
      JSON.stringify(options.accounts),
      options.privacy,
      options.scheduledFor.toISOString()
    );

    console.log(`Post agendado com ID: ${id} para ${options.scheduledFor}`);
    return id;
  }

  /**
   * Lista posts agendados
   */
  getScheduledPosts(status?: string): ScheduledPost[] {
    let query = 'SELECT * FROM scheduled_posts';
    const params: any[] = [];

    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }

    query += ' ORDER BY scheduled_for ASC';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      videoPath: row.video_path,
      title: row.title,
      description: row.description,
      hashtags: JSON.parse(row.hashtags),
      accounts: JSON.parse(row.accounts),
      privacy: row.privacy,
      scheduledFor: new Date(row.scheduled_for),
      status: row.status,
      createdAt: new Date(row.created_at),
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      error: row.error,
      results: row.results ? JSON.parse(row.results) : undefined
    }));
  }

  /**
   * Obtém um post agendado por ID
   */
  getScheduledPost(id: string): ScheduledPost | null {
    const stmt = this.db.prepare('SELECT * FROM scheduled_posts WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      videoPath: row.video_path,
      title: row.title,
      description: row.description,
      hashtags: JSON.parse(row.hashtags),
      accounts: JSON.parse(row.accounts),
      privacy: row.privacy,
      scheduledFor: new Date(row.scheduled_for),
      status: row.status,
      createdAt: new Date(row.created_at),
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      error: row.error,
      results: row.results ? JSON.parse(row.results) : undefined
    };
  }

  /**
   * Cancela um post agendado
   */
  cancelScheduledPost(id: string): boolean {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts 
      SET status = 'cancelled' 
      WHERE id = ? AND status = 'pending'
    `);

    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Atualiza o status de um post agendado
   */
  private updatePostStatus(id: string, status: string, error?: string, results?: any[]) {
    const stmt = this.db.prepare(`
      UPDATE scheduled_posts 
      SET status = ?, error = ?, results = ?, published_at = ?
      WHERE id = ?
    `);

    stmt.run(
      status,
      error || null,
      results ? JSON.stringify(results) : null,
      status === 'completed' ? new Date().toISOString() : null,
      id
    );
  }

  /**
   * Inicia o scheduler
   */
  private startScheduler() {
    if (this.isRunning) return;

    // Executa a cada minuto
    cron.schedule('* * * * *', () => {
      this.processPendingPosts();
    });

    this.isRunning = true;
    console.log('Scheduler de publicações iniciado');
  }

  /**
   * Processa posts pendentes que devem ser publicados
   */
  private async processPendingPosts() {
    const now = new Date();
    const stmt = this.db.prepare(`
      SELECT * FROM scheduled_posts 
      WHERE status = 'pending' AND scheduled_for <= ?
      ORDER BY scheduled_for ASC
    `);

    const pendingPosts = stmt.all(now.toISOString()) as any[];

    for (const postData of pendingPosts) {
      await this.processScheduledPost(postData);
    }
  }

  /**
   * Processa um post agendado individual
   */
  private async processScheduledPost(postData: any) {
    const post: ScheduledPost = {
      id: postData.id,
      videoPath: postData.video_path,
      title: postData.title,
      description: postData.description,
      hashtags: JSON.parse(postData.hashtags),
      accounts: JSON.parse(postData.accounts),
      privacy: postData.privacy,
      scheduledFor: new Date(postData.scheduled_for),
      status: postData.status,
      createdAt: new Date(postData.created_at)
    };

    console.log(`Processando post agendado: ${post.id}`);

    try {
      // Atualiza status para processando
      this.updatePostStatus(post.id, 'processing');

      // Publica o conteúdo
      const results = await this.socialMediaManager.publishContent({
        videoPath: post.videoPath,
        title: post.title,
        description: post.description,
        hashtags: post.hashtags,
        accounts: post.accounts,
        privacy: post.privacy,
        generateContent: false // Posts agendados já têm conteúdo definido
      });

      // Verifica se houve sucesso em pelo menos uma plataforma
      const hasSuccess = results.some(result => result.success);

      if (hasSuccess) {
        this.updatePostStatus(post.id, 'completed', undefined, results);
        console.log(`Post ${post.id} publicado com sucesso`);
      } else {
        const errors = results.map(r => r.error).filter(Boolean).join(', ');
        this.updatePostStatus(post.id, 'failed', errors, results);
        console.error(`Falha ao publicar post ${post.id}: ${errors}`);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      this.updatePostStatus(post.id, 'failed', errorMessage);
      console.error(`Erro ao processar post agendado ${post.id}:`, error);
    }
  }

  /**
   * Para o scheduler
   */
  stop() {
    this.isRunning = false;
    console.log('Scheduler de publicações parado');
  }

  /**
   * Obtém estatísticas do scheduler
   */
  getStats() {
    const stats = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    const stmt = this.db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM scheduled_posts 
      GROUP BY status
    `);

    const rows = stmt.all() as any[];

    rows.forEach(row => {
      stats[row.status as keyof typeof stats] = row.count;
      stats.total += row.count;
    });

    return stats;
  }

  /**
   * Remove posts antigos (mais de 30 dias)
   */
  cleanupOldPosts() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stmt = this.db.prepare(`
      DELETE FROM scheduled_posts 
      WHERE created_at < ? AND status IN ('completed', 'failed', 'cancelled')
    `);

    const result = stmt.run(thirtyDaysAgo.toISOString());
    console.log(`Removidos ${result.changes} posts antigos`);

    return result.changes;
  }
}