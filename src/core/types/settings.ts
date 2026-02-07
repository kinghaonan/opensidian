export type PermissionMode = 'yolo' | 'safe' | 'plan';
export type AgentMode = 'plan' | 'build';
export type Language = 'zh' | 'en';

export interface BlockedCommands {
  global: string[];
  darwin?: string[];
  win32?: string[];
  linux?: string[];
}

export interface ExternalMCPServer {
  name: string;
  type: 'stdio' | 'sse' | 'http';
  enabled: boolean;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface LocalModelConfig {
  enabled: boolean;
  provider: 'ollama' | 'lmstudio' | 'custom';
  baseUrl: string;
  model: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  isFree?: boolean;
  endpoint?: string;
  inputPrice?: number;
  outputPrice?: number;
}

export interface OpensidianSettings {
  version: string;
  userName: string;
  language: Language;
  
  // Opencode settings
  opencodeConfigPath?: string;
  autoLoadOpencodeConfig: boolean;
  opencodePath?: string;  // OpenCode CLI 路径
  opencodeZenApiKey?: string;  // OpenCode Zen API Key
  tempDir?: string;  // 临时文件目录（避免特殊字符路径问题）
  disableApiFallback: boolean;  // 禁用API回退（避免CORS错误）
  
  // Model settings
  model: string;
  smallModel: string;
  customModel?: string;
  useFreeModels: boolean;  // 使用免费模型
  
  // Local model settings
  localModel: LocalModelConfig;
  
  // UI settings
  theme: 'auto' | 'light' | 'dark';
  openInMainTab: boolean;
  enableAutoScroll: boolean;
  fontSize: number;
  showThinking: boolean;  // 显示思考过程
  thinkingCollapsed: boolean;  // 思考过程默认折叠
  
  // Context settings
  excludedTags: string[];
  mediaFolder: string;
  maxContextFiles: number;
  
  // Inline edit
  inlineEditHotkey: string;
  showDiffPreview: boolean;
  
  // Safety settings
  permissionMode: PermissionMode;
  agentMode: AgentMode;  // Plan/Build 模式
  enableCommandBlocklist: boolean;
  blockedCommands: BlockedCommands;
  allowedExportPaths: string[];
  
  // MCP settings
  enableInternalMCPServer: boolean;
  externalMCPServers: ExternalMCPServer[];
  
  // Session settings
  autoGenerateTitles: boolean;
  maxConversationHistory: number;
  enableSessionPersistence: boolean;
  conversationRetentionDays: number;  // 历史记录保留天数
  syncWithOpenCode: boolean;  // 是否与 OpenCode 同步会话
  
