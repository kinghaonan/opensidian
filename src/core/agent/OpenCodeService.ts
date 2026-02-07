import OpensidianPlugin from '../../main';
import { OpenCodeConfig, OpenCodeAuth, ProviderConfig } from '../types/opencode';
import { StreamChunk, QueryOptions } from '../types/chat';
import { FREE_MODELS, ZEN_MODELS, ModelInfo, getModelEndpoint } from '../types/settings';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';

const execAsync = promisify(exec);

interface OpenCodeProvider {
  id: string;
  config: ProviderConfig;
  apiKey?: string;
  baseURL?: string;
}

interface OpenCodeSession {
  id: string;
  title?: string;
  messages: any[];
  createdAt: number;
  updatedAt: number;
}

export class OpenCodeService {
  private plugin: OpensidianPlugin;
  private opencodeConfig: OpenCodeConfig | null = null;
  private opencodeAuth: OpenCodeAuth | null = null;
  private activeProvider: OpenCodeProvider | null = null;
  private isInitialized = false;
  private abortController: AbortController | null = null;
  private currentSessionId: string | null = null;
  private availableModels: ModelInfo[] = [];
  private opencodePath: string | null = null;

  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Find OpenCode CLI path
    await this.findOpenCodePath();

    // Load opencode configuration
    if (this.plugin.settings.autoLoadOpencodeConfig) {
      await this.loadOpencodeConfig();
    }

    // Setup active provider
    await this.setupProvider();

    // Load available models
    await this.loadAvailableModels();

