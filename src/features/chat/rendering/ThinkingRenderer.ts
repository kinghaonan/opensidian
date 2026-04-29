import { MarkdownRenderer, Component } from 'obsidian';
import OpensidianPlugin from '../../main';

export interface ThinkingState {
  wrapperEl: HTMLElement;
  contentEl: HTMLElement;
  labelEl: HTMLElement;
  content: string;
  startTime: number;
  timerInterval: ReturnType<typeof setInterval> | null;
  isExpanded: boolean;
}

export function createThinkingBlock(parentEl: HTMLElement, plugin: OpensidianPlugin): ThinkingState {
  const wrapperEl = parentEl.createDiv({ cls: 'claudian-thinking-block' });
  const header = wrapperEl.createDiv({ cls: 'claudian-thinking-header' });
  header.setAttribute('tabindex', '0');
  header.setAttribute('role', 'button');
  header.setAttribute('aria-expanded', 'false');
  header.setAttribute('aria-label', '点击展开思考过程');

  const labelEl = header.createSpan({ cls: 'claudian-thinking-label' });
  const startTime = Date.now();
  labelEl.setText('Thinking 0s...');

  const timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    labelEl.setText(`Thinking ${elapsed}s...`);
  }, 1000);

  const contentEl = wrapperEl.createDiv({ cls: 'claudian-thinking-content' });
  contentEl.style.display = 'none';

  header.onclick = () => {
    const expanded = contentEl.style.display !== 'none';
    contentEl.style.display = expanded ? 'none' : 'block';
    header.setAttribute('aria-expanded', String(!expanded));
  };

  return { wrapperEl, contentEl, labelEl, content: '', startTime, timerInterval, isExpanded: false };
}

export async function appendThinkingContent(state: ThinkingState, text: string, plugin: OpensidianPlugin): Promise<void> {
  state.content += text;
  state.contentEl.empty();
  await MarkdownRenderer.render(plugin.app, state.content, state.contentEl, '', new Component());
}

export function finalizeThinkingBlock(state: ThinkingState): number {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
  const durationSeconds = Math.floor((Date.now() - state.startTime) / 1000);
  state.labelEl.setText(`Thought for ${durationSeconds}s`);
  state.contentEl.style.display = 'none';
  return durationSeconds;
}
