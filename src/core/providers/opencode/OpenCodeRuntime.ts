import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';
import { ChatRuntime, ToolInfo } from '../../runtime/ChatRuntime';
import { ProviderCapabilities, ProviderId } from '../types';
import { OPENCODE_CAPABILITIES } from './OpenCodeCapabilities';
import { ChatTurnRequest, PreparedChatTurn, ChatRuntimeQueryOptions, RuntimeState, RuntimeStateListener } from '../../runtime/types';
import { StreamChunk, ChatMessage, ModelInfo, ImageAttachment } from '../../types/chat';
import { FREE_MODELS, ZEN_MODELS, ModelInfo as SettingsModelInfo, getModelEndpoint } from '../../types/settings';
import type { OpensidianSettings } from '../../types/settings';
import type OpensidianPlugin from '../../../main';

const execAsync = promisify(exec);

interface OpenCodeProvider {
  id: string;
  config: any;
  apiKey?: string;
  baseURL?: string;
}

interface OpenCodeConfig {
  provider?: Record<string, any>;
  model?: string;
  small_model?: string;
  [key: string]: any;
}

interface OpenCodeAuth {
  [providerId: string]: { apiKey?: string; [key: string]: any };
}

export class OpenCodeRuntime implements ChatRuntime {
  readonly providerId: ProviderId = 'opencode';
  private plugin: OpensidianPlugin;
  private opencodeConfig: OpenCodeConfig | null = null;
  private opencodeAuth: OpenCodeAuth | null = null;
  private activeProvider: OpenCodeProvider | null = null;
  private initialized = false;
  private abortController: AbortController | null = null;
  private opencodePath: string | null = null;
  private availableModels: ModelInfo[] = [];
  private availableMCPServers: ToolInfo[] = [];
  private availableSkills: ToolInfo[] = [];
  private state: RuntimeState = 'uninitialized';
  private stateListeners: Set<RuntimeStateListener> = new Set();

  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
  }

  getCapabilities(): ProviderCapabilities {
    return OPENCODE_CAPABILITIES;
  }

  isReady(): boolean {
    return this.initialized;
  }

  onStateChange(listener: RuntimeStateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  private setState(state: RuntimeState): void {
    this.state = state;
    for (const listener of this.stateListeners) {
      listener(state);
    }
  }

  async ensureReady(): Promise<boolean> {
    if (this.initialized) return true;
    try {
      this.setState('busy');
      await this.findOpenCodePath();
      if (this.plugin.settings.autoLoadOpencodeConfig) {
        await this.loadOpencodeConfig();
      }
      await this.setupProvider();
      await this.loadAvailableModels();
      await this.loadAvailableMCPServers();
      await this.loadAvailableSkills();
      this.initialized = true;
      this.setState('ready');
      return true;
    } catch (error) {
      this.setState('error');
      console.error('OpenCodeRuntime initialization failed:', error);
      return false;
    }
  }

  prepareTurn(request: ChatTurnRequest): PreparedChatTurn {
    const model = request.prompt.includes('model:') 
      ? this.extractModel(request.prompt) 
      : this.getActiveModel();
    return {
      request,
      model,
      temperature: 0.7,
    };
  }

  private extractModel(_prompt: string): string {
    return this.getActiveModel();
  }

  async *query(
    turn: PreparedChatTurn,
    conversationHistory?: ChatMessage[],
    options?: ChatRuntimeQueryOptions
  ): AsyncGenerator<StreamChunk> {
    const prompt = turn.request.prompt;
    const queryOptions = {
      model: options?.model || turn.model,
      temperature: options?.temperature ?? turn.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? turn.maxTokens,
      systemPrompt: turn.request.systemPrompt,
      conversationHistory: conversationHistory || turn.request.conversationHistory,
      stream: turn.request.stream !== false,
      thinking: options?.thinking ?? turn.request.thinking,
      attachments: turn.request.attachments,
      sessionId: options?.sessionId,
    };

    if (!this.initialized) {
      console.warn('[OpenCodeRuntime] Not initialized, yielding error');
      yield { type: 'error', error: 'OpenCode service not initialized' };
      return;
    }

    console.log('[OpenCodeRuntime] query started, CLI available:', !!this.opencodePath, ', API key:', !!this.plugin.settings.opencodeZenApiKey, ', local model:', this.plugin.settings.localModel.enabled);

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    this.setState('busy');
    try {
      const disableApiFallback = this.plugin.settings.disableApiFallback;
      const cliAvailable = this.opencodePath && !this.plugin.settings.localModel.enabled;
      const apiKeyAvailable = !!(this.plugin.settings.opencodeZenApiKey || this.activeProvider?.apiKey);

      if (this.plugin.settings.localModel.enabled) {
        console.log('[OpenCodeRuntime] Using local model');
        yield* this.queryViaCLI(prompt, queryOptions);
      } else if (disableApiFallback) {
        console.log('[OpenCodeRuntime] Using CLI only (API fallback disabled)');
        if (!cliAvailable) throw new Error('API fallback disabled but CLI not available');
        yield* this.queryViaCLI(prompt, queryOptions);
      } else if (apiKeyAvailable) {
        console.log('[OpenCodeRuntime] Using API SSE (primary)');
        try {
          yield* this.queryViaAPI(prompt, queryOptions);
        } catch (apiError) {
          console.warn('API query failed, falling back to CLI:', apiError);
          if (cliAvailable) {
            yield* this.queryViaCLI(prompt, queryOptions);
          } else {
            throw apiError;
          }
        }
      } else if (cliAvailable) {
        console.log('[OpenCodeRuntime] Using CLI (no API key)');
        try {
          yield* this.queryViaCLI(prompt, queryOptions);
        } catch (cliError) {
          console.warn('CLI query failed:', cliError);
          throw cliError;
        }
      } else {
        console.warn('[OpenCodeRuntime] No connection method available. CLI:', cliAvailable, 'API:', apiKeyAvailable, 'Local:', this.plugin.settings.localModel.enabled);
        throw new Error('没有可用的连接方式。请配置 OpenCode CLI 路径或在设置中填入 API Key。');
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        yield { type: 'error', error: 'Request cancelled' };
      } else {
        yield { type: 'error', error: error.message || 'Unknown error' };
      }
    } finally {
      this.abortController = null;
      this.setState('ready');
    }
  }

  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
      this.setState('ready');
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    if (this.availableModels.length > 0) return this.availableModels;
    await this.loadAvailableModels();
    return this.availableModels;
  }

  async getAvailableTools(): Promise<ToolInfo[]> {
    return [...this.availableMCPServers, ...this.availableSkills];
  }

  getActiveModel(): string {
    if (this.plugin.settings.localModel.enabled) {
      return `local/${this.plugin.settings.localModel.model}`;
    }
    if (this.plugin.settings.useFreeModels && !this.opencodeConfig) {
      return FREE_MODELS[0].id;
    }
    if (this.plugin.settings.model !== 'auto') {
      return this.plugin.settings.model;
    }
    return this.opencodeConfig?.model || FREE_MODELS[0].id;
  }

  async switchModel(modelId: string): Promise<void> {
    this.plugin.settings.model = modelId;
    await this.plugin.saveSettings();
    if (!modelId.startsWith('local/')) {
      await this.setupProvider();
    }
  }

  reset(): void {
    this.initialized = false;
    this.opencodePath = null;
    this.availableModels = [];
    this.activeProvider = null;
    this.opencodeConfig = null;
    this.opencodeAuth = null;
    this.setState('uninitialized');
  }

  // ============ Internal: Path Detection ============

  private async findOpenCodePath(): Promise<void> {
    if (this.plugin.settings.opencodePath) {
      this.opencodePath = this.plugin.settings.opencodePath.replace(/\r/g, '').trim();
      return;
    }
    try {
      const cmd = process.platform === 'win32' ? 'where opencode' : 'which opencode';
      const { stdout } = await execAsync(cmd, this.getCliExecOptions());
      const foundPath = stdout.trim().split('\n')[0]?.replace(/["\r\n]+/g, '').trim();
      if (foundPath) { this.opencodePath = foundPath; return; }
    } catch {}

    const possiblePaths: string[] = [];
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA;
      const localAppData = process.env.LOCALAPPDATA;
      const programFiles = process.env.ProgramFiles;
      if (appData) possiblePaths.push(path.join(appData, 'npm', 'opencode.cmd'), path.join(appData, 'npm', 'opencode'));
      if (localAppData) possiblePaths.push(path.join(localAppData, 'Programs', 'nodejs', 'opencode.cmd'));
      if (programFiles) possiblePaths.push(path.join(programFiles, 'nodejs', 'opencode.cmd'));
    } else {
      possiblePaths.push('/usr/local/bin/opencode', '/usr/bin/opencode');
    }
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) { this.opencodePath = p; return; }
    }
  }

  // ============ Internal: Config Loading ============

  private async loadOpencodeConfig(): Promise<void> {
    try {
      const vaultConfig = await this.plugin.storage.loadOpencodeConfig();
      let globalConfig: OpenCodeConfig | null = null;
      const globalConfigPath = this.getGlobalConfigPath();
      if (globalConfigPath && fs.existsSync(globalConfigPath)) {
        globalConfig = JSON.parse(this.stripJsonComments(fs.readFileSync(globalConfigPath, 'utf-8')));
      }
      this.opencodeConfig = globalConfig && vaultConfig
        ? this.mergeConfigs(globalConfig, vaultConfig)
        : vaultConfig || globalConfig;
      await this.loadAuthConfig();
    } catch (error) {
      console.error('Failed to load opencode config:', error);
    }
  }

  private async loadAuthConfig(): Promise<void> {
    try {
      const authPath = this.getAuthPath();
      if (authPath && fs.existsSync(authPath)) {
        this.opencodeAuth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      }
    } catch (error) {
      console.warn('Failed to load auth config:', error);
    }
  }

  private getGlobalConfigPath(): string | null {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) return null;
    const locations = [
      path.join(homeDir, '.config', 'opencode', 'opencode.json'),
      process.env.APPDATA ? path.join(process.env.APPDATA!, 'opencode', 'opencode.json') : null,
    ].filter(Boolean) as string[];
    for (const loc of locations) {
      if (fs.existsSync(loc)) return loc;
    }
    return locations[0] || null;
  }

  private getAuthPath(): string | null {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) return null;
    const locations = [
      path.join(homeDir, '.local', 'share', 'opencode', 'auth.json'),
      path.join(homeDir, '.config', 'opencode', 'auth.json'),
    ];
    for (const loc of locations) {
      if (fs.existsSync(loc)) return loc;
    }
    return null;
  }

  // ============ Internal: Provider Setup ============

  private async setupProvider(): Promise<void> {
    if (this.plugin.settings.localModel.enabled) return;

    const modelId = this.plugin.settings.model === 'auto'
      ? this.getDefaultModel()
      : this.plugin.settings.model;

    if (!modelId) return;

    const [providerId] = modelId.includes('/') ? modelId.split('/') : [modelId, 'default'];

    if (providerId === 'opencode' || providerId === 'deepseek') {
      this.activeProvider = {
        id: 'opencode',
        config: { type: 'opencode' },
        apiKey: this.plugin.settings.opencodeZenApiKey || this.opencodeAuth?.['opencode']?.apiKey,
        baseURL: 'https://opencode.ai/zen/v1',
      };
      return;
    }

    if (!this.opencodeConfig) return;
    const providerConfig = this.opencodeConfig.provider?.[providerId];
    if (!providerConfig) {
      this.activeProvider = { id: 'opencode', config: { type: 'opencode' }, baseURL: 'https://opencode.ai/zen/v1' };
      return;
    }

    this.activeProvider = {
      id: providerId,
      config: providerConfig,
      apiKey: this.opencodeAuth?.[providerId]?.apiKey || providerConfig.options?.apiKey,
      baseURL: providerConfig.options?.baseURL,
    };
  }

  private getDefaultModel(): string {
    if (this.plugin.settings.useFreeModels) return 'opencode/big-pickle';
    if (this.opencodeConfig?.model) return this.opencodeConfig.model;
    return 'opencode/big-pickle';
  }

  // ============ Internal: Model Loading ============

  private async loadAvailableModels(): Promise<ModelInfo[]> {
    this.availableModels = [...FREE_MODELS];
    if (this.plugin.settings.opencodeZenApiKey || this.opencodeAuth?.['opencode']) {
      this.availableModels.push(...ZEN_MODELS);
    }

    const configModels = this.getModelsFromConfig();
    for (const model of configModels) {
      if (!this.availableModels.find(m => m.id === model.id)) {
        this.availableModels.push(model);
      }
    }

    if (this.opencodePath) {
      try {
        const cliModels = await this.getModelsFromCLI();
        for (const model of cliModels) {
          if (!this.availableModels.find(m => m.id === model.id)) {
            this.availableModels.push(model);
          }
        }
      } catch {}
    }

    if (this.plugin.settings.localModel.enabled) {
      this.availableModels.push({
        id: `local/${this.plugin.settings.localModel.model}`,
        name: `Local: ${this.plugin.settings.localModel.model}`,
        provider: 'local',
      });
    }
    return this.availableModels;
  }

  private async getModelsFromCLI(): Promise<ModelInfo[]> {
    if (!this.opencodePath) return [];
    try {
      const commands = process.platform === 'win32'
        ? [`"${this.opencodePath}" models --format json 2>NUL`, `"${this.opencodePath}" models 2>NUL`]
        : [`"${this.opencodePath}" models --format json 2>/dev/null`, `"${this.opencodePath}" models 2>/dev/null`];

      let output = '';
      for (const cmd of commands) {
        try {
          const result = await execAsync(cmd, this.getCliExecOptions({ maxBuffer: 10 * 1024 * 1024, timeout: this.plugin.settings.cliTimeout || 300000 }));
          output = result.stdout || result.stderr || '';
          if (output.trim()) break;
        } catch { continue; }
      }

      if (!output) return [];
      try {
        const parsed = JSON.parse(output);
        const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.data) ? parsed.data : [];
        return list.map((m: any) => ({
          id: m.id || `${m.provider}/${m.name}`,
          name: m.name || m.id,
          provider: m.provider || 'unknown',
        }));
      } catch {
        const models: ModelInfo[] = [];
        for (const line of output.trim().split('\n')) {
          const match = line.match(/(\S+\/\S+)/);
          if (match) models.push({ id: match[1], name: match[1], provider: match[1].split('/')[0] });
        }
        return models;
      }
    } catch { return []; }
  }

  private getModelsFromConfig(): ModelInfo[] {
    const models: ModelInfo[] = [];
    if (!this.opencodeConfig) return models;
    const providers = this.opencodeConfig.provider || {};
    const modelIds = new Set<string>();
    if (this.opencodeConfig.model) modelIds.add(this.opencodeConfig.model);
    if (this.opencodeConfig.small_model) modelIds.add(this.opencodeConfig.small_model);

    for (const id of modelIds) {
      if (!id) continue;
      const parts = id.split('/');
      models.push({ id, name: parts[1] || id, provider: parts[0] || 'unknown' });
    }
    return models;
  }

  // ============ Internal: Tool Loading ============

  private async loadAvailableMCPServers(): Promise<void> {
    const servers: ToolInfo[] = [];

    const configAny: any = this.opencodeConfig;
    const mcpConfig = configAny?.mcp || configAny?.mcpServers;
    if (mcpConfig) {
      if (Array.isArray(mcpConfig)) {
        for (const item of mcpConfig) {
          if (item?.name) servers.push({ name: String(item.name), description: item.description, enabled: item.enabled !== false, type: 'mcp' });
        }
      } else {
        for (const [name, cfg] of Object.entries(mcpConfig)) {
          servers.push({ name, description: (cfg as any)?.type, enabled: (cfg as any)?.enabled !== false, type: 'mcp' });
        }
      }
    }

    const externalServers = this.plugin.settings.externalMCPServers || [];
    for (const srv of externalServers) {
      if (srv.enabled && !servers.find(s => s.name === srv.name)) {
        servers.push({ name: srv.name, description: srv.type, enabled: true, type: 'mcp' });
      }
    }

    if (servers.length === 0) {
      servers.push({ name: 'obsidian-vault', description: 'Obsidian Vault Operations', enabled: true, type: 'mcp' });
    }
    this.availableMCPServers = servers;
    console.log('[OpenCodeRuntime] MCP servers loaded:', servers.map(s => s.name));
  }

  private async loadAvailableSkills(): Promise<void> {
    const skills: ToolInfo[] = [];

    const configAny: any = this.opencodeConfig;
    if (configAny?.skills) {
      if (Array.isArray(configAny.skills)) {
        for (const s of configAny.skills) {
          const name = typeof s === 'string' ? s : s?.name;
          if (name) skills.push({ name: String(name), description: 'Configured skill', enabled: true, type: 'skill' });
        }
      } else {
        for (const name of Object.keys(configAny.skills)) {
          skills.push({ name, description: 'Configured skill', enabled: true, type: 'skill' });
        }
      }
    }

    const vaultPath = this.plugin.getVaultPath();
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    const skillDirs: string[] = [];
    if (vaultPath) {
      skillDirs.push(path.join(vaultPath, '.opencode', 'skills'));
      skillDirs.push(path.join(vaultPath, '.claude', 'skills'));
      skillDirs.push(path.join(vaultPath, '.agents', 'skills'));
    }
    if (homeDir) {
      skillDirs.push(path.join(homeDir, '.config', 'opencode', 'skills'));
      skillDirs.push(path.join(homeDir, '.config', 'claude', 'skills'));
    }

    for (const dir of skillDirs) {
      if (!fs.existsSync(dir)) continue;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          const name = entry.name;
          if (!skills.find(s => s.name === name)) {
            skills.push({ name, description: `Local skill (${dir})`, enabled: true, type: 'skill' });
          }
        }
      } catch {}
    }

    this.availableSkills = skills;
    console.log('[OpenCodeRuntime] Skills loaded:', skills.map(s => s.name));
  }

  // ============ CLI Query Methods ============

  private getTempDir(): string {
    return this.plugin.settings.tempDir?.trim() || os.tmpdir();
  }

  private getCliCwd(): string {
    const vaultPath = this.plugin.getVaultPath();
    if (vaultPath && fs.existsSync(vaultPath)) return vaultPath;
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir && fs.existsSync(homeDir)) return homeDir;
    return process.cwd();
  }

  private getCliIsolationRoot(): string {
    const candidates = [
      this.plugin.settings.tempDir?.trim(),
      this.plugin.getVaultPath() ? path.join(this.plugin.getVaultPath(), '.obsidian', 'plugins', 'opensidian', '.opencode-cli') : null,
      path.join(process.cwd(), '.opencode-cli'),
      path.join(os.tmpdir(), 'opensidian-opencode-cli')
    ].filter(Boolean) as string[];
    for (const candidate of candidates) {
      if (!candidate.includes("'")) return candidate;
    }
    return path.join(process.cwd(), '.opencode-cli');
  }

  private sanitizeCliConfig(config: any): Record<string, any> {
    if (!config) return {};
    const cloned = JSON.parse(JSON.stringify(config));
    delete cloned.default_agent;
    delete cloned.defaultAgent;
    delete cloned.agent;
    return cloned;
  }

  private ensureCliRuntimeEnvironment(): NodeJS.ProcessEnv {
    try {
      const cliRoot = this.getCliIsolationRoot();
      const cliHome = path.join(cliRoot, 'home');
      const configBase = path.join(cliHome, '.config');
      const opencodeConfigDir = path.join(configBase, 'opencode');

      fs.mkdirSync(opencodeConfigDir, { recursive: true });

      const sanitizedConfig = this.sanitizeCliConfig(this.opencodeConfig);
      fs.writeFileSync(
        path.join(opencodeConfigDir, 'opencode.json'),
        JSON.stringify(sanitizedConfig, null, 2),
        'utf-8'
      );

      if (this.opencodeAuth) {
        fs.writeFileSync(
          path.join(opencodeConfigDir, 'auth.json'),
          JSON.stringify(this.opencodeAuth, null, 2),
          'utf-8'
        );
      }

      return {
        ...process.env,
        HOME: cliHome,
        USERPROFILE: cliHome,
        XDG_CONFIG_HOME: configBase,
        APPDATA: path.join(cliHome, 'AppData', 'Roaming'),
        LOCALAPPDATA: path.join(cliHome, 'AppData', 'Local'),
      };
    } catch (error) {
      console.warn('[OpenCodeRuntime] Failed to create isolated CLI environment, using parent env:', error);
      return { ...process.env };
    }
  }

  private getCliExecOptions(extra: Record<string, any> = {}): Record<string, any> {
    return {
      cwd: this.getCliCwd(),
      env: this.ensureCliRuntimeEnvironment(),
      ...extra,
    };
  }

  private buildCLIArgs(options?: any): string[] {
    const model = options?.model || this.getActiveModel();
    const args = ['run', '--format', 'json', '-m', model];
    if (options?.temperature && options.temperature !== 0.7) args.push('--temperature', String(options.temperature));
    if (options?.maxTokens) args.push('--max-tokens', String(options.maxTokens));
    if (options?.thinking) args.push('--thinking');
    return args;
  }

  private async *queryViaCLI(prompt: string, options?: any): AsyncGenerator<StreamChunk> {
    const model = options?.model || this.getActiveModel();
    const messages = this.buildMessages(prompt, options);

    const tempDir = this.getTempDir();
    const tempFile = path.join(tempDir, `opencode-request-${Date.now()}.json`);
    let tempFileCreated = false;

    try {
      const requestData = { messages, model, stream: true };
      fs.writeFileSync(tempFile, JSON.stringify(requestData, null, 2));
      tempFileCreated = true;

      const args = this.buildCLIArgs(options).join(' ');
      const cmd = process.platform === 'win32'
        ? `"${this.opencodePath}" ${args} < "${tempFile}"`
        : `"${this.opencodePath}" ${args} < "${tempFile}"`;

      console.log('[OpenCodeRuntime] Executing:', cmd);

      const { stdout, stderr } = await execAsync(cmd, {
        cwd: this.getCliCwd(),
        env: this.ensureCliRuntimeEnvironment(),
        maxBuffer: 50 * 1024 * 1024,
        timeout: this.plugin.settings.cliTimeout || 300000,
      });

      if (stderr && !stderr.includes('DEBUG') && !stderr.includes('INFO')) {
        console.warn('[OpenCodeRuntime] CLI stderr:', stderr.substring(0, 500));
      }

      console.log('[OpenCodeRuntime] CLI stdout length:', stdout.length, 'first 300 chars:', stdout.substring(0, 300));

      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line.trim());
          if (event.type === 'error') {
            yield { type: 'error', error: event.error?.message || event.error || 'CLI error' };
            return;
          }
          if (event.type === 'reasoning' && event.part?.text) {
            yield { type: 'thinking', content: event.part.text };
          }
          if (event.type === 'text' && event.part?.text) {
            yield { type: 'text', content: event.part.text };
          }
          if (event.type === 'tool_use') {
            const part = event.part;
            yield {
              type: part?.state?.output ? 'tool_result' : 'tool_call',
              toolCall: {
                id: part?.callID || `t-${Date.now()}`,
                name: part?.tool || part?.name || 'unknown',
                arguments: part?.state?.input || {},
                status: part?.state?.status === 'completed' ? 'completed' : 'executing',
                result: part?.state?.output || undefined,
              },
            };
          }
          if (event.text && !event.type) yield { type: 'text', content: event.text };
        } catch {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('{') && !trimmed.startsWith('[')) {
            yield { type: 'text', content: trimmed };
          }
        }
      }
      yield { type: 'done' };
    } catch (error: any) {
      console.error('[OpenCodeRuntime] CLI query failed:', error.message);
      yield { type: 'error', error: error.message || 'CLI query failed' };
    } finally {
      if (tempFileCreated && fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  }

  private buildMessages(prompt: string, options?: any): any[] {
    const messages: any[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    if (options?.conversationHistory) {
      for (const msg of options.conversationHistory) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: 'user', content: prompt });
    return messages;
  }


  private async *queryViaAPI(prompt: string, options?: any): AsyncGenerator<StreamChunk> {
    const body = this.buildRequestBody(prompt, options);
    const endpoint = this.getAPIEndpoint(options?.model);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(options?.model),
      body: JSON.stringify(body),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API ${response.status}: ${errorText}`);
    }

    if (body.stream) {
      yield* this.handleStreamingResponse(response);
    } else {
      const data = await response.json();
      yield { type: 'text', content: data.choices?.[0]?.message?.content || '' };
      yield { type: 'done' };
    }
  }

  private buildRequestBody(prompt: string, options?: any): any {
    const messages = this.buildMessages(prompt, options);
    const model = options?.model || this.getActiveModel();
    const modelName = model.includes('/') ? model.split('/')[1] : model;

    return {
      model: modelName,
      messages,
      stream: options?.stream !== false,
      temperature: options?.temperature ?? 0.7,
      ...(options?.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };
  }

  private getAPIEndpoint(modelId?: string): string {
    const model = modelId || this.getActiveModel();
    if (model.startsWith('opencode/')) return getModelEndpoint(model);
    if (this.activeProvider?.baseURL) return `${this.activeProvider.baseURL}/chat/completions`;
    return 'https://opencode.ai/zen/v1/chat/completions';
  }

  private getHeaders(modelId?: string): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const model = modelId || this.getActiveModel();
    if (model.startsWith('opencode/')) {
      const apiKey = this.plugin.settings.opencodeZenApiKey || this.opencodeAuth?.['opencode']?.apiKey;
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (this.activeProvider?.apiKey) {
      headers['Authorization'] = `Bearer ${this.activeProvider.apiKey}`;
    }
    return headers;
  }

  private async *handleStreamingResponse(response: Response): AsyncGenerator<StreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) { yield { type: 'error', error: 'No response body' }; return; }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') { yield { type: 'done' }; return; }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.thinking) yield { type: 'thinking', content: delta.thinking };
            if (delta?.content) yield { type: 'text', content: delta.content };
          } catch {}
        }
      }
    } finally {
      reader.releaseLock();
    }
    yield { type: 'done' };
  }

  // ============ Helpers ============

  private stripJsonComments(input: string): string {
    let output = '';
    let inString = false;
    let stringChar = '';
    let inLineComment = false;
    let inBlockComment = false;
    let escape = false;

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const next = i + 1 < input.length ? input[i + 1] : '';

      if (inLineComment) { if (char === '\n') { inLineComment = false; output += char; } continue; }
      if (inBlockComment) { if (char === '*' && next === '/') { inBlockComment = false; i++; } continue; }
      if (inString) { output += char; if (escape) escape = false; else if (char === '\\') escape = true; else if (char === stringChar) { inString = false; stringChar = ''; } continue; }
      if (char === '"' || char === "'") { inString = true; stringChar = char; output += char; continue; }
      if (char === '/' && next === '/') { inLineComment = true; i++; continue; }
      if (char === '/' && next === '*') { inBlockComment = true; i++; continue; }
      output += char;
    }
    return output;
  }

  private mergeConfigs(base: any, override: any): any {
    if (!base) return override;
    if (!override) return base;
    if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
    if (typeof base !== 'object' || typeof override !== 'object') return override;
    const result: any = { ...base };
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfigs((base as any)[key], value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
