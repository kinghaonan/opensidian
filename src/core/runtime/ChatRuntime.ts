import { StreamChunk, ChatMessage, ModelInfo } from '../types/chat';
import { ProviderCapabilities, ProviderId } from '../providers/types';
import { ChatTurnRequest, PreparedChatTurn, ChatRuntimeQueryOptions, RuntimeState, RuntimeStateListener } from './types';

export interface ToolInfo {
  name: string;
  description?: string;
  enabled: boolean;
  type: 'mcp' | 'skill';
}

export interface ChatRuntime {
  readonly providerId: ProviderId;

  getCapabilities(): ProviderCapabilities;

  ensureReady(): Promise<boolean>;
  isReady(): boolean;

  prepareTurn(request: ChatTurnRequest): PreparedChatTurn;

  query(
    turn: PreparedChatTurn,
    conversationHistory?: ChatMessage[],
    options?: ChatRuntimeQueryOptions
  ): AsyncGenerator<StreamChunk>;

  cancel(): void;

  getAvailableModels(): Promise<ModelInfo[]>;
  getAvailableTools(): Promise<ToolInfo[]>;

  getActiveModel(): string;
  switchModel(modelId: string): Promise<void>;

  onStateChange(listener: RuntimeStateListener): () => void;

  reset(): void;
}
