export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  displayContent?: string;
  timestamp: number;
  images?: ImageAttachment[];
  toolCalls?: ToolCall[];
  thinking?: string;
  isStreaming?: boolean;
  error?: string;
}

export interface ImageAttachment {
  id: string;
  mimeType: string;
  base64Data: string;
  fileName?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  error?: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model: string;
  contextFiles: string[];
  sessionId?: string;
}

export interface StreamChunk {
  type: 'text' | 'thinking' | 'tool_call' | 'tool_result' | 'error' | 'done';
  content?: string;
  toolCall?: ToolCall;
  error?: string;
}

export interface EditorContext {
  filePath?: string;
  selectedText?: string;
  cursorLine?: number;
  cursorColumn?: number;
}

export type QueryOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  tools?: string[];
  conversationHistory?: ChatMessage[];
  stream?: boolean;
  thinking?: boolean;
};
