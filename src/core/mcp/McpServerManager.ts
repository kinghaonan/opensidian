import OpensidianPlugin from '../../main';
import { MCPServerConfig } from '../types/opencode';

interface MCPServer {
  name: string;
  config: MCPServerConfig;
  enabled: boolean;
  contextSaving?: boolean;
  tools?: any[];
}

export class McpServerManager {
  private plugin: OpensidianPlugin;
  private servers: MCPServer[] = [];
  private isInitialized = false;

  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load internal MCP server if enabled
    if (this.plugin.settings.enableInternalMCPServer) {
      this.loadInternalServer();
    }

    // Load external MCP servers
    await this.loadExternalServers();

    // Load MCP servers from opencode config
    await this.loadOpencodeMCPServers();

    this.isInitialized = true;
    console.log(`MCP Server Manager initialized with ${this.servers.length} servers`);
  }

  private loadInternalServer(): void {
    // The internal MCP server is implemented directly in the plugin
    // and doesn't need stdio/sse transport
    this.servers.push({
      name: 'obsidian-vault',
      config: {
        type: 'local',
        enabled: true,
      },
      enabled: true,
      contextSaving: false,
      tools: [], // Will be populated by the internal server
    });
  }

  private async loadExternalServers(): Promise<void> {
    for (const server of this.plugin.settings.externalMCPServers) {
      if (!server.enabled) continue;

      const config: MCPServerConfig = {
        type: server.type === 'stdio' ? 'local' : 'remote',
        enabled: true,
      };

      if (server.type === 'stdio') {
        config.command = [server.command!, ...(server.args || [])];
        config.environment = server.env;
      } else {
        config.url = server.url;
      }

      this.servers.push({
        name: server.name,
        config,
        enabled: true,
      });
    }
  }

  private async loadOpencodeMCPServers(): Promise<void> {
    try {
      // 检查 openCodeService 是否已初始化
      if (!this.plugin.openCodeService || !this.plugin.openCodeService.isReady()) {
        console.log('OpenCode service not ready, skipping MCP server loading');
        return;
      }

      const opencodeConfig = this.plugin.openCodeService.getConfig();
      if (!opencodeConfig?.mcp) {
        console.log('No MCP servers found in OpenCode config');
        return;
      }

      let loadedCount = 0;
      for (const [name, config] of Object.entries(opencodeConfig.mcp)) {
        // Skip if already loaded
        if (this.servers.find(s => s.name === name)) continue;

        const mcpConfig = config as MCPServerConfig;
        
        this.servers.push({
          name,
          config: mcpConfig,
          enabled: mcpConfig.enabled !== false,
          contextSaving: true, // Most opencode MCP servers use context saving
        });
        loadedCount++;
      }

      console.log(`Loaded ${loadedCount} MCP servers from OpenCode config`);
    } catch (error) {
      console.warn('Failed to load OpenCode MCP servers:', error);
      // 继续执行，不阻止其他初始化
    }
  }

  getServers(): MCPServer[] {
    return this.servers;
  }

  getActiveServers(mentionedNames: Set<string> = new Set()): MCPServer[] {
    return this.servers.filter(server => {
      if (!server.enabled) return false;
      
      // If context saving is enabled, only include if mentioned
      if (server.contextSaving && !mentionedNames.has(server.name)) {
        return false;
      }
      
      return true;
    });
  }

  getServer(name: string): MCPServer | undefined {
    return this.servers.find(s => s.name === name);
  }

  enableServer(name: string): void {
    const server = this.getServer(name);
    if (server) {
      server.enabled = true;
    }
  }

  disableServer(name: string): void {
    const server = this.getServer(name);
    if (server) {
      server.enabled = false;
    }
  }

  extractMentions(text: string): string[] {
    const mentions: string[] = [];
    const regex = /@(\w+)/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      const serverName = match[1];
      if (this.getServer(serverName)) {
        mentions.push(serverName);
      }
    }
    
    return mentions;
  }

  transformMentions(text: string): string {
    // Replace @servername with instructions to use the MCP server
    return text.replace(/@(\w+)/g, (match, serverName) => {
      const server = this.getServer(serverName);
      if (server) {
        return `[Using MCP server: ${serverName}]`;
      }
      return match;
    });
  }

  async refreshServers(): Promise<void> {
    this.servers = [];
    await this.initialize();
  }
}
