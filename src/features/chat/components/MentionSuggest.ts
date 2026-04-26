import { TFile } from 'obsidian';
import OpensidianPlugin from '../../../main';

interface MentionItem {
  file: TFile;
  name: string;
  path: string;
}

export class MentionSuggest {
  private container: HTMLElement;
  private plugin: OpensidianPlugin;
  private popup: HTMLElement | null = null;
  private items: MentionItem[] = [];
  private selectedIndex = 0;
  private onSelect?: (file: TFile) => void;
  private boundClickOutside: ((e: MouseEvent) => void) | null = null;
  private mountTarget: HTMLElement;

  constructor(container: HTMLElement, plugin: OpensidianPlugin) {
    this.container = container;
    this.plugin = plugin;
    this.mountTarget = document.body;
  }

  setOnSelect(callback: (file: TFile) => void): void {
    this.onSelect = callback;
  }

  handleInput(value: string, cursorPos: number): boolean {
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s\]]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      this.showSuggestions(query);
      return true;
    }

    this.hide();
    return false;
  }

  private showSuggestions(query: string): void {
    const allFiles = this.plugin.app.vault.getMarkdownFiles();
    console.log('[MentionSuggest] Vault files:', allFiles.length, 'query:', JSON.stringify(query));
    
    this.items = allFiles
      .filter(f => {
        const name = f.basename.toLowerCase();
        const path = f.path.toLowerCase();
        return name.includes(query) || path.includes(query);
      })
      .slice(0, 8)
      .map(f => ({ file: f, name: f.basename, path: f.path }));

    console.log('[MentionSuggest] Matched items:', this.items.length, this.items.map(i => i.name));

    if (this.items.length === 0) {
      this.hide();
      return;
    }

    this.selectedIndex = 0;
    this.renderPopup();
  }

  private renderPopup(): void {
    this.removePopup();

    const rect = this.container.getBoundingClientRect();
    
    if (rect.width === 0 || rect.height === 0) {
      console.warn('[MentionSuggest] Container has zero dimensions, skipping popup');
      return;
    }

    const isDark = document.body.classList.contains('theme-dark');
    const bg = isDark ? '#2d2d2d' : '#ffffff';
    const text = isDark ? '#e0e0e0' : '#1a1a1a';
    const selBg = isDark ? '#3d3d3d' : '#e8e8ea';
    const accent = isDark ? '#7aa2f7' : '#5b8def';

    this.popup = document.createElement('div');
    this.popup.style.cssText = `position:fixed;left:${rect.left}px;bottom:${window.innerHeight - rect.top + 4}px;width:${Math.max(rect.width, 260)}px;z-index:99999;background:${bg};border:1px solid ${accent};border-radius:8px;padding:4px;`;
    document.body.appendChild(this.popup);

    let html = '';
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const sel = i === this.selectedIndex ? `background:${selBg};` : '';
      const safeName = item.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const safePath = item.path.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      html += `<div data-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;color:${text};${sel}border-radius:6px;"><span style="font-size:13px;font-weight:500;color:${text};white-space:nowrap;">${safeName}</span><span style="font-size:11px;color:${isDark?'#999':'#6b6b75'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${safePath}</span></div>`;
    }
    this.popup.innerHTML = html;
    this.popup.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-idx]') as HTMLElement;
      if (target) {
        const idx = parseInt(target.getAttribute('data-idx')!);
        this.selectItem(idx);
      }
    });
    console.log('[MentionSuggest] innerHTML popup, items:', this.items.length);
  }

  navigate(direction: 'up' | 'down'): void {
    if (!this.popup || this.items.length === 0) return;

    if (direction === 'down') {
      this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
    } else {
      this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
    }

    this.renderPopup();
  }

  confirmSelection(): TFile | null {
    if (this.items.length === 0) return null;
    const selected = this.items[this.selectedIndex];
    this.onSelect?.(selected.file);
    this.hide();
    return selected.file;
  }

  selectItem(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    const selected = this.items[index];
    this.onSelect?.(selected.file);
    this.hide();
  }

  hide(): void {
    this.removePopup();
    this.items = [];
  }

  private removePopup(): void {
    if (this.popup) {
      this.popup.remove();
      this.popup = null;
    }
  }

  isVisible(): boolean {
    return this.popup !== null;
  }
}
