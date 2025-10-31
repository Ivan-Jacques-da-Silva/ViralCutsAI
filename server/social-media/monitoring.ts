import { Database } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface PublicationLog {
  id: string;
  postId?: string;
  platform: string;
  accountId: string;
  action: 'publish' | 'update' | 'delete' | 'auth' | 'error';
  status: 'success' | 'error' | 'warning' | 'info';
  message: string;
  details?: any;
  timestamp: Date;
  duration?: number;
  metadata?: {
    videoPath?: string;
    title?: string;
    fileSize?: number;
    platform_post_id?: string;
    platform_post_url?: string;
    error_code?: string;
    retry_count?: number;
  };
}

export interface SystemMetrics {
  totalPublications: number;
  successfulPublications: number;
  failedPublications: number;
  successRate: number;
  averagePublishTime: number;
  platformStats: Record<string, {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  }>;
  recentErrors: PublicationLog[];
  systemHealth: 'healthy' | 'warning' | 'critical';
}

export class PublicationMonitor {
  private db: Database;
  private logDir: string;

  constructor(db: Database, logDir: string = 'logs') {
    this.db = db;
    this.logDir = logDir;
    this.initializeDatabase();
    this.ensureLogDirectory();
  }

  private initializeDatabase() {
    // Tabela para logs de publicação
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS publication_logs (
        id TEXT PRIMARY KEY,
        post_id TEXT,
        platform TEXT NOT NULL,
        account_id TEXT NOT NULL,
        action TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        duration INTEGER,
        metadata TEXT
      )
    `);

    // Índices para performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_publication_logs_platform ON publication_logs(platform);
      CREATE INDEX IF NOT EXISTS idx_publication_logs_status ON publication_logs(status);
      CREATE INDEX IF NOT EXISTS idx_publication_logs_timestamp ON publication_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_publication_logs_account ON publication_logs(account_id);
    `);
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Registra um log de publicação
   */
  log(logData: Omit<PublicationLog, 'id' | 'timestamp'>): string {
    const id = `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date();

    const stmt = this.db.prepare(`
      INSERT INTO publication_logs (
        id, post_id, platform, account_id, action, status, 
        message, details, timestamp, duration, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      logData.postId || null,
      logData.platform,
      logData.accountId,
      logData.action,
      logData.status,
      logData.message,
      logData.details ? JSON.stringify(logData.details) : null,
      timestamp.toISOString(),
      logData.duration || null,
      logData.metadata ? JSON.stringify(logData.metadata) : null
    );

    // Também salva em arquivo de log
    this.writeToLogFile(id, { ...logData, id, timestamp });

    return id;
  }

  /**
   * Escreve log em arquivo
   */
  private writeToLogFile(id: string, logData: PublicationLog) {
    const logFileName = `social-media-${new Date().toISOString().split('T')[0]}.log`;
    const logFilePath = path.join(this.logDir, logFileName);

    const logEntry = {
      id,
      timestamp: logData.timestamp.toISOString(),
      platform: logData.platform,
      action: logData.action,
      status: logData.status,
      message: logData.message,
      details: logData.details,
      metadata: logData.metadata
    };

    const logLine = JSON.stringify(logEntry) + '\n';

    try {
      fs.appendFileSync(logFilePath, logLine);
    } catch (error) {
      console.error('Erro ao escrever log em arquivo:', error);
    }
  }

  /**
   * Obtém logs com filtros
   */
  getLogs(filters: {
    platform?: string;
    accountId?: string;
    status?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  } = {}): PublicationLog[] {
    let query = 'SELECT * FROM publication_logs WHERE 1=1';
    const params: any[] = [];

    if (filters.platform) {
      query += ' AND platform = ?';
      params.push(filters.platform);
    }

    if (filters.accountId) {
      query += ' AND account_id = ?';
      params.push(filters.accountId);
    }

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.action) {
      query += ' AND action = ?';
      params.push(filters.action);
    }

    if (filters.startDate) {
      query += ' AND timestamp >= ?';
      params.push(filters.startDate.toISOString());
    }

