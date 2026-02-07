export interface OpenCodeConfig {
  $schema?: string;
  model?: string;
  small_model?: string;
  provider?: Record<string, ProviderConfig>;
  mcp?: Record<string, MCPServerConfig>;
  tools?: Record<string, boolean>;
  agent?: Record<string, AgentConfig>;
  default_agent?: string;
  instructions?: string[];
  theme?: string;
  autoupdate?: boolean;
  compaction?: {
    auto?: boolean;
    prune?: boolean;
  };
  permissions?: Record<string, 'ask' | 'allow' | 'deny'>;
  [key: string]: any;
}

export interface ProviderConfig {
  npm?: string;
  name?: string;
  options?: {
    apiKey?: string;
    baseURL?: string;
    timeout?: number;
    headers?: Record<string, string>;
    [key: string]: any;
  };
  models?: Record<string, ModelConfig>;
}

export interface ModelConfig {
  name?: string;
  id?: string;
  limit?: {
    context?: number;
    output?: number;
  };
  options?: Record<string, any>;
  variants?: Record<string, Record<string, any>>;
}

export interface MCPServerConfig {
  type: 'local' | 'remote';
  command?: string[];
  url?: string;
  enabled?: boolean;
  environment?: Record<string, string>;
  headers?: Record<string, string>;
  oauth?: Record<string, any> | false;
  timeout?: number;
}

export interface AgentConfig {
  description?: string;
  model?: string;
  prompt?: string;
  tools?: Record<string, boolean>;
}

export interface OpenCodeAuth {
  [provider: string]: {
    apiKey?: string;
    [key: string]: any;
  };
}
