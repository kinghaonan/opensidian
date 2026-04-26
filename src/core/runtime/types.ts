import { ChatMessage, ImageAttachment, StreamChunk } from '../types/chat';

export type ChatTurnRequest = {
  prompt: string;
  conversationHistory?: ChatMessage[];
  systemPrompt?: string;
  stream?: boolean;
  thinking?: boolean;
  attachments?: ImageAttachment[];
};

export type PreparedChatTurn = {
  request: ChatTurnRequest;
  model: string;
  temperature: number;
  maxTokens?: number;
};

export type ChatRuntimeQueryOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: boolean;
  sessionId?: string;
};

export type RuntimeState = 'uninitialized' | 'ready' | 'busy' | 'error';

export type RuntimeStateListener = (state: RuntimeState) => void;
