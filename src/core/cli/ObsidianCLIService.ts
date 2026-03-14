import OpensidianPlugin from '../../main';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ObsidianCLIConfig {
  enabled: boolean;
  vaultPath?: string;
  configPath?: string;
}

export class ObsidianCLIService {
  private plugin: OpensidianPlugin;
  private cliPath: string | null = null;
  private config: ObsidianCLIConfig = {
    enabled: false,
  };

  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
  }

  /**
   * 初始化 CLI 服务
   */
  async initialize(): Promise<void> {
    // 加载配置
    this.config = {
      enabled: this.plugin.settings.obsidianCLI?.enabled || false,
      vaultPath: this.plugin.settings.obsidianCLI?.vaultPath,
      configPath: this.plugin.settings.obsidianCLI?.configPath,
    };

    if (!this.config.enabled) {
      console.log('Obsidian CLI is disabled');
      return;
    }

    // 查找 Obsidian CLI
    await this.findCLIIPath();

    if (this.cliPath) {
      console.log('✅ Obsidian CLI found at:', this.cliPath);
    } else {
      console.warn('❌ Obsidian CLI not found. Please install it from https://github.com/obsidian-cli/obsidian-cli');
    }
  }

  /**
   * 查找 Obsidian CLI 路径
   */
  private async findCLIIPath(): Promise<void> {
    // 优先使用配置的路径
    if (this.config.configPath) {
      if (fs.existsSync(this.config.configPath)) {
        this.cliPath = this.config.configPath;
        console.log('Using configured Obsidian CLI path:', this.config.configPath);
        return;
      }
    }

    // 尝试在系统 PATH 中查找
    try {
      const cmd = process.platform === 'win32' ? 'where.exe obsidian' : 'which obsidian';
      const { stdout } = await execAsync(cmd, { encoding: 'utf8' });
      const lines = stdout.trim().split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        const foundPath = line.trim();
        if (foundPath && fs.existsSync(foundPath)) {
          this.cliPath = foundPath;
          console.log('Found Obsidian CLI via PATH:', foundPath);
          return;
        }
      }
    } catch (error) {
      console.warn('Failed to find Obsidian CLI via PATH:', error);
    }

    // 尝试常见的安装位置
    const possiblePaths = [
      // Windows
      path.join(process.env.APPDATA || '', 'npm', 'obsidian.cmd'),
      path.join(process.env.APPDATA || '', 'npm', 'obsidian'),
      path.join(path.dirname(process.execPath), 'obsidian.cmd'),
      path.join(path.dirname(process.execPath), 'obsidian'),
      
      // Unix
      '/usr/local/bin/obsidian',
      '/usr/bin/obsidian',
    ].filter(p => p);

    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          this.cliPath = p;
          console.log('Found Obsidian CLI at:', p);
          return;
        }
      } catch {
        continue;
      }
    }
  }

  /**
   * 获取 Vault 信息
   */
  async getVaultInfo(): Promise<any> {
    if (!this.cliPath) {
      throw new Error('Obsidian CLI not available');
    }

    try {
      const { stdout } = await execAsync(`"${this.cliPath}" vault info --json`);
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Failed to get vault info:', error);
      throw error;
    }
  }

  /**
   * 打开 Vault
   */
  async openVault(vaultName?: string): Promise<void> {
    if (!this.cliPath) {
      throw new Error('Obsidian CLI not available');
    }

    try {
      if (vaultName) {
        await execAsync(`"${this.cliPath}" vault open "${vaultName}"`);
        console.log(`Opened vault: ${vaultName}`);
      } else {
        await execAsync(`"${this.cliPath}" vault open`);
        console.log('Opened current vault');
      }
    } catch (error) {
      console.error('Failed to open vault:', error);
      throw error;
    }
  }

  /**
   * 创建笔记
   */
  async createNote(title: string, folder?: string, template?: string): Promise<void> {
    if (!this.cliPath) {
      throw new Error('Obsidian CLI not available');
    }

    try {
      let command = `"${this.cliPath}" note create "${title}"`;
      
      if (folder) {
        command += ` --folder "${folder}"`;
      }
      
      if (template) {
        command += ` --template "${template}"`;
      }
      
      await execAsync(command);
      console.log(`Created note: ${title}`);
    } catch (error) {
      console.error('Failed to create note:', error);
      throw error;
    }
  }

  /**
   * 打开笔记
   */
  async openNote(title: string): Promise<void> {
    if (!this.cliPath) {
      throw new Error('Obsidian CLI not available');
    }

    try {
      await execAsync(`"${this.cliPath}" note open "${title}"`);
      console.log(`Opened note: ${title}`);
    } catch (error) {
      console.error('Failed to open note:', error);
      throw error;
    }
  }

  /**
   * 搜索笔记
   */
  async searchNotes(query: string, limit?: number): Promise<any[]> {
    if (!this.cliPath) {
      throw new Error('Obsidian CLI not available');
    }

    try {
      let command = `"${this.cliPath}" search "${query}" --json`;
      
      if (limit) {
        command += ` --limit ${limit}`;
      }
      
      const { stdout } = await execAsync(command);
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Failed to search notes:', error);
      return [];
    }
  }

  /**
   * 运行命令
   */
  async runCommand(commandId: string): Promise<void> {
    if (!this.cliPath) {
      throw new Error('Obsidian CLI not available');
    }

    try {
      await execAsync(`"${this.cliPath}" command run "${commandId}"`);
      console.log(`Executed command: ${commandId}`);
    } catch (error) {
      console.error('Failed to run command:', error);
      throw error;
    }
  }

  /**
   * 获取所有命令
   */
  async listCommands(): Promise<any[]> {
    if (!this.cliPath) {
      throw new Error('Obsidian CLI not available');
    }

    try {
      const { stdout } = await execAsync(`"${this.cliPath}" command list --json`);
      return JSON.parse(stdout);
    } catch (error) {
      console.error('Failed to list commands:', error);
      return [];
    }
  }

  /**
   * 切换主题
   */
  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    if (!this.cliPath) {
      throw new Error('Obsidian CLI not available');
    }

    try {
      await execAsync(`"${this.cliPath}" theme set ${theme}`);
      console.log(`Set theme to: ${theme}`);
    } catch (error) {
      console.error('Failed to set theme:', error);
      throw error;
    }
  }

  /**
   * 检查 CLI 是否可用
   */
  isAvailable(): boolean {
    return this.cliPath !== null;
  }

  /**
   * 获取 CLI 路径
   */
  getCLIPath(): string | null {
    return this.cliPath;
  }

  /**
   * 启用 CLI
   */
  enable(): void {
    this.config.enabled = true;
    this.initialize();
  }

  /**
   * 禁用 CLI
   */
  disable(): void {
    this.config.enabled = false;
    this.cliPath = null;
    console.log('Obsidian CLI disabled');
  }
}
