import OpensidianPlugin from '../../main';

export interface SessionData {
  id: string;
  title: string;
  messages: any[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  mode?: 'plan' | 'build';
  opencodeSessionId?: string;  // 关联的 OpenCode 会话 ID
}

export class StorageService {
  private plugin: OpensidianPlugin;
  private configDir: string;

  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
    this.configDir = '.opensidian';
  }

  async initialize(): Promise<void> {
    // Ensure config directory exists
    await this.ensureDirectory(this.configDir);
    await this.ensureDirectory(`${this.configDir}/sessions`);
    await this.ensureDirectory(`${this.configDir}/commands`);
    
    // Clean up old sessions if needed
    await this.cleanupOldSessions();
  }

  private async ensureDirectory(path: string): Promise<void> {
    const adapter = this.plugin.app.vault.adapter;
    const exists = await adapter.exists(path);
    if (!exists) {
      await adapter.mkdir(path);
    }
  }

  async saveSession(sessionId: string, data: SessionData): Promise<void> {
    const path = `${this.configDir}/sessions/${sessionId}.json`;
    await this.plugin.app.vault.adapter.write(
      path,
      JSON.stringify(data, null, 2)
    );
  }

  async loadSession(sessionId: string): Promise<SessionData | null> {
    const path = `${this.configDir}/sessions/${sessionId}.json`;
    try {
      const content = await this.plugin.app.vault.adapter.read(path);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async listSessions(): Promise<string[]> {
    const sessionsDir = `${this.configDir}/sessions`;
    try {
      const files = await this.plugin.app.vault.adapter.list(sessionsDir);
      const sessionIds = files.files
        .filter((f: string) => f.endsWith('.json'))
        .map((f: string) => {
          const parts = f.split('/');
          return parts[parts.length - 1].replace('.json', '');
        });
      
      // Sort by modification time (newest first)
      const sessionsWithTime: { id: string; time: number }[] = [];
      for (const id of sessionIds) {
        const session = await this.loadSession(id);
        if (session) {
          sessionsWithTime.push({ id, time: session.updatedAt || session.createdAt });
        }
      }
      
      sessionsWithTime.sort((a, b) => b.time - a.time);
      return sessionsWithTime.map(s => s.id);
    } catch {
      return [];
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const path = `${this.configDir}/sessions/${sessionId}.json`;
    
    // Load session to get OpenCode session ID
    const session = await this.loadSession(sessionId);
    
    // Delete from vault
    try {
      await this.plugin.app.vault.adapter.remove(path);
    } catch (error) {
      console.error('Failed to delete session file:', error);
    }
    
    // Sync delete with OpenCode if enabled
    if (this.plugin.settings.syncWithOpenCode && session?.opencodeSessionId) {
      try {
        await this.plugin.openCodeService.syncDeleteSession(session.opencodeSessionId);
        console.log('Session synced delete with OpenCode');
      } catch (error) {
        console.warn('Failed to sync delete with OpenCode:', error);
      }
    }
  }

  async deleteAllSessions(): Promise<void> {
    const sessions = await this.listSessions();
    for (const sessionId of sessions) {
      await this.deleteSession(sessionId);
    }
  }

  async cleanupOldSessions(): Promise<void> {
    if (!this.plugin.settings.enableSessionPersistence) {
      return;
    }

    const retentionDays = this.plugin.settings.conversationRetentionDays;
    const maxHistory = this.plugin.settings.maxConversationHistory;
    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

    const sessions = await this.listSessions();
    let deletedCount = 0;

    for (let i = 0; i < sessions.length; i++) {
      const sessionId = sessions[i];
      const session = await this.loadSession(sessionId);
      
      if (!session) continue;

      // Delete if older than retention period or exceeds max history
      const isOld = session.updatedAt < cutoffTime;
      const exceedsMax = i >= maxHistory;

      if (isOld || exceedsMax) {
        await this.deleteSession(sessionId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} old sessions`);
    }
  }

  async loadOpencodeConfig(): Promise<any | null> {
    // Try to load opencode config from vault root
    const configPath = 'opencode.json';
    try {
      const content = await this.plugin.app.vault.adapter.read(configPath);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async saveCommand(name: string, command: any): Promise<void> {
    const path = `${this.configDir}/commands/${name}.json`;
    await this.plugin.app.vault.adapter.write(
      path,
      JSON.stringify(command, null, 2)
    );
  }

  async loadCommand(name: string): Promise<any | null> {
    const path = `${this.configDir}/commands/${name}.json`;
    try {
      const content = await this.plugin.app.vault.adapter.read(path);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async listCommands(): Promise<string[]> {
    const commandsDir = `${this.configDir}/commands`;
    try {
      const files = await this.plugin.app.vault.adapter.list(commandsDir);
      return files.files
        .filter((f: string) => f.endsWith('.json'))
        .map((f: string) => {
          const parts = f.split('/');
          return parts[parts.length - 1].replace('.json', '');
        });
    } catch {
      return [];
    }
  }

  async exportSession(sessionId: string): Promise<string | null> {
    const session = await this.loadSession(sessionId);
    if (!session) return null;
    return JSON.stringify(session, null, 2);
  }

  async importSession(jsonData: string): Promise<string | null> {
    try {
      const session = JSON.parse(jsonData) as SessionData;
      
      // Generate new ID if not provided
      if (!session.id) {
        session.id = this.generateId();
      }
      
      // Update timestamps
      session.createdAt = session.createdAt || Date.now();
      session.updatedAt = Date.now();
      
      await this.saveSession(session.id, session);
      return session.id;
    } catch (error) {
      console.error('Failed to import session:', error);
      return null;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async getStorageStats(): Promise<{ sessions: number; totalSize: number }> {
    const sessions = await this.listSessions();
    let totalSize = 0;

    for (const sessionId of sessions) {
      const path = `${this.configDir}/sessions/${sessionId}.json`;
      try {
        const stat = await this.plugin.app.vault.adapter.stat(path);
        if (stat) {
          totalSize += stat.size;
        }
      } catch {
        // Ignore
      }
    }

    return {
      sessions: sessions.length,
      totalSize
    };
  }
}
