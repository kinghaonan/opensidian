// HTTP 传输实现
// 用于连接支持 HTTP REST 协议的 MCP 服务器

export interface HTTPTransportOptions {
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class HTTPClientTransport {
  private url: string;
  private headers: Record<string, string>;
  private timeout: number;

  constructor(options: HTTPTransportOptions) {
    this.url = options.url.replace(/\/$/, '');
    this.headers = options.headers || {};
    this.timeout = options.timeout || 30000;
  }

  async listTools(): Promise<any[]> {
    const response = await this.request('GET', '/tools/list');
    return response.tools || [];
  }

  async callTool(name: string, args: Record<string, any>): Promise<any> {
    const response = await this.request('POST', '/tools/call', {
      name,
      arguments: args,
    });
    return response;
  }

  async listResources(): Promise<any[]> {
    const response = await this.request('GET', '/resources/list');
    return response.resources || [];
  }

  async readResource(uri: string): Promise<any> {
    const response = await this.request('GET', `/resources/read?uri=${encodeURIComponent(uri)}`);
    return response;
  }

  private async request(method: string, path: string, body?: any): Promise<any> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.url}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${method} ${path} failed: ${response.status}`);
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
