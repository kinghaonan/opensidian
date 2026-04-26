import OpensidianPlugin from '../../main';
import { StreamChunk, QueryOptions, ModelInfo } from '../types/chat';
import { OpenCodeRuntime } from '../providers/opencode/OpenCodeRuntime';

export class OpenCodeService {
  private plugin: OpensidianPlugin;
  private runtime: OpenCodeRuntime;

  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
    this.runtime = new OpenCodeRuntime(plugin);
  }

  getRuntime(): OpenCodeRuntime {
    return this.runtime;
  }

  isReady(): boolean {
    return this.runtime.isReady();
  }

  reset(): void {
    this.runtime.reset();
    console.log('OpenCode service reset');
  }

  async initialize(): Promise<void> {
    await this.runtime.ensureReady();
  }

  async *query(
    prompt: string, 
    options?: QueryOptions
  ): AsyncGenerator<StreamChunk> {
    const turn = this.runtime.prepareTurn({
      prompt,
      conversationHistory: options?.conversationHistory,
      systemPrompt: options?.systemPrompt,
      stream: options?.stream,
      thinking: options?.thinking,
      attachments: options?.attachments,
    });
    yield* this.runtime.query(turn, options?.conversationHistory, {
      model: options?.model,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      thinking: options?.thinking,
      sessionId: options?.sessionId,
    });
  }

  stopGeneration(): void {
    this.runtime.cancel();
  }

  async switchModel(modelId: string): Promise<void> {
    await this.runtime.switchModel(modelId);
  }

  getActiveModel(): string {
    return this.runtime.getActiveModel();
  }

  getActiveProviderId(): string | null {
    return this.runtime.providerId;
  }

  async loadAvailableModels(): Promise<ModelInfo[]> {
    return this.runtime.getAvailableModels();
  }

  getAvailableModels(): ModelInfo[] {
    return (this.runtime as any).availableModels || [];
  }

  getAvailableMCPServers(): Array<{name: string; description?: string; enabled: boolean}> {
    return (this.runtime as any).availableMCPServers || [];
  }

  getAvailableSkills(): Array<{name: string; description?: string; enabled: boolean}> {
    return (this.runtime as any).availableSkills || [];
  }

  hasValidConfig(): boolean {
    return this.runtime.isReady();
  }

  getConfig(): any {
    return (this.runtime as any).opencodeConfig || null;
  }

  getAuth(): any {
    return (this.runtime as any).opencodeAuth || null;
  }

  setSessionId(sessionId: string | null): void {
    (this.runtime as any).currentSessionId = sessionId;
  }

  getSessionId(): string | null {
    return (this.runtime as any).currentSessionId || null;
  }

  getOpenCodePath(): string | null {
    return (this.runtime as any).opencodePath || null;
  }
}
