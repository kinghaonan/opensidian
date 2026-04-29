import { TFile } from 'obsidian';
import OpensidianPlugin from '../../../main';

interface MentionItem { type: 'folder' | 'file'; name: string; path: string; file?: TFile; }

export class MentionSuggest {
  private container: HTMLElement;
  private plugin: OpensidianPlugin;
  private popup: HTMLElement | null = null;
  private items: MentionItem[] = [];
  private selectedIndex = 0;
  private onSelect?: (file: TFile) => void;
  private currentPath = '';

  constructor(container: HTMLElement, plugin: OpensidianPlugin) { this.container = container; this.plugin = plugin; }
  setOnSelect(callback: (file: TFile) => void): void { this.onSelect = callback; }

  handleInput(value: string, cursorPos: number): boolean {
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s\]]*)$/);
    if (!mentionMatch) { this.hide(); return false; }
    const query = mentionMatch[1].toLowerCase();
    this.currentPath = query.includes('/') ? query.substring(0, query.lastIndexOf('/') + 1) : '';
    this.showSuggestions(this.currentPath ? query.substring(query.lastIndexOf('/') + 1) : query);
    return true;
  }

  private showSuggestions(query: string): void {
    this.items = [];
    const vault = this.plugin.app.vault;
    const prefix = this.currentPath;

    if (!prefix) {
      const folders = new Set<string>();
      for (const f of vault.getMarkdownFiles()) { const p = f.path.split('/'); if (p.length > 1) folders.add(p[0] + '/'); }
      for (const f of [...folders].sort()) { if (!query || f.toLowerCase().includes(query)) this.items.push({ type: 'folder', name: f, path: f }); }
      for (const f of vault.getMarkdownFiles()) {
        if (!f.path.includes('/') && (!query || f.basename.toLowerCase().includes(query))) this.items.push({ type: 'file', name: f.basename, path: f.path, file: f });
      }
    } else {
      const sub = new Set<string>();
      for (const f of vault.getMarkdownFiles()) {
        if (!f.path.startsWith(prefix)) continue;
        const rel = f.path.substring(prefix.length);
        const si = rel.indexOf('/');
        if (si > 0) sub.add(prefix + rel.substring(0, si + 1));
      }
      for (const f of [...sub].sort()) { const n = f.replace(prefix, ''); if (!query || n.toLowerCase().includes(query)) this.items.push({ type: 'folder', name: n, path: f }); }
      for (const f of vault.getMarkdownFiles()) {
        if (!f.path.startsWith(prefix)) continue;
        const rel = f.path.substring(prefix.length);
        if (!rel.includes('/') && (!query || rel.toLowerCase().includes(query))) this.items.push({ type: 'file', name: rel, path: f.path, file: f });
      }
    }
    this.items = this.items.slice(0, 10);
    if (!this.items.length) { this.hide(); return; }
    this.selectedIndex = 0; this.renderPopup();
  }

  private renderPopup(): void {
    this.hide();
    const rect = this.container.getBoundingClientRect();
    const isDark = document.body.classList.contains('theme-dark') && !document.body.classList.contains('opensidian-theme-light')
      || document.body.classList.contains('opensidian-theme-dark');
    const bg = isDark ? '#2d2d2d' : '#fff', text = isDark ? '#e0e0e0' : '#1a1a1a', selBg = isDark ? '#3d3d3d' : '#e8e8ea';
    this.popup = document.createElement('div');
    this.popup.style.cssText = `position:fixed;left:${rect.left}px;bottom:${window.innerHeight - rect.top + 4}px;width:${Math.max(rect.width, 300)}px;z-index:99999;background:${bg};border:1px solid ${isDark?'#45475a':'#dee2e6'};border-radius:8px;padding:4px;max-height:280px;overflow-y:auto;`;
    document.body.appendChild(this.popup);
    let html = '';
    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const sel = i === this.selectedIndex ? `background:${selBg};` : '';
      const icon = item.type === 'folder' ? '📁' : '📄';
      const c = item.type === 'folder' ? (isDark ? '#a6adc8' : '#495057') : text;
      html += `<div data-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;color:${c};${sel}border-radius:6px;"><span style="font-size:14px;">${icon}</span><span style="font-size:13px;">${item.name}</span></div>`;
    }
    this.popup.innerHTML = html;
    this.popup.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-idx]') as HTMLElement;
      if (t) this.selectItem(parseInt(t.getAttribute('data-idx')!));
    });
  }

  navigate(direction: 'up' | 'down'): void {
    if (!this.popup || !this.items.length) return;
    this.selectedIndex = direction === 'down' ? (this.selectedIndex + 1) % this.items.length : (this.selectedIndex - 1 + this.items.length) % this.items.length;
    this.renderPopup();
    const sel = this.popup?.querySelector(`[data-idx="${this.selectedIndex}"]`) as HTMLElement;
    if (sel) sel.scrollIntoView({ block: 'nearest' });
  }

  confirmSelection(): TFile | null {
    if (!this.items.length) return null;
    const item = this.items[this.selectedIndex];
    if (item.type === 'folder') { this.currentPath = item.path; this.showSuggestions(''); return null; }
    if (item.file) { this.onSelect?.(item.file); this.hide(); return item.file; }
    this.hide(); return null;
  }

  selectItem(index: number): void {
    if (index < 0 || index >= this.items.length) return;
    const item = this.items[index];
    if (item.type === 'folder') { this.currentPath = item.path; this.showSuggestions(''); return; }
    if (item.file) { this.onSelect?.(item.file); this.hide(); }
  }

  hide(): void { if (this.popup) { this.popup.remove(); this.popup = null; } }
  isVisible(): boolean { return this.popup !== null; }
}
