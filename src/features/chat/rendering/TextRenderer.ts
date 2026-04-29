import { MarkdownRenderer, Component } from 'obsidian';
import OpensidianPlugin from '../../main';

export function createTextBlock(parentEl: HTMLElement): { el: HTMLElement; content: string } {
  const el = parentEl.createDiv({ cls: 'claudian-text-block' });
  return { el, content: '' };
}

export async function appendTextContent(block: { el: HTMLElement; content: string }, text: string, plugin: OpensidianPlugin): Promise<void> {
  block.content += text;
  block.el.empty();
  await MarkdownRenderer.render(plugin.app, block.content, block.el, '', new Component());
}

export function finalizeTextBlock(block: { el: HTMLElement; content: string }): string {
  const c = block.content;
  return c;
}
