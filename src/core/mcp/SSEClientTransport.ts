// SSE (Server-Sent Events) 传输实现
// 用于连接支持 SSE 协议的 MCP 服务器

export interface SSETransportOptions {
  url: string;
  headers?: Record<string, string>;
  onMessage: (data: any) => void;
  onError?: (error: Error) => void;
  onClose?: () => void;
}

export class SSEClientTransport {
  private url: string;
  private headers: Record<string, string>;
  private onMessage: (data: any) => void;
  private onError?: (error: Error) => void;
  private onClose?: () => void;
  private abortController: AbortController | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private connected = false;

  constructor(options: SSETransportOptions) {
    this.url = options.url;
    this.headers = options.headers || {};
    this.onMessage = options.onMessage;
    this.onError = options.onError;
    this.onClose = options.onClose;
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    try {
      this.abortController = new AbortController();
      const response = await fetch(this.url, {
        method: 'GET',
        headers: {
          'Accept': 'text/event-stream',
          ...this.headers,
        },
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`);
      }

      this.reader = response.body?.getReader() || null;
      if (!this.reader) {
        throw new Error('SSE response has no readable body');
      }

      this.connected = true;
      this.readSSEStream();
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.onError?.(error);
      }
    }
  }

  private async readSSEStream(): Promise<void> {
    if (!this.reader) return;

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await this.reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = this.parseSSEBuffer(buffer);
        buffer = events.remainder;

        for (const event of events.parsed) {
          this.onMessage(event);
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        this.onError?.(error);
      }
    } finally {
      this.connected = false;
      this.onClose?.();
    }
  }

  private parseSSEBuffer(buffer: string): { parsed: any[]; remainder: string } {
    const parsed: any[] = [];
    const lines = buffer.split('\n');
    let currentData = '';

    // Find the last complete event (ends with double newline)
    let lastCompleteLine = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('data: ')) {
        currentData += line.slice(6);
      } else if (line === '' && currentData) {
        try {
          parsed.push(JSON.parse(currentData));
        } catch {
          parsed.push({ raw: currentData });
        }
        currentData = '';
        lastCompleteLine = i;
      }
    }

    const remainder = lines.slice(lastCompleteLine + 1).join('\n');
    return { parsed, remainder };
  }

  disconnect(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.reader = null;
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