    this.isInitialized = true;
    console.log('OpenCode service initialized');
  }

  private getTempDir(): string {
    // 优先使用用户配置的临时目录，避免特殊字符路径问题
    if (this.plugin.settings.tempDir && this.plugin.settings.tempDir.trim()) {
      const customDir = this.plugin.settings.tempDir.trim();
      console.log('Using custom temporary directory:', customDir);
      return customDir;
    }
    const systemTempDir = os.tmpdir();
    console.log('Using system temporary directory:', systemTempDir);
    return systemTempDir;
  }

  private async safeUnlink(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      console.log('File does not exist, skipping cleanup:', filePath);
      return;
    }

    // 尝试多次删除，处理 EBUSY 错误
    const maxRetries = 5;
    const retryDelay = 1000; // 1秒

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        fs.unlinkSync(filePath);
        console.log('Successfully cleaned up temporary file:', filePath);
        return;
      } catch (error: any) {
        if (error.code === 'EBUSY' && attempt < maxRetries) {
          console.warn(`File ${filePath} is busy, retrying (${attempt}/${maxRetries})...`);
          // 等待一段时间后重试，使用异步延迟避免阻塞
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          console.warn(`Failed to cleanup temporary file after ${attempt} attempts:`, filePath, error);
          // 如果仍然失败，尝试重命名文件（避免积累临时文件）
          try {
            const newPath = filePath + '.deleted';
            fs.renameSync(filePath, newPath);
            console.log('Renamed busy file to:', newPath);
          } catch (renameError) {
            console.warn('Failed to rename busy file:', renameError);
          }
          break;
        }
      }
    }
  }

  public async findOpenCodePath(): Promise<void> {
    // Use configured path first
    if (this.plugin.settings.opencodePath) {
      this.opencodePath = this.plugin.settings.opencodePath;
      return;
    }

    // Try to find opencode in common locations
    const possiblePaths = [
      'H:\\node-v22.20.0-win-x64\\node-v22.20.0-win-x64\\opencode.cmd',
      'H:\\node-v22.20.0-win-x64\\node-v22.20.0-win-x64\\opencode',
      process.platform === 'win32' ? 'opencode.cmd' : 'opencode',
    ];

    for (const p of possiblePaths) {
      try {
        if (fs.existsSync(p)) {
          this.opencodePath = p;
          console.log('Found opencode at:', p);
          return;
        }
      } catch {
        // Continue trying
      }
    }

    // Try using 'which' or 'where' command
    try {
      const cmd = process.platform === 'win32' ? 'where opencode' : 'which opencode';
      const { stdout } = await execAsync(cmd);
      const foundPath = stdout.trim().split('\n')[0];
      if (foundPath) {
        this.opencodePath = foundPath;
        console.log('Found opencode via PATH:', foundPath);
      }
    } catch {
      console.warn('OpenCode CLI not found in PATH');
    }
  }

  private async loadOpencodeConfig(): Promise<void> {
    try {
      // 1. Try vault-specific config first
      const vaultConfig = await this.plugin.storage.loadOpencodeConfig();
      if (vaultConfig) {
        this.opencodeConfig = vaultConfig;
        console.log('Loaded opencode config from vault');
        return;
      }

      // 2. Try global config
      const globalConfigPath = this.getGlobalConfigPath();
      if (globalConfigPath && fs.existsSync(globalConfigPath)) {
        const content = fs.readFileSync(globalConfigPath, 'utf-8');
        this.opencodeConfig = JSON.parse(content);
        console.log('Loaded opencode config from global');
      }

      // 3. Try to load auth info
      await this.loadAuthConfig();
    } catch (error) {
      console.error('Failed to load opencode config:', error);
    }
  }

  private async loadAuthConfig(): Promise<void> {
    try {
      const authPath = this.getAuthPath();
      if (authPath && fs.existsSync(authPath)) {
        const content = fs.readFileSync(authPath, 'utf-8');
        this.opencodeAuth = JSON.parse(content);
        console.log('Loaded opencode auth');
      }
    } catch (error) {
      console.error('Failed to load auth config:', error);
    }
  }

  private getGlobalConfigPath(): string | null {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) return null;
    return path.join(homeDir, '.config', 'opencode', 'opencode.json');
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

  private getSessionsPath(): string | null {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (!homeDir) return null;
    return path.join(homeDir, '.local', 'share', 'opencode', 'sessions');
  }

  private async setupProvider(): Promise<void> {
    // 如果使用本地模型，跳过 OpenCode 配置
    if (this.plugin.settings.localModel.enabled) {
      console.log('Using local model, skipping OpenCode provider setup');
      return;
    }

    const modelId = this.plugin.settings.model === 'auto' 
      ? this.getDefaultModel() 
      : this.plugin.settings.model;

    if (!modelId) {
      console.warn('No model configured');
      return;
    }

    const [providerId, modelName] = modelId.includes('/') 
      ? modelId.split('/') 
      : [modelId, 'default'];

    console.log(`Setting up provider for model: ${modelId}, provider: ${providerId}`);

    // 检查是否为免费模型或OpenCode Zen模型
    const isFreeModel = modelId.startsWith('opencode/');
    const isZenModel = modelId.startsWith('opencode/') && !modelId.includes('free');
    
    if (isFreeModel || isZenModel) {
      console.log(`Using ${isFreeModel ? 'free' : 'Zen'} model: ${modelId}, no provider config needed`);
      this.activeProvider = {
        id: 'opencode',
        config: { type: 'opencode' } as ProviderConfig,
        apiKey: this.plugin.settings.opencodeZenApiKey || this.opencodeAuth?.['opencode']?.apiKey,
        baseURL: 'https://opencode.ai/zen/v1',
      };
      return;
    }

    // 检查是否为deepseek模型（通过OpenCode Zen提供）
    if (providerId === 'deepseek') {
      console.log(`Using deepseek model via OpenCode Zen: ${modelId}`);
      this.activeProvider = {
        id: 'opencode',
        config: { type: 'opencode' } as ProviderConfig,
        apiKey: this.plugin.settings.opencodeZenApiKey || this.opencodeAuth?.['opencode']?.apiKey,
        baseURL: 'https://opencode.ai/zen/v1',
      };
      return;
    }

    // 如果使用免费模型且没有配置
    if (this.plugin.settings.useFreeModels && !this.opencodeConfig) {
      console.log('Using free models without OpenCode config');
      return;
    }

    if (!this.opencodeConfig) {
      console.warn('No opencode config found');
      return;
    }

    const providerConfig = this.opencodeConfig.provider?.[providerId];
    if (!providerConfig) {
      console.warn(`Provider ${providerId} not found in config, using OpenCode Zen as fallback`);
      this.activeProvider = {
        id: 'opencode',
        config: { type: 'opencode' } as ProviderConfig,
        apiKey: this.plugin.settings.opencodeZenApiKey || this.opencodeAuth?.['opencode']?.apiKey,
        baseURL: 'https://opencode.ai/zen/v1',
      };
      return;
    }

    const apiKey = this.opencodeAuth?.[providerId]?.apiKey 
      || providerConfig.options?.apiKey;

    this.activeProvider = {
      id: providerId,
      config: providerConfig,
      apiKey,
      baseURL: providerConfig.options?.baseURL,
    };

    console.log(`Provider ${providerId} configured with model ${modelName}`);
  }

  private getDefaultModel(): string {
    // 优先使用免费模型
    if (this.plugin.settings.useFreeModels) {
      return 'opencode/big-pickle';
    }
    
    // 使用OpenCode配置中的模型
    if (this.opencodeConfig?.model) {
      return this.opencodeConfig.model;
    }
    
    // 默认使用免费模型
    return 'opencode/big-pickle';
  }

  async loadAvailableModels(): Promise<ModelInfo[]> {
    this.availableModels = [];

    // 1. Add free models
    this.availableModels.push(...FREE_MODELS);

    // 2. Add Zen models if user has API key
    if (this.plugin.settings.opencodeZenApiKey || this.opencodeAuth?.['opencode']) {
      this.availableModels.push(...ZEN_MODELS);
    }

    // 3. Try to load models from OpenCode CLI
    if (this.opencodePath) {
      try {
        const cliModels = await this.getModelsFromCLI();
        for (const model of cliModels) {
          if (!this.availableModels.find(m => m.id === model.id)) {
            this.availableModels.push(model);
          }
        }
      } catch (error) {
        console.warn('Failed to load models from CLI:', error);
      }
    }

    // 4. Add local models if enabled
    if (this.plugin.settings.localModel.enabled) {
      this.availableModels.push({
        id: `local/${this.plugin.settings.localModel.model}`,
        name: `Local: ${this.plugin.settings.localModel.model}`,
        provider: 'local',
      });
    }

    console.log(`Loaded ${this.availableModels.length} available models`);
    return this.availableModels;
  }

  private async getModelsFromCLI(): Promise<ModelInfo[]> {
    if (!this.opencodePath) return [];

    try {
      const { stdout } = await execAsync(`"${this.opencodePath}" models --format json 2>/dev/null || "${this.opencodePath}" models`);
      
      // Try to parse as JSON first
      try {
        const models = JSON.parse(stdout);
        if (Array.isArray(models)) {
          return models.map((m: any) => ({
            id: m.id || `${m.provider}/${m.name}`,
            name: m.name || m.id,
            provider: m.provider || 'unknown',
          }));
        }
      } catch {
        // Parse text output
        const lines = stdout.trim().split('\n');
        const models: ModelInfo[] = [];
        for (const line of lines) {
          const match = line.match(/(\S+\/\S+)/);
          if (match) {
            models.push({
              id: match[1],
              name: match[1],
              provider: match[1].split('/')[0],
            });
          }
        }
        return models;
      }
    } catch (error) {
      console.warn('Failed to get models from CLI:', error);
    }

    return [];
  }

  getAvailableModels(): ModelInfo[] {
    return this.availableModels;
  }

  getActiveModel(): string {
    // 优先使用本地模型
    if (this.plugin.settings.localModel.enabled) {
      return `local/${this.plugin.settings.localModel.model}`;
    }

    // 使用免费模型
    if (this.plugin.settings.useFreeModels && !this.opencodeConfig) {
      return FREE_MODELS[0].id;
    }

    if (this.plugin.settings.model !== 'auto') {
      return this.plugin.settings.model;
    }
    return this.opencodeConfig?.model || FREE_MODELS[0].id;
  }

  getActiveProviderId(): string | null {
    if (this.plugin.settings.localModel.enabled) {
      return 'local';
    }
    return this.activeProvider?.id || 'opencode';
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  hasValidConfig(): boolean {
    return this.activeProvider !== null || 
           this.plugin.settings.localModel.enabled ||
           (this.plugin.settings.useFreeModels && !this.opencodeConfig);
  }

  async switchModel(modelId: string): Promise<void> {
    this.plugin.settings.model = modelId;
    await this.plugin.saveSettings();
    
    // 重新设置 provider
    if (!modelId.startsWith('local/')) {
      await this.setupProvider();
    }
  }

  async *query(
    prompt: string, 
    options?: QueryOptions
  ): AsyncGenerator<StreamChunk> {
    if (!this.isReady()) {
      yield {
        type: 'error',
        error: 'OpenCode service not initialized'
      };
      return;
    }

    // 取消之前的请求
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    try {
      // 检查是否禁用了API回退
      const disableApiFallback = this.plugin.settings.disableApiFallback;
      
      // CLI 是否可用
      const cliAvailable = this.opencodePath && !this.plugin.settings.localModel.enabled;
      
      if (disableApiFallback) {
        // 如果禁用了API回退，必须使用CLI
        if (!cliAvailable) {
          throw new Error('API fallback is disabled but CLI is not available. ' +
            'Please configure OpenCode CLI path or enable local model.');
        }
        
        // 只使用CLI，失败时不回退
        yield* this.queryViaCLI(prompt, options);
        return;
      } else {
        // 默认逻辑：优先使用CLI，失败时回退到API
        if (cliAvailable) {
          try {
            yield* this.queryViaCLI(prompt, options);
            return;
          } catch (cliError) {
            console.warn('CLI query failed, falling back to API:', cliError);
          }
        }
        
        // 回退到 API 请求
        yield* this.queryViaAPI(prompt, options);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        yield { type: 'error', error: 'Request cancelled' };
      } else {
        console.error('Query error:', error);
        yield {
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    } finally {
      this.abortController = null;
    }
  }

  private async *queryViaCLI(
    prompt: string,
    options?: QueryOptions
  ): AsyncGenerator<StreamChunk> {
    // 多级调用降级策略：依次尝试不同的 CLI 调用方式
    const methods = [
      this.queryViaCLISpawn.bind(this),
      this.queryViaCLIPipe.bind(this),
      this.queryViaCLIRedirect.bind(this),
    ];

    const methodNames = ['spawn', 'pipe', 'redirect'];
    let lastError: Error | null = null;

    for (let i = 0; i < methods.length; i++) {
      const method = methods[i];
      const methodName = methodNames[i];
      
      console.log(`Trying CLI method ${i+1}/${methods.length}: ${methodName}`);
      
      try {
        yield* method(prompt, options);
        console.log(`CLI method ${methodName} succeeded`);
        return;
      } catch (error) {
        console.error(`CLI method ${methodName} failed:`, error);
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // 如果不是最后一个方法，继续尝试下一个
        if (i < methods.length - 1) {
          console.log(`Falling back to next method...`);
          // 等待短暂时间，避免快速重试
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    // 所有方法都失败了
    console.error('All CLI methods failed');
    throw lastError || new Error('All CLI methods failed');
  }

  private buildCLIArgs(options?: QueryOptions): string[] {
    const model = options?.model || this.getActiveModel();
    const temperature = options?.temperature ?? 0.7;
    
    const args = ['run', '--format', 'json', '-m', model];
    if (temperature !== 0.7) {
      args.push('--temperature', temperature.toString());
    }
    if (options?.maxTokens) {
      args.push('--max-tokens', options.maxTokens.toString());
    }
    if (options?.thinking) {
      args.push('--thinking');
    }
    
    console.log('CLI args:', args, 'thinking:', options?.thinking);
    return args;
  }

  private parseCLIResponse(stdout: string): {text: string, thinking: string} {
    console.log('CLI raw response (first 500 chars):', stdout.substring(0, 500));

    try {
      const lines = stdout.trim().split('\n');
      let textContent = '';
      let thinkingContent = '';
      let hasError = false;
      let errorMessage = '';

      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const event = JSON.parse(line.trim());
          
          // 处理错误事件
          if (event.type === 'error') {
            hasError = true;
            errorMessage = event.error?.message || event.error || 'CLI error';
            console.error('CLI error event:', event);
            break;
          }
          
          // 处理思考事件
          if (event.type === 'reasoning' && event.part?.text) {
            thinkingContent += event.part.text;
          }
          
          // 处理文本事件
          if (event.type === 'text' && event.part?.text) {
            textContent += event.part.text;
          }
          
          // 也可以从其他字段提取文本
          if (!textContent && event.text) {
            textContent = event.text;
          }
          if (!textContent && event.content) {
            textContent = event.content;
          }
          if (!textContent && event.message) {
            textContent = event.message;
          }
          if (!textContent && event.part?.text) {
            textContent = event.part.text;
          }
          
        } catch (lineParseError) {
          console.warn('Failed to parse CLI response line:', line, lineParseError);
          // 继续处理其他行
        }
      }

      if (hasError) {
        throw new Error(errorMessage);
      }

      if (!textContent) {
        console.warn('Could not extract text from CLI response. Raw output:', stdout);
        // 尝试将整个输出作为文本
        textContent = stdout.trim();
      }

      console.log('Extracted text content (first 200 chars):', textContent.substring(0, 200));
      if (thinkingContent) {
        console.log('Extracted thinking content (first 200 chars):', thinkingContent.substring(0, 200));
      }
      return {text: textContent, thinking: thinkingContent};
      
    } catch (parseError) {
      console.error('Failed to parse CLI response:', parseError);
      console.error('Raw stdout:', stdout);
      
      // 如果 JSON 解析失败，尝试直接使用 stdout 作为文本
      if (stdout.trim()) {
        return {text: stdout.trim(), thinking: ''};
      } else {
        throw parseError instanceof Error ? parseError : new Error('Invalid CLI response');
      }
    }
  }

  private async *processCLIStream(stream: NodeJS.ReadableStream): AsyncGenerator<StreamChunk> {
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      
      try {
        const event = JSON.parse(line.trim());
        
        // 处理错误事件
        if (event.type === 'error') {
          console.error('CLI error event:', event);
          yield {
            type: 'error',
            error: event.error?.message || event.error || 'CLI error'
          };
          return;
        }
        
        // 处理思考事件
        if (event.type === 'reasoning' && event.part?.text !== undefined) {
          yield {
            type: 'thinking',
            content: event.part.text
          };
        }
        
        // 处理文本事件
        if (event.type === 'text' && event.part?.text !== undefined) {
          yield {
            type: 'text',
            content: event.part.text
          };
        }
        
        // 处理其他文本字段（兼容性）
        if (event.type === 'text' && event.text !== undefined) {
          yield {
            type: 'text',
            content: event.text
          };
        }
        
        // 处理步骤完成事件（忽略，继续）
        if (event.type === 'step_finish') {
          // 步骤完成，继续等待更多内容
        }
        
      } catch (parseError) {
        console.warn('Failed to parse CLI response line:', line, parseError);
        // 继续处理其他行
      }
    }
    
    yield { type: 'done' };
  }

  private async *queryViaCLISpawn(
    prompt: string,
    options?: QueryOptions
  ): AsyncGenerator<StreamChunk> {
    if (!this.opencodePath) {
      throw new Error('OpenCode CLI not available');
    }

    // 构建完整的消息，包含系统提示和对话历史
    const messages = this.buildMessages(prompt, options);
    const model = options?.model || this.getActiveModel();
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens;

    // 创建临时文件存储请求数据
    const tempDir = this.getTempDir();
    const tempFile = path.join(tempDir, `opencode-request-${Date.now()}.json`);
    let tempFileCreated = false;

    try {
      // 构建请求数据
      const requestData = {
        messages,
        model,
        temperature,
        max_tokens: maxTokens,
        stream: true // 启用流式响应
      };

      console.log('Request data:', JSON.stringify(requestData, null, 2));

      // 写入临时文件
      fs.writeFileSync(tempFile, JSON.stringify(requestData, null, 2));
      tempFileCreated = true;
      console.log('Created temporary request file:', tempFile);

      // 读取文件内容
      const requestContent = fs.readFileSync(tempFile, 'utf-8');
      
      // 构建命令参数
      const args = this.buildCLIArgs(options);

      console.log('Spawning opencode with args:', args);
      console.log('Opencode path:', this.opencodePath);

      // 使用 spawn 而不是 exec，避免 shell 处理路径中的特殊字符
      const child = spawn(`"${this.opencodePath}"`, args, {
        shell: true, // 使用 shell 以处理路径中的空格和引号
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 设置超时
      const timeout = this.plugin.settings.cliTimeout || 300000; // 使用配置的超时时间，默认 300 秒
      const timeoutId = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch (e) {
          console.warn('Failed to kill child process on timeout:', e);
        }
      }, timeout);

      // 写入请求内容到 stdin
      child.stdin.write(requestContent);
      child.stdin.end();

      // 收集 stderr 用于错误报告
      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 创建 readline 接口用于逐行处理 stdout
      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity
      });

      // 创建进程退出 promise
      const exitPromise = new Promise<number | null>((resolve, reject) => {
        child.on('error', reject);
        
        child.on('close', (code, _signal) => {
          clearTimeout(timeoutId);
          resolve(code);
        });
      });

      // 实时逐行处理 stdout 流
      try {
        for await (const line of rl) {
          if (!line.trim()) continue;
          
          try {
            const event = JSON.parse(line.trim());
            
            // 处理错误事件
            if (event.type === 'error') {
              console.error('CLI error event:', event);
              yield {
                type: 'error',
                error: event.error?.message || event.error || 'CLI error'
              };
              return;
            }
            
            // 处理思考事件
            if (event.type === 'reasoning' && event.part?.text !== undefined) {
              yield {
                type: 'thinking',
                content: event.part.text
              };
            }
            
            // 处理文本事件
            if (event.type === 'text' && event.part?.text !== undefined) {
              yield {
                type: 'text',
                content: event.part.text
              };
            }
            
            // 处理其他文本字段（兼容性）
            if (event.type === 'text' && event.text !== undefined) {
              yield {
                type: 'text',
                content: event.text
              };
            }
            
            // 处理步骤完成事件（忽略，继续）
            if (event.type === 'step_finish') {
              // 步骤完成，继续等待更多内容
            }
            
          } catch (parseError) {
            console.warn('Failed to parse CLI response line:', line, parseError);
            // 继续处理其他行
          }
        }
      } finally {
        rl.close();
      }

      // 等待进程退出并检查状态
      const exitCode = await exitPromise;

      // 记录 stderr（如果有）
      if (stderr && !stderr.includes('DEBUG') && !stderr.includes('INFO')) {
        console.warn('CLI stderr:', stderr);
      }

      if (exitCode !== 0) {
        throw new Error(`OpenCode CLI exited with code ${exitCode}. Stderr: ${stderr.substring(0, 500)}`);
      }
      
      yield { type: 'done' };

    } catch (error) {
      console.error('CLI query failed:', error);
      console.error('Temp file path:', tempFile);
      console.error('Temp file exists:', fs.existsSync(tempFile));
      
      // 记录详细的错误信息
      if (error && typeof error === 'object') {
        const err = error as any;
        if (err.stdout) {
          console.error('CLI stdout (first 1000 chars):', String(err.stdout).substring(0, 1000));
        }
        if (err.stderr) {
          console.error('CLI stderr (first 1000 chars):', String(err.stderr).substring(0, 1000));
        }
        if (err.code !== undefined) {
          console.error('CLI exit code:', err.code);
        }
        if (err.signal) {
          console.error('CLI signal:', err.signal);
        }
      }
      
      // 尝试读取临时文件内容以进行调试
      try {
        if (fs.existsSync(tempFile)) {
          const fileContent = fs.readFileSync(tempFile, 'utf8');
          console.error('Temporary file content (first 500 chars):', fileContent.substring(0, 500));
        }
      } catch (readError) {
        console.error('Failed to read temp file:', readError);
      }
      
      // Yield error chunk instead of throwing
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'CLI pipe query failed'
      };
      return;
    } finally {
      // 清理临时文件
      if (tempFileCreated) {
        try {
          if (fs.existsSync(tempFile)) {
            this.safeUnlink(tempFile);
            console.log('Cleaned up temporary file:', tempFile);
          }
        } catch (cleanupError) {
          console.warn('Failed to cleanup temporary file:', tempFile, cleanupError);
        }
      }
    }
  }

  private async *queryViaCLIPipe(
    prompt: string,
    options?: QueryOptions
  ): AsyncGenerator<StreamChunk> {
    if (!this.opencodePath) {
      throw new Error('OpenCode CLI not available');
    }

    // 构建完整的消息，包含系统提示和对话历史
    const messages = this.buildMessages(prompt, options);
    const model = options?.model || this.getActiveModel();
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens;

    // 创建临时文件存储请求数据
    const tempDir = this.getTempDir();
    const tempFile = path.join(tempDir, `opencode-request-${Date.now()}.json`);
    let tempFileCreated = false;

    try {
      // 构建请求数据
      const requestData = {
        messages,
        model,
        temperature,
        max_tokens: maxTokens,
        stream: true // 启用流式响应
      };

      console.log('Request data:', JSON.stringify(requestData, null, 2));

      // 写入临时文件
      fs.writeFileSync(tempFile, JSON.stringify(requestData, null, 2));
      tempFileCreated = true;
      console.log('Created temporary request file:', tempFile);

      // 构建命令参数
      const args = this.buildCLIArgs(options);
      
      // 构建管道命令
      const opencodeCmd = `"${this.opencodePath}" ${args.join(' ')}`;
      const pipeCmd = process.platform === 'win32' 
        ? `type "${tempFile}" | ${opencodeCmd}`
        : `cat "${tempFile}" | ${opencodeCmd}`;
      
      console.log('Executing pipe command:', pipeCmd);

      // 使用 spawn 执行管道命令，以支持流式输出
      const child = spawn(pipeCmd, {
        shell: true,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 设置超时
      const timeout = 300000; // 300秒
      const timeoutId = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch (e) {
          console.warn('Failed to kill child process on timeout:', e);
        }
      }, timeout);

      // 收集 stderr 用于错误报告
      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 创建 readline 接口用于逐行处理 stdout
      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity
      });

      // 创建进程退出 promise
      const exitPromise = new Promise<number | null>((resolve, reject) => {
        child.on('error', reject);
        
        child.on('close', (code, _signal) => {
          clearTimeout(timeoutId);
          resolve(code);
        });
      });

      // 实时逐行处理 stdout 流
      try {
        for await (const line of rl) {
          if (!line.trim()) continue;
          
          try {
            const event = JSON.parse(line.trim());
            
            // 处理错误事件
            if (event.type === 'error') {
              console.error('CLI error event:', event);
              yield {
                type: 'error',
                error: event.error?.message || event.error || 'CLI error'
              };
              return;
            }
            
            // 处理思考事件
            if (event.type === 'reasoning' && event.part?.text !== undefined) {
              yield {
                type: 'thinking',
                content: event.part.text
              };
            }
            
            // 处理文本事件
            if (event.type === 'text' && event.part?.text !== undefined) {
              yield {
                type: 'text',
                content: event.part.text
              };
            }
            
            // 处理其他文本字段（兼容性）
            if (event.type === 'text' && event.text !== undefined) {
              yield {
                type: 'text',
                content: event.text
              };
            }
            
            // 处理步骤完成事件（忽略，继续）
            if (event.type === 'step_finish') {
              // 步骤完成，继续等待更多内容
            }
            
          } catch (parseError) {
            console.warn('Failed to parse CLI response line:', line, parseError);
            // 继续处理其他行
          }
        }
      } finally {
        rl.close();
      }

      // 等待进程退出并检查状态
      const exitCode = await exitPromise;

      // 记录 stderr（如果有）
      if (stderr && !stderr.includes('DEBUG') && !stderr.includes('INFO')) {
        console.warn('CLI stderr:', stderr);
      }

      if (exitCode !== 0) {
        throw new Error(`OpenCode CLI exited with code ${exitCode}. Stderr: ${stderr.substring(0, 500)}`);
      }
      
      yield { type: 'done' };

    } catch (error) {
      console.error('CLI pipe query failed:', error);
      console.error('Temp file path:', tempFile);
      console.error('Temp file exists:', fs.existsSync(tempFile));
      
      // 记录详细的错误信息
      if (error && typeof error === 'object') {
        const err = error as any;
        if (err.stdout) {
          console.error('CLI stdout (first 1000 chars):', String(err.stdout).substring(0, 1000));
        }
        if (err.stderr) {
          console.error('CLI stderr (first 1000 chars):', String(err.stderr).substring(0, 1000));
        }
        if (err.code !== undefined) {
          console.error('CLI exit code:', err.code);
        }
        if (err.signal) {
          console.error('CLI signal:', err.signal);
        }
      }
      
      // 尝试读取临时文件内容以进行调试
      try {
        if (fs.existsSync(tempFile)) {
          const fileContent = fs.readFileSync(tempFile, 'utf8');
          console.error('Temporary file content (first 500 chars):', fileContent.substring(0, 500));
        }
      } catch (readError) {
        console.error('Failed to read temp file:', readError);
      }
      
      // Yield error chunk instead of throwing
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'CLI pipe query failed'
      };
      return;
    } finally {
      // 清理临时文件
      if (tempFileCreated) {
        try {
          if (fs.existsSync(tempFile)) {
            this.safeUnlink(tempFile);
            console.log('Cleaned up temporary file:', tempFile);
          }
        } catch (cleanupError) {
          console.warn('Failed to cleanup temporary file:', tempFile, cleanupError);
        }
      }
    }
  }

  private async *queryViaCLIRedirect(
    prompt: string,
    options?: QueryOptions
  ): AsyncGenerator<StreamChunk> {
    if (!this.opencodePath) {
      throw new Error('OpenCode CLI not available');
    }

    // 构建完整的消息，包含系统提示和对话历史
    const messages = this.buildMessages(prompt, options);
    const model = options?.model || this.getActiveModel();
    const temperature = options?.temperature ?? 0.7;
    const maxTokens = options?.maxTokens;

    // 创建临时文件存储请求数据
    const tempDir = this.getTempDir();
    const tempFile = path.join(tempDir, `opencode-request-${Date.now()}.json`);
    let tempFileCreated = false;

    try {
      // 构建请求数据
      const requestData = {
        messages,
        model,
        temperature,
        max_tokens: maxTokens,
        stream: true // 启用流式响应
      };

      console.log('Request data:', JSON.stringify(requestData, null, 2));

      // 写入临时文件
      fs.writeFileSync(tempFile, JSON.stringify(requestData, null, 2));
      tempFileCreated = true;
      console.log('Created temporary request file:', tempFile);

      // 构建命令参数
      const args = this.buildCLIArgs(options);
      
      // 构建完整的命令：使用重定向将文件内容作为输入
      const opencodeCmd = `"${this.opencodePath}" ${args.join(' ')}`;
      const redirectCmd = `${opencodeCmd} < "${tempFile}"`;
      
      console.log('Executing redirect command:', redirectCmd);

      // 使用 spawn 执行重定向命令，以支持流式输出
      const child = spawn(redirectCmd, {
        shell: true,
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // 设置超时
      const timeout = 300000; // 300秒
      const timeoutId = setTimeout(() => {
        try {
          child.kill('SIGTERM');
        } catch (e) {
          console.warn('Failed to kill child process on timeout:', e);
        }
      }, timeout);

      // 收集 stderr 用于错误报告
      let stderr = '';
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // 创建 readline 接口用于逐行处理 stdout
      const rl = readline.createInterface({
        input: child.stdout,
        crlfDelay: Infinity
      });

      // 创建进程退出 promise
      const exitPromise = new Promise<number | null>((resolve, reject) => {
        child.on('error', reject);
        
        child.on('close', (code, _signal) => {
          clearTimeout(timeoutId);
          resolve(code);
        });
      });

      // 实时逐行处理 stdout 流
      try {
        for await (const line of rl) {
          if (!line.trim()) continue;
          
          try {
            const event = JSON.parse(line.trim());
            
            // 处理错误事件
            if (event.type === 'error') {
              console.error('CLI error event:', event);
              yield {
                type: 'error',
                error: event.error?.message || event.error || 'CLI error'
              };
              return;
            }
            
            // 处理思考事件
            if (event.type === 'reasoning' && event.part?.text !== undefined) {
              yield {
                type: 'thinking',
                content: event.part.text
              };
            }
            
            // 处理文本事件
            if (event.type === 'text' && event.part?.text !== undefined) {
              yield {
                type: 'text',
                content: event.part.text
              };
            }
            
            // 处理其他文本字段（兼容性）
            if (event.type === 'text' && event.text !== undefined) {
              yield {
                type: 'text',
                content: event.text
              };
            }
            
            // 处理步骤完成事件（忽略，继续）
            if (event.type === 'step_finish') {
              // 步骤完成，继续等待更多内容
            }
            
          } catch (parseError) {
            console.warn('Failed to parse CLI response line:', line, parseError);
            // 继续处理其他行
          }
        }
      } finally {
        rl.close();
      }

      // 等待进程退出并检查状态
      const exitCode = await exitPromise;

      // 记录 stderr（如果有）
      if (stderr && !stderr.includes('DEBUG') && !stderr.includes('INFO')) {
        console.warn('CLI stderr:', stderr);
      }

      if (exitCode !== 0) {
        throw new Error(`OpenCode CLI exited with code ${exitCode}. Stderr: ${stderr.substring(0, 500)}`);
      }
      
      yield { type: 'done' };

    } catch (error) {
      console.error('CLI redirect query failed:', error);
      console.error('Temp file path:', tempFile);
      console.error('Temp file exists:', fs.existsSync(tempFile));
      
      // 记录详细的错误信息
      if (error && typeof error === 'object') {
        const err = error as any;
        if (err.stdout) {
          console.error('CLI stdout (first 1000 chars):', String(err.stdout).substring(0, 1000));
        }
        if (err.stderr) {
          console.error('CLI stderr (first 1000 chars):', String(err.stderr).substring(0, 1000));
        }
        if (err.code !== undefined) {
          console.error('CLI exit code:', err.code);
        }
        if (err.signal) {
          console.error('CLI signal:', err.signal);
        }
      }
      
      // 尝试读取临时文件内容以进行调试
      try {
        if (fs.existsSync(tempFile)) {
          const fileContent = fs.readFileSync(tempFile, 'utf8');
          console.error('Temporary file content (first 500 chars):', fileContent.substring(0, 500));
        }
      } catch (readError) {
        console.error('Failed to read temp file:', readError);
      }
      
      // Yield error chunk instead of throwing
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'CLI redirect query failed'
      };
      return;
    } finally {
      // 清理临时文件
      if (tempFileCreated) {
        try {
          if (fs.existsSync(tempFile)) {
            this.safeUnlink(tempFile);
            console.log('Cleaned up temporary file:', tempFile);
          }
        } catch (cleanupError) {
          console.warn('Failed to cleanup temporary file:', tempFile, cleanupError);
        }
      }
    }
  }

  private async *queryViaAPI(
    prompt: string,
    options?: QueryOptions
  ): AsyncGenerator<StreamChunk> {
    const body = this.buildRequestBody(prompt, options);
    const endpoint = this.getAPIEndpoint(options?.model);
    
    console.log('Sending request to:', endpoint);
    console.log('Model:', body.model);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: this.getHeaders(options?.model),
      body: JSON.stringify(body),
      signal: this.abortController?.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    if (body.stream) {
      yield* this.handleStreamingResponse(response);
    } else {
      const data = await response.json();
      yield* this.handleNonStreamingResponse(data);
    }
  }

  stopGeneration(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  private buildRequestBody(prompt: string, options?: QueryOptions): any {
    const messages = this.buildMessages(prompt, options);
    const model = options?.model || this.getActiveModel();
    
    // Extract the model name without provider prefix for API
    const modelName = model.includes('/') ? model.split('/')[1] : model;
    
    const body: any = {
      model: modelName,
      messages,
      stream: options?.stream !== false,
      temperature: options?.temperature ?? 0.7,
    };

    if (options?.maxTokens) {
      body.max_tokens = options.maxTokens;
    }

    // 添加思考模式参数（Claude 模型）
    if (model.includes('claude') && options?.thinking) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: 16000
      };
    }

    return body;
  }

  private buildMessages(prompt: string, options?: QueryOptions): any[] {
    const messages: any[] = [];

    // 添加系统提示
    if (options?.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }

    // 添加对话历史
    if (options?.conversationHistory) {
      for (const msg of options.conversationHistory) {
        // 检查历史消息是否有附件
        if (msg.images && msg.images.length > 0) {
          // 检查附件是否已保存到文件系统（有 filePath）
          const hasFileAttachments = msg.images.some((att: any) => att.filePath);
          
          if (hasFileAttachments) {
            // 新格式：附件已保存到文件，文件路径已包含在消息内容中
            // 直接使用消息内容，不添加额外的附件内容
            messages.push({
              role: msg.role,
              content: msg.content
            });
          } else {
            // 旧格式：附件以base64嵌入
            // 构建包含附件的内容数组
            const contentParts: any[] = [];
            
            // 添加附件
            for (const attachment of msg.images) {
              contentParts.push(...this.buildAttachmentContent(attachment));
            }
            
            // 添加文本内容（如果有）
            if (msg.content && msg.content.trim()) {
              contentParts.push({
                type: 'text',
                text: msg.content
              });
            }
            
            messages.push({
              role: msg.role,
              content: contentParts
            });
          }
        } else {
          // 普通文本消息
          messages.push({
            role: msg.role,
            content: msg.content
          });
        }
      }
    }

    // 添加当前提示（可能包含附件）
    const currentAttachments = options?.attachments || [];
    
    // 检查是否有附件已经保存到文件系统（有 filePath）
    const hasFileAttachments = currentAttachments.some(att => att.filePath);
    
    if (currentAttachments.length > 0 && !hasFileAttachments) {
      // 旧格式：附件以base64嵌入
      // 构建包含附件的内容数组
      const contentParts: any[] = [];
      
      // 添加附件
      for (const attachment of currentAttachments) {
        contentParts.push(...this.buildAttachmentContent(attachment));
      }
      
      // 添加文本内容
      contentParts.push({
        type: 'text',
        text: prompt
      });
      
      messages.push({
        role: 'user',
        content: contentParts
      });
    } else {
      // 新格式：附件已保存到文件，文件路径已包含在提示中
      // 或者没有附件，普通文本消息
      messages.push({
        role: 'user',
        content: prompt
      });
    }

    return messages;
  }

  private buildAttachmentContent(attachment: ImageAttachment): any[] {
    const contentParts: any[] = [];
    
    // 文件已保存到仓库的附件目录，通过 filePath 字段访问
    // 用户消息中已包含文件路径信息，这里只需提供简单的引用
    if (attachment.filePath) {
      // 文件已保存到仓库，可以通过 MCP read_file 工具读取
      contentParts.push({
        type: 'text',
        text: `[附件: ${attachment.fileName || '文件'} - 已保存到仓库: ${attachment.filePath}]`
      });
    } else if (attachment.mimeType.startsWith('image/')) {
      // 图片附件（无文件路径的旧格式）
      contentParts.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: attachment.mimeType,
          data: attachment.base64Data
        }
      });
    } else if (
      attachment.mimeType.includes('text/') ||
      attachment.mimeType.includes('application/json') ||
      attachment.mimeType.includes('application/javascript') ||
      attachment.mimeType.includes('application/xml') ||
      attachment.fileName?.match(/\.(txt|md|json|js|ts|jsx|tsx|py|java|c|cpp|h|cs|html|css|xml|yaml|yml|sql|sh|bash)$/i)
    ) {
      // 文本文件（无文件路径的旧格式）：尝试解码base64数据
      try {
        let textContent: string;
        try {
          textContent = Buffer.from(attachment.base64Data, 'base64').toString('utf-8');
        } catch {
          textContent = (globalThis as any).atob?.(attachment.base64Data) || `[无法解码base64内容]`;
        }
        
        contentParts.push({
          type: 'text',
          text: `[文件: ${attachment.fileName || 'attachment'}]\n\n${textContent}`
        });
      } catch (error) {
        console.warn('Failed to decode text attachment:', error);
        contentParts.push({
          type: 'text',
          text: `[文件: ${attachment.fileName || 'attachment'} (文本文件，解码失败)]`
        });
      }
    } else if (
      attachment.mimeType.includes('application/pdf') ||
      attachment.fileName?.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)
    ) {
      // PDF或Office文档：提供文件信息但不包含内容
      contentParts.push({
        type: 'text',
        text: `[文件: ${attachment.fileName || 'attachment'} (${attachment.mimeType}) - 由于格式限制，无法提取文本内容]`
      });
    } else {
      // 其他二进制文件
      contentParts.push({
        type: 'text',
        text: `[文件: ${attachment.fileName || 'attachment'} (${attachment.mimeType}) - 二进制文件]`
      });
    }
    
    return contentParts;
  }

  private getAPIEndpoint(modelId?: string): string {
    const model = modelId || this.getActiveModel();

    // 本地模型
    if (this.plugin.settings.localModel.enabled || model.startsWith('local/')) {
      const baseUrl = this.plugin.settings.localModel.baseUrl.replace(/\/$/, '');
      return `${baseUrl}/v1/chat/completions`;
    }

    // OpenCode Zen 模型
    if (model.startsWith('opencode/')) {
      return getModelEndpoint(model);
    }

    // 使用配置的 provider
    if (this.activeProvider?.baseURL) {
      return `${this.activeProvider.baseURL}/chat/completions`;
    }

    // 默认使用 OpenCode Zen
    return 'https://opencode.ai/zen/v1/chat/completions';
  }

  private getHeaders(modelId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const model = modelId || this.getActiveModel();

    // 本地模型不需要认证
    if (this.plugin.settings.localModel.enabled || model.startsWith('local/')) {
      return headers;
    }

    // OpenCode Zen 模型
    if (model.startsWith('opencode/')) {
      const apiKey = this.plugin.settings.opencodeZenApiKey 
        || this.opencodeAuth?.['opencode']?.apiKey;
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
      }
      return headers;
    }

    // 其他提供商
    if (this.activeProvider?.apiKey) {
      headers['Authorization'] = `Bearer ${this.activeProvider.apiKey}`;
    }

    return headers;
  }

  private async *handleStreamingResponse(response: Response): AsyncGenerator<StreamChunk> {
    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

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
          if (line.trim() === '' || !line.startsWith('data: ')) continue;
          
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { type: 'done' };
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            
            // 处理思考过程
            if (delta?.thinking) {
              yield {
                type: 'thinking',
                content: delta.thinking
              };
            }
            
            if (delta?.content) {
              yield {
                type: 'text',
                content: delta.content
              };
            }
          } catch {
            // 忽略解析错误
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done' };
  }

  private async *handleNonStreamingResponse(data: any): AsyncGenerator<StreamChunk> {
    const content = data.choices?.[0]?.message?.content || '';
    
    yield {
      type: 'text',
      content
    };
    
    yield { type: 'done' };
  }

  // OpenCode Session Sync Methods

  async syncDeleteSession(sessionId: string): Promise<boolean> {
    if (!this.plugin.settings.syncWithOpenCode) {
      return true;
    }

    // Method 1: Try using CLI
    if (this.opencodePath) {
      try {
        await execAsync(`"${this.opencodePath}" session delete ${sessionId}`);
        console.log(`Deleted session ${sessionId} via CLI`);
        return true;
      } catch (error) {
        console.warn('Failed to delete session via CLI:', error);
      }
    }

    // Method 2: Try deleting session file directly
    const sessionsPath = this.getSessionsPath();
    if (sessionsPath) {
      try {
        const sessionFile = path.join(sessionsPath, `${sessionId}.json`);
        if (fs.existsSync(sessionFile)) {
          fs.unlinkSync(sessionFile);
          console.log(`Deleted session file ${sessionFile}`);
          return true;
        }
      } catch (error) {
        console.warn('Failed to delete session file:', error);
      }
    }

    return false;
  }

  async listOpenCodeSessions(): Promise<string[]> {
    // Method 1: Try using CLI
    if (this.opencodePath) {
      try {
        const { stdout } = await execAsync(`"${this.opencodePath}" session list --format json`);
        const sessions = JSON.parse(stdout);
        return sessions.map((s: any) => s.id);
      } catch {
        // Fall through to file method
      }
    }

    // Method 2: Read session files directly
    const sessionsPath = this.getSessionsPath();
    if (sessionsPath && fs.existsSync(sessionsPath)) {
      try {
        const files = fs.readdirSync(sessionsPath);
        return files
          .filter(f => f.endsWith('.json'))
          .map(f => f.replace('.json', ''));
      } catch {
        return [];
      }
    }

    return [];
  }

  async getOpenCodeSession(sessionId: string): Promise<OpenCodeSession | null> {
    const sessionsPath = this.getSessionsPath();
    if (!sessionsPath) return null;

    try {
      const sessionFile = path.join(sessionsPath, `${sessionId}.json`);
      if (fs.existsSync(sessionFile)) {
        const content = fs.readFileSync(sessionFile, 'utf-8');
        return JSON.parse(content);
      }
    } catch {
      return null;
    }

    return null;
  }

  getConfig(): OpenCodeConfig | null {
    return this.opencodeConfig;
  }

  getAuth(): OpenCodeAuth | null {
    return this.opencodeAuth;
  }

  setSessionId(sessionId: string | null): void {
    this.currentSessionId = sessionId;
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

  getOpenCodePath(): string | null {
    return this.opencodePath;
  }
}
