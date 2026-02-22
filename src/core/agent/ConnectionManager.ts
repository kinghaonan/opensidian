/**
 * Connection Manager
 * 
 * 管理API连接的稳定性，包括：
 * - 自动重连
 * - 心跳检测
 * - 错误恢复
 * - 连接状态跟踪
 */

import { Notice } from 'obsidian';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';

export interface ConnectionOptions {
  maxRetries: number;
  retryDelay: number;
  heartbeatInterval: number;
  timeout: number;
}

const DEFAULT_OPTIONS: ConnectionOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  heartbeatInterval: 30000,
  timeout: 300000,
};

export interface ConnectionEventListeners {
  onStateChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
  onReconnect?: (attempt: number) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

/**
 * ConnectionManager - 管理连接状态和重连逻辑
 */
export class ConnectionManager {
  private state: ConnectionState = 'disconnected';
  private retryCount = 0;
  private options: ConnectionOptions;
  private listeners: ConnectionEventListeners = {};
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private lastError: Error | null = null;
  private consecutiveFailures = 0;
  private maxConsecutiveFailures = 5;

  constructor(options: Partial<ConnectionOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * 设置事件监听器
   */
  setListeners(listeners: ConnectionEventListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }

  /**
   * 获取当前状态
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 获取最后的错误
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * 开始连接
   */
  async connect(connectFn: () => Promise<void>): Promise<boolean> {
    this.setState('connecting');
    
    try {
      await connectFn();
      this.onConnected();
      return true;
    } catch (error) {
      this.onError(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * 连接成功回调
   */
  private onConnected(): void {
    this.state = 'connected';
    this.retryCount = 0;
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.startHeartbeat();
    this.listeners.onConnected?.();
    this.listeners.onStateChange?.('connected');
  }

  /**
   * 连接错误处理
   */
  private onError(error: Error): void {
    this.lastError = error;
    this.consecutiveFailures++;
    
    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.setState('error');
      this.listeners.onError?.(error);
      new Notice(`连接失败: ${error.message}。请检查网络或API配置。`);
      return;
    }

    if (this.retryCount < this.options.maxRetries) {
      this.scheduleReconnect();
    } else {
      this.setState('error');
      this.listeners.onError?.(error);
    }
  }

  /**
   * 安排重连
   */
  private scheduleReconnect(): void {
    this.setState('reconnecting');
    this.retryCount++;
    
    const delay = this.options.retryDelay * Math.pow(2, this.retryCount - 1);
    
    this.reconnectTimer = setTimeout(() => {
      this.listeners.onReconnect?.(this.retryCount);
    }, delay);
  }

  /**
   * 尝试重连
   */
  async reconnect(connectFn: () => Promise<void>): Promise<boolean> {
    return this.connect(connectFn);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimer();
    this.state = 'disconnected';
    this.listeners.onDisconnected?.();
    this.listeners.onStateChange?.('disconnected');
  }

  /**
   * 重置连接状态
   */
  reset(): void {
    this.retryCount = 0;
    this.consecutiveFailures = 0;
    this.lastError = null;
    this.state = 'disconnected';
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.checkConnection();
    }, this.options.heartbeatInterval);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * 检查连接状态
   */
  private checkConnection(): void {
    // 心跳检测逻辑可以在这里实现
    // 目前只是保持连接活跃
  }

  /**
   * 清除重连定时器
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * 设置状态
   */
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.listeners.onStateChange?.(state);
    }
  }

  /**
   * 是否可以重试
   */
  canRetry(): boolean {
    return this.retryCount < this.options.maxRetries && 
           this.consecutiveFailures < this.maxConsecutiveFailures;
  }

  /**
   * 获取重试信息
   */
  getRetryInfo(): { current: number; max: number } {
    return {
      current: this.retryCount,
      max: this.options.maxRetries,
    };
  }
}

/**
 * 流式输出缓冲区管理器
 */
export class StreamBuffer {
  private buffer: string = '';
  private thinkingBuffer: string = '';
  private lastFlushTime: number = 0;
  private flushInterval: number = 50; // 50ms 刷新间隔
  private onFlush?: (content: string, thinking: string) => void;

  constructor(onFlush?: (content: string, thinking: string) => void) {
    this.onFlush = onFlush;
  }

  /**
   * 添加文本内容
   */
  appendText(content: string): void {
    this.buffer += content;
    this.maybeFlush();
  }

  /**
   * 添加思考内容
   */
  appendThinking(content: string): void {
    this.thinkingBuffer += content;
    this.maybeFlush();
  }

  /**
   * 可能需要刷新
   */
  private maybeFlush(): void {
    const now = Date.now();
    if (now - this.lastFlushTime >= this.flushInterval) {
      this.flush();
    }
  }

  /**
   * 强制刷新
   */
  flush(): void {
    if (this.buffer || this.thinkingBuffer) {
      this.onFlush?.(this.buffer, this.thinkingBuffer);
      this.buffer = '';
      this.thinkingBuffer = '';
      this.lastFlushTime = Date.now();
    }
  }

  /**
   * 获取当前缓冲内容
   */
  getContent(): { text: string; thinking: string } {
    return {
      text: this.buffer,
      thinking: this.thinkingBuffer,
    };
  }

  /**
   * 清空缓冲区
   */
  clear(): void {
    this.buffer = '';
    this.thinkingBuffer = '';
    this.lastFlushTime = 0;
  }
}

/**
 * 请求重试策略
 */
export class RetryStrategy {
  private maxRetries: number;
  private baseDelay: number;
  private maxDelay: number;

  constructor(maxRetries = 3, baseDelay = 1000, maxDelay = 30000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  /**
   * 计算下次重试延迟
   */
  getDelay(attempt: number): number {
    const delay = this.baseDelay * Math.pow(2, attempt);
    return Math.min(delay, this.maxDelay);
  }

  /**
   * 是否应该重试
   */
  shouldRetry(attempt: number, error: Error): boolean {
    if (attempt >= this.maxRetries) {
      return false;
    }

    // 特定错误不重试
    const nonRetryableErrors = [
      'invalid_api_key',
      'authentication_error',
      'permission_denied',
    ];

    return !nonRetryableErrors.some(e => 
      error.message.toLowerCase().includes(e.toLowerCase())
    );
  }

  /**
   * 执行带重试的异步操作
   */
  async execute<T>(
    fn: () => Promise<T>,
    onRetry?: (attempt: number, error: Error, delay: number) => void
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (!this.shouldRetry(attempt, lastError)) {
          throw lastError;
        }

        const delay = this.getDelay(attempt);
        onRetry?.(attempt, lastError, delay);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }
}
