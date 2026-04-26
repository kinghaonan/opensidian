/**
 * OpenCode Message Channel
 * 
 * 基于队列的异步迭代器，用于持久化查询。
 * 处理消息队列、轮次管理和文本合并。
 */
import type { ImageAttachment } from '../../types/chat';

export const MESSAGE_CHANNEL_CONFIG = {
  MAX_QUEUED_MESSAGES: 8,
  MAX_MERGED_CHARS: 12000,
} as const;

interface PendingTextMessage {
  type: 'text';
  content: string;
  images?: ImageAttachment[];
}

interface PendingAttachmentMessage {
  type: 'attachment';
  content: string;
  images: ImageAttachment[];
}

type PendingMessage = PendingTextMessage | PendingAttachmentMessage;

export interface ResponseHandler {
  readonly id: string;
  onChunk: (chunk: { type: string; content?: string; error?: string }) => void;
  onDone: () => void;
  onError: (error: Error) => void;
  readonly sawStreamText: boolean;
  readonly sawAnyChunk: boolean;
  markStreamTextSeen(): void;
  resetStreamText(): void;
  markChunkSeen(): void;
}

export interface ResponseHandlerOptions {
  id: string;
  onChunk: (chunk: { type: string; content?: string; error?: string }) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export function createResponseHandler(options: ResponseHandlerOptions): ResponseHandler {
  let _sawStreamText = false;
  let _sawAnyChunk = false;

  return {
    id: options.id,
    onChunk: options.onChunk,
    onDone: options.onDone,
    onError: options.onError,
    get sawStreamText() { return _sawStreamText; },
    get sawAnyChunk() { return _sawAnyChunk; },
    markStreamTextSeen() { _sawStreamText = true; },
    resetStreamText() { _sawStreamText = false; },
    markChunkSeen() { _sawAnyChunk = true; },
  };
}

export class MessageChannel {
  private queue: PendingMessage[] = [];
  private turnActive = false;
  private closed = false;
  private currentSessionId: string | null = null;
  private onWarning: (message: string) => void;
  private resolveNext: ((value: IteratorResult<PendingMessage>) => void) | null = null;

  constructor(onWarning: (message: string) => void = console.warn) {
    this.onWarning = onWarning;
  }

  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

  isTurnActive(): boolean {
    return this.turnActive;
  }

  isClosed(): boolean {
    return this.closed;
  }

  enqueue(content: string, images?: ImageAttachment[]): void {
    if (this.closed) {
      throw new Error('MessageChannel is closed');
    }

    const hasImages = images && images.length > 0;

    if (!this.turnActive) {
      if (this.resolveNext) {
        this.turnActive = true;
        const resolve = this.resolveNext;
        this.resolveNext = null;
        
        if (hasImages) {
          resolve({ value: { type: 'attachment', content, images: images! }, done: false });
        } else {
          resolve({ value: { type: 'text', content }, done: false });
        }
      } else {
        if (this.queue.length >= MESSAGE_CHANNEL_CONFIG.MAX_QUEUED_MESSAGES) {
          this.onWarning(`[MessageChannel] 队列已满 (${MESSAGE_CHANNEL_CONFIG.MAX_QUEUED_MESSAGES})，丢弃最新消息`);
          return;
        }
        if (hasImages) {
          this.queue.push({ type: 'attachment', content, images: images! });
        } else {
          this.queue.push({ type: 'text', content });
        }
      }
      return;
    }

    if (hasImages) {
      const existingIdx = this.queue.findIndex(m => m.type === 'attachment');
      if (existingIdx >= 0) {
        this.queue[existingIdx] = { type: 'attachment', content, images: images! };
        this.onWarning('[MessageChannel] 附件消息已替换（只能排队一个）');
      } else {
        if (this.queue.length >= MESSAGE_CHANNEL_CONFIG.MAX_QUEUED_MESSAGES) {
          this.onWarning(`[MessageChannel] 队列已满，丢弃最新消息`);
          return;
        }
        this.queue.push({ type: 'attachment', content, images: images! });
      }
      return;
    }

    const existingTextIdx = this.queue.findIndex(m => m.type === 'text');
    if (existingTextIdx >= 0) {
      const existing = this.queue[existingTextIdx] as PendingTextMessage;
      const mergedContent = existing.content + '\n\n' + content;
      if (mergedContent.length > MESSAGE_CHANNEL_CONFIG.MAX_MERGED_CHARS) {
        this.onWarning(`[MessageChannel] 合并内容超过 ${MESSAGE_CHANNEL_CONFIG.MAX_MERGED_CHARS} 字符，丢弃最新消息`);
        return;
      }
      existing.content = mergedContent;
    } else {
      if (this.queue.length >= MESSAGE_CHANNEL_CONFIG.MAX_QUEUED_MESSAGES) {
        this.onWarning(`[MessageChannel] 队列已满，丢弃最新消息`);
        return;
      }
      this.queue.push({ type: 'text', content });
    }
  }

  onTurnComplete(): void {
    this.turnActive = false;
    if (this.queue.length > 0 && this.resolveNext) {
      const pending = this.queue.shift()!;
      this.turnActive = true;
      const resolve = this.resolveNext;
      this.resolveNext = null;
      resolve({ value: pending, done: false });
    }
  }

  close(): void {
    this.closed = true;
    this.queue = [];
    if (this.resolveNext) {
      const resolve = this.resolveNext;
      this.resolveNext = null;
      resolve({ value: undefined, done: true } as IteratorResult<PendingMessage>);
    }
  }

  reset(): void {
    this.queue = [];
    this.turnActive = false;
    this.closed = false;
    this.resolveNext = null;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  async waitForNext(): Promise<PendingMessage | null> {
    if (this.closed) return null;
    if (this.queue.length > 0 && !this.turnActive) {
      const pending = this.queue.shift()!;
      this.turnActive = true;
      return pending;
    }
    return new Promise((resolve) => {
      this.resolveNext = (result) => {
        resolve(result.value ?? null);
      };
    });
  }
}