    if (filters.endDate) {
      query += ' AND timestamp <= ?';
      params.push(filters.endDate.toISOString());
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);

      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      postId: row.post_id,
      platform: row.platform,
      accountId: row.account_id,
      action: row.action,
      status: row.status,
      message: row.message,
      details: row.details ? JSON.parse(row.details) : undefined,
      timestamp: new Date(row.timestamp),
      duration: row.duration,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  /**
   * Obtém métricas do sistema
   */
  getSystemMetrics(days: number = 30): SystemMetrics {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Estatísticas gerais
    const generalStats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed,
        AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as avg_duration
      FROM publication_logs 
      WHERE action = 'publish' AND timestamp >= ?
    `).get(startDate.toISOString()) as any;

    // Estatísticas por plataforma
    const platformStats = this.db.prepare(`
      SELECT 
        platform,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed
      FROM publication_logs 
      WHERE action = 'publish' AND timestamp >= ?
      GROUP BY platform
    `).all(startDate.toISOString()) as any[];

    // Erros recentes
    const recentErrors = this.getLogs({
      status: 'error',
      startDate,
      limit: 10
    });

    // Calcula métricas
    const totalPublications = generalStats.total || 0;
    const successfulPublications = generalStats.successful || 0;
    const failedPublications = generalStats.failed || 0;
    const successRate = totalPublications > 0 ? (successfulPublications / totalPublications) * 100 : 0;
    const averagePublishTime = generalStats.avg_duration || 0;

    // Estatísticas por plataforma
    const platformStatsMap: Record<string, any> = {};
    platformStats.forEach(stat => {
      const platformSuccessRate = stat.total > 0 ? (stat.successful / stat.total) * 100 : 0;
      platformStatsMap[stat.platform] = {
        total: stat.total,
        successful: stat.successful,
        failed: stat.failed,
        successRate: platformSuccessRate
      };
    });

    // Determina saúde do sistema
    let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (successRate < 50) {
      systemHealth = 'critical';
    } else if (successRate < 80) {
      systemHealth = 'warning';
    }

    return {
      totalPublications,
      successfulPublications,
      failedPublications,
      successRate,
      averagePublishTime,
      platformStats: platformStatsMap,
      recentErrors,
      systemHealth
    };
  }

  /**
   * Obtém estatísticas de uma conta específica
   */
  getAccountStats(accountId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = this.db.prepare(`
      SELECT 
        platform,
        COUNT(*) as total_actions,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_actions,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as failed_actions,
        SUM(CASE WHEN action = 'publish' THEN 1 ELSE 0 END) as publications,
        AVG(CASE WHEN duration IS NOT NULL THEN duration ELSE NULL END) as avg_duration
      FROM publication_logs 
      WHERE account_id = ? AND timestamp >= ?
      GROUP BY platform
    `).all(accountId, startDate.toISOString()) as any[];

    return stats.map(stat => ({
      platform: stat.platform,
      totalActions: stat.total_actions,
      successfulActions: stat.successful_actions,
      failedActions: stat.failed_actions,
      publications: stat.publications,
      successRate: stat.total_actions > 0 ? (stat.successful_actions / stat.total_actions) * 100 : 0,
      averageDuration: stat.avg_duration || 0
    }));
  }

  /**
   * Obtém logs de erro detalhados
   */
  getErrorAnalysis(days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const errorsByPlatform = this.db.prepare(`
      SELECT 
        platform,
        COUNT(*) as error_count,
        GROUP_CONCAT(DISTINCT message) as error_messages
      FROM publication_logs 
      WHERE status = 'error' AND timestamp >= ?
      GROUP BY platform
      ORDER BY error_count DESC
    `).all(startDate.toISOString()) as any[];

    const errorsByType = this.db.prepare(`
      SELECT 
        message,
        COUNT(*) as occurrence_count,
        platform
      FROM publication_logs 
      WHERE status = 'error' AND timestamp >= ?
      GROUP BY message, platform
      ORDER BY occurrence_count DESC
      LIMIT 20
    `).all(startDate.toISOString()) as any[];

    return {
      errorsByPlatform: errorsByPlatform.map(row => ({
        platform: row.platform,
        errorCount: row.error_count,
        errorMessages: row.error_messages ? row.error_messages.split(',') : []
      })),
      errorsByType: errorsByType.map(row => ({
        message: row.message,
        occurrenceCount: row.occurrence_count,
        platform: row.platform
      }))
    };
  }

  /**
   * Limpa logs antigos
   */
  cleanupOldLogs(days: number = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const stmt = this.db.prepare(`
      DELETE FROM publication_logs 
      WHERE timestamp < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());
    console.log(`Removidos ${result.changes} logs antigos`);

    return result.changes;
  }

  /**
   * Exporta logs para arquivo CSV
   */
  exportLogs(filters: any = {}, filePath?: string): string {
    const logs = this.getLogs(filters);
    
    if (!filePath) {
      filePath = path.join(this.logDir, `export_${Date.now()}.csv`);
    }

    const csvHeader = 'ID,Timestamp,Platform,Account,Action,Status,Message,Duration,PostID,Metadata\n';
    const csvRows = logs.map(log => {
      const metadata = log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : '';
      return [
        log.id,
        log.timestamp.toISOString(),
        log.platform,
        log.accountId,
        log.action,
        log.status,
        `"${log.message.replace(/"/g, '""')}"`,
        log.duration || '',
        log.postId || '',
        `"${metadata}"`
      ].join(',');
    }).join('\n');

    const csvContent = csvHeader + csvRows;
    fs.writeFileSync(filePath, csvContent);

    return filePath;
  }
}