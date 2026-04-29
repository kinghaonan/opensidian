import { StreamChunk } from '../../../core/types/chat';
import OpensidianPlugin from '../../../main';
import { createToolCallBlock, updateToolCallStatus, updateToolCallResult, ToolCallState } from '../rendering/ToolCallRenderer';

export class StreamController {
  private plugin: OpensidianPlugin;
  private container: HTMLElement;
  private textEl: HTMLElement | null = null;
  private thinkingBlock: HTMLElement | null = null;
  private thinkingContentEl: HTMLElement | null = null;
  private thinkingLabelEl: HTMLElement | null = null;
  private thinkingTimer: ReturnType<typeof setInterval> | null = null;
  private thinkingStartTime = 0;
  private toolStates: Map<string, ToolCallState> = new Map();
  private onScroll: () => void;
  private placeholder: HTMLElement | null = null;
  private fullText = '';
  private fullThinking = '';

  constructor(container: HTMLElement, plugin: OpensidianPlugin, onScroll: () => void) {
    this.container = container;
    this.plugin = plugin;
    this.onScroll = onScroll;
    this.placeholder = container.querySelector('.opensidian-message-content') as HTMLElement;
  }

  async handleChunk(chunk: StreamChunk): Promise<void> {
    if (this.placeholder) {
      this.placeholder.textContent = '';
      this.placeholder = null;
      this.container.querySelectorAll('.opensidian-streaming').forEach(el => el.classList.remove('opensidian-streaming'));
    }

    switch (chunk.type) {
      case 'thinking':
        this.ensureThinkingBlock();
        this.fullThinking += chunk.content || '';
        this.thinkingContentEl!.textContent += chunk.content || '';
        break;

      case 'text':
        this.finalizeThinking();
        if (this.toolStates.size > 0 && this.textEl) {
          this.textEl = null;
        }
        this.ensureTextBlock();
        this.fullText += chunk.content || '';
        this.textEl!.textContent += chunk.content || '';
        break;

      case 'tool_call':
        this.finalizeThinking();
        if (chunk.toolCall) {
          const state = createToolCallBlock(this.container, chunk.toolCall);
          this.toolStates.set(chunk.toolCall.id, state);
        }
        break;

      case 'tool_result':
        if (chunk.toolCall) {
          const state = this.toolStates.get(chunk.toolCall.id);
          if (state) {
            updateToolCallStatus(state, chunk.toolCall.status);
            updateToolCallResult(state, chunk.toolCall.result);
          }
        }
        break;

      case 'done':
        this.finalizeThinking();
        this.finalizeText();
        this.renderCopyButton();
        break;

      case 'error':
        this.container.createDiv({ cls: 'claudian-error', text: chunk.error || 'Error' });
        break;
    }
    this.onScroll();
  }

  private ensureThinkingBlock(): void {
    if (this.thinkingBlock) return;
    this.thinkingBlock = this.container.createDiv({ cls: 'claudian-thinking-block' });
    const header = this.thinkingBlock.createDiv({ cls: 'claudian-thinking-header' });
    this.thinkingLabelEl = header.createSpan({ cls: 'claudian-thinking-label' });
    this.thinkingStartTime = Date.now();
    this.thinkingLabelEl.setText('Thinking 0s...');
    this.thinkingTimer = setInterval(() => {
      if (!this.thinkingLabelEl) { clearInterval(this.thinkingTimer!); return; }
      this.thinkingLabelEl.setText(`Thinking ${Math.floor((Date.now() - this.thinkingStartTime) / 1000)}s...`);
    }, 1000);
    this.thinkingContentEl = this.thinkingBlock.createDiv({ cls: 'claudian-thinking-content' });
    header.onclick = () => {
      if (this.thinkingContentEl) {
        this.thinkingContentEl.style.display = this.thinkingContentEl.style.display === 'none' ? 'block' : 'none';
      }
    };
  }

  private ensureTextBlock(): void {
    if (this.textEl) return;
    this.textEl = this.container.createDiv({ cls: 'claudian-text-block' });
  }

  private finalizeThinking(): void {
    if (!this.thinkingBlock) return;
    if (this.thinkingTimer) { clearInterval(this.thinkingTimer); this.thinkingTimer = null; }
    const s = Math.floor((Date.now() - this.thinkingStartTime) / 1000);
    if (this.thinkingLabelEl) this.thinkingLabelEl.setText(`Thought for ${s}s`);
    if (this.thinkingContentEl) this.thinkingContentEl.style.display = 'none';
  }

  private finalizeText(): void {
    if (!this.textEl || !this.fullText) return;
    try {
      const { MarkdownRenderer, Component } = require('obsidian');
      const comp = new Component();
      this.textEl.empty();
      MarkdownRenderer.render(this.plugin.app, this.fullText, this.textEl, '', comp);
      comp.load();
    } catch {
      this.textEl.textContent = this.fullText;
    }
  }

  private renderCopyButton(): void {
    const btn = this.container.createEl('button', { cls: 'claudian-copy-btn' });
    btn.innerHTML = '📋 复制';
    btn.onclick = () => {
      const selection = window.getSelection()?.toString() || '';
      const blocks = this.container.querySelectorAll('.claudian-text-block');
      const text = selection || Array.from(blocks).map(el => el.textContent || '').join('\n\n') || this.fullText;
      navigator.clipboard.writeText(text);
    };
  }

  getFullText(): string { return this.fullText; }
  getFullThinking(): string { return this.fullThinking; }

  reset(): void {
    this.finalizeThinking();
    this.fullText = '';
    this.fullThinking = '';
    this.textEl = null;
    this.thinkingBlock = null;
    this.thinkingContentEl = null;
    this.thinkingLabelEl = null;
    this.toolStates.clear();
  }
}
