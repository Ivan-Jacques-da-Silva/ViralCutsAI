import fs from 'fs';
import path from 'path';

interface PreviewSession {
  id: string;
  projectPath: string;
  createdAt: Date;
  lastAccessed: Date;
  isActive: boolean;
}

export class PreviewManager {
  private sessions: Map<string, PreviewSession> = new Map();

  async createPreviewSession(projectPath: string): Promise<PreviewSession> {
    const sessionId = this.generateSessionId();
    
    const session: PreviewSession = {
      id: sessionId,
      projectPath,
      createdAt: new Date(),
      lastAccessed: new Date(),
      isActive: true,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  private generateSessionId(): string {
    return Date.now().toString();
  }

  getSession(sessionId: string): PreviewSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): PreviewSession[] {
    return Array.from(this.sessions.values());
  }

  async stopPreviewSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isActive = false;
    this.sessions.delete(sessionId);

    console.log(`Preview session ${sessionId} stopped`);
  }
}