import OpensidianPlugin from '../../main';
import { MCPServerConfig } from '../types/opencode';
import { registerCLITools } from './tools/CLITools';
import { SSEClientTransport } from './SSEClientTransport';
import { HTTPClientTransport } from './HTTPClientTransport';

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

    // Register Obsidian CLI tools if available
    if (this.plugin.obsidianCLI && this.plugin.obsidianCLI.isAvailable()) {
      console.log('✅ Registering Obsidian CLI MCP tools');
      try {
        // Note: We can't directly register tools to the internal server here
        // The tools will be registered when the internal MCP server is initialized
        registerCLITools(null as any, this.plugin);
      } catch (error) {
        console.error('Failed to register CLI tools:', error);
      }
    }
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
      } else if (server.type === 'sse' && server.url) {
        config.url = server.url;
        config.type = 'remote';
        this.connectSSEServer(server.name, server.url, server.env);
      } else if (server.type === 'http' && server.url) {
        config.url = server.url;
        config.type = 'remote';
        this.connectHTTPServer(server.name, server.url, server.env);
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

  private sseConnections: Map<string, SSEClientTransport> = new Map();
  private httpConnections: Map<string, HTTPClientTransport> = new Map();

  connectSSEServer(name: string, url: string, env?: Record<string, string>): void {
    const transport = new SSEClientTransport({
      url,
      headers: env ? { ...env } : {},
      onMessage: (data) => {
        console.log(`[MCP SSE:${name}] Message:`, data);
      },
      onError: (error) => {
        console.error(`[MCP SSE:${name}] Error:`, error.message);
      },
      onClose: () => {
        console.log(`[MCP SSE:${name}] Disconnected`);
        this.sseConnections.delete(name);
      },
    });
    this.sseConnections.set(name, transport);
    transport.connect();
  }

  connectHTTPServer(name: string, url: string, env?: Record<string, string>): void {
    const transport = new HTTPClientTransport({
      url,
      headers: env ? { ...env } : {},
    });
    this.httpConnections.set(name, transport);
    console.log(`[MCP HTTP:${name}] Registered at ${url}`);
  }

  async disconnectAll(): Promise<void> {
    for (const [name, conn] of this.sseConnections) {
      conn.disconnect();
    }
    this.sseConnections.clear();
    this.httpConnections.clear();
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