  // Advanced
  customSystemPrompt: string;
  environmentVariables: string;
  enableDebugMode: boolean;
  cliTimeout: number;  // CLI 超时时间（毫秒）
}

export const DEFAULT_SETTINGS: OpensidianSettings = {
  version: '0.2.0',
  userName: '',
  language: 'zh',
  autoLoadOpencodeConfig: true,
  tempDir: '',  // 默认使用系统临时目录
  disableApiFallback: false,  // 默认启用API回退
  model: 'auto',
  smallModel: 'auto',
  useFreeModels: true,  // 默认启用免费模型
  localModel: {
    enabled: false,
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama2'
  },
  theme: 'auto',
  openInMainTab: false,
  enableAutoScroll: true,
  fontSize: 14,
  showThinking: true,
  thinkingCollapsed: true,
  excludedTags: ['private', 'sensitive', 'confidential'],
  mediaFolder: 'attachments',
  maxContextFiles: 10,
  inlineEditHotkey: 'Mod+Shift+E',
  showDiffPreview: true,
  permissionMode: 'safe',
  agentMode: 'build',  // 默认为 build 模式
  enableCommandBlocklist: true,
  blockedCommands: {
    global: ['rm -rf /', 'dd if=/dev/zero', 'mkfs', 'format'],
  },
  allowedExportPaths: ['~/Desktop', '~/Downloads'],
  enableInternalMCPServer: true,
  externalMCPServers: [],
  autoGenerateTitles: true,
  maxConversationHistory: 100,
  enableSessionPersistence: true,
  conversationRetentionDays: 30,
  syncWithOpenCode: true,  // 默认启用同步
  customSystemPrompt: '',
  environmentVariables: '',
  enableDebugMode: false,
  cliTimeout: 300000,  // 默认 5 分钟超时
};

// OpenCode Zen 免费模型列表
export const FREE_MODELS: ModelInfo[] = [
  { 
    id: 'opencode/gpt-5-nano', 
    name: 'GPT-5 Nano (Free)', 
    provider: 'opencode',
    isFree: true,
    endpoint: 'https://opencode.ai/zen/v1/responses',
    inputPrice: 0,
    outputPrice: 0,
  },
  { 
    id: 'opencode/glm-4.7-free', 
    name: 'GLM 4.7 Free', 
    provider: 'opencode',
    isFree: true,
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    inputPrice: 0,
    outputPrice: 0,
  },
  { 
    id: 'opencode/kimi-k2.5-free', 
    name: 'Kimi K2.5 Free', 
    provider: 'opencode',
    isFree: true,
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    inputPrice: 0,
    outputPrice: 0,
  },
  { 
    id: 'opencode/minimax-m2.1-free', 
    name: 'MiniMax M2.1 Free', 
    provider: 'opencode',
    isFree: true,
    endpoint: 'https://opencode.ai/zen/v1/messages',
    inputPrice: 0,
    outputPrice: 0,
  },
  { 
    id: 'opencode/big-pickle', 
    name: 'Big Pickle (Free)', 
    provider: 'opencode',
    isFree: true,
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    inputPrice: 0,
    outputPrice: 0,
  },
];

// OpenCode Zen 付费模型列表
export const ZEN_MODELS: ModelInfo[] = [
  // OpenAI Models
  { 
    id: 'opencode/gpt-5.2', 
    name: 'GPT 5.2', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/responses',
    inputPrice: 1.75,
    outputPrice: 14.00,
  },
  { 
    id: 'opencode/gpt-5.2-codex', 
    name: 'GPT 5.2 Codex', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/responses',
    inputPrice: 1.75,
    outputPrice: 14.00,
  },
  { 
    id: 'opencode/gpt-5.1', 
    name: 'GPT 5.1', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/responses',
    inputPrice: 1.07,
    outputPrice: 8.50,
  },
  { 
    id: 'opencode/gpt-5.1-codex', 
    name: 'GPT 5.1 Codex', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/responses',
    inputPrice: 1.07,
    outputPrice: 8.50,
  },
  { 
    id: 'opencode/gpt-5', 
    name: 'GPT 5', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/responses',
    inputPrice: 1.07,
    outputPrice: 8.50,
  },
  { 
    id: 'opencode/gpt-5-codex', 
    name: 'GPT 5 Codex', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/responses',
    inputPrice: 1.07,
    outputPrice: 8.50,
  },
  // Anthropic Models
  { 
    id: 'opencode/claude-sonnet-4-5', 
    name: 'Claude Sonnet 4.5', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/messages',
    inputPrice: 3.00,
    outputPrice: 15.00,
  },
  { 
    id: 'opencode/claude-sonnet-4', 
    name: 'Claude Sonnet 4', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/messages',
    inputPrice: 3.00,
    outputPrice: 15.00,
  },
  { 
    id: 'opencode/claude-haiku-4-5', 
    name: 'Claude Haiku 4.5', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/messages',
    inputPrice: 1.00,
    outputPrice: 5.00,
  },
  { 
    id: 'opencode/claude-opus-4-6', 
    name: 'Claude Opus 4.6', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/messages',
    inputPrice: 5.00,
    outputPrice: 25.00,
  },
  { 
    id: 'opencode/claude-opus-4-5', 
    name: 'Claude Opus 4.5', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/messages',
    inputPrice: 5.00,
    outputPrice: 25.00,
  },
  // Google Models
  { 
    id: 'opencode/gemini-3-pro', 
    name: 'Gemini 3 Pro', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/models/gemini-3-pro',
    inputPrice: 2.00,
    outputPrice: 12.00,
  },
  { 
    id: 'opencode/gemini-3-flash', 
    name: 'Gemini 3 Flash', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/models/gemini-3-flash',
    inputPrice: 0.50,
    outputPrice: 3.00,
  },
  // Other Models
  { 
    id: 'opencode/minimax-m2.1', 
    name: 'MiniMax M2.1', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    inputPrice: 0.30,
    outputPrice: 1.20,
  },
  { 
    id: 'opencode/glm-4.7', 
    name: 'GLM 4.7', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    inputPrice: 0.60,
    outputPrice: 2.20,
  },
  { 
    id: 'opencode/kimi-k2.5', 
    name: 'Kimi K2.5', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    inputPrice: 0.60,
    outputPrice: 3.00,
  },
  { 
    id: 'opencode/qwen3-coder', 
    name: 'Qwen3 Coder 480B', 
    provider: 'opencode',
    endpoint: 'https://opencode.ai/zen/v1/chat/completions',
    inputPrice: 0.45,
    outputPrice: 1.50,
  },
];

// 常用模型列表（直接使用提供商 API）
export const POPULAR_MODELS: ModelInfo[] = [
  { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic' },
  { id: 'anthropic/claude-opus-4', name: 'Claude Opus 4', provider: 'anthropic' },
  { id: 'openai/gpt-5', name: 'GPT-5', provider: 'openai' },
  { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini', provider: 'openai' },
  { id: 'google/gemini-3-pro', name: 'Gemini 3 Pro', provider: 'google' },
];

// 获取所有可用模型
export function getAllModels(includeZen: boolean = true): ModelInfo[] {
  const models: ModelInfo[] = [...FREE_MODELS];
  if (includeZen) {
    models.push(...ZEN_MODELS);
  }
  models.push(...POPULAR_MODELS);
  return models;
}

// 根据 ID 获取模型信息
export function getModelById(modelId: string): ModelInfo | undefined {
  const allModels = getAllModels();
  return allModels.find(m => m.id === modelId);
}

// 获取模型端点
export function getModelEndpoint(modelId: string): string {
  const model = getModelById(modelId);
  if (model?.endpoint) {
    return model.endpoint;
  }
  
  // 默认端点
  if (modelId.startsWith('opencode/')) {
    return 'https://opencode.ai/zen/v1/chat/completions';
  }
  if (modelId.startsWith('anthropic/')) {
    return 'https://api.anthropic.com/v1/messages';
  }
  if (modelId.startsWith('openai/')) {
    return 'https://api.openai.com/v1/chat/completions';
  }
  if (modelId.startsWith('google/')) {
    return 'https://generativelanguage.googleapis.com/v1beta/models';
  }
  
  return 'https://api.openai.com/v1/chat/completions';
}
