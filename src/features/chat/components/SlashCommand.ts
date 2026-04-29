export interface SlashCommandDef {
  command: string;
  label: string;
  description: string;
  action: () => void;
}

export class SlashCommand {
  private container: HTMLElement;
  private popup: HTMLElement | null = null;
  private commands: SlashCommandDef[] = [];
  private selectedIndex = 0;
  private filtered: SlashCommandDef[] = [];
  private boundClickOutside: ((e: MouseEvent) => void) | null = null;
  private mountTarget: HTMLElement;

  constructor(container: HTMLElement, commands: SlashCommandDef[]) {
    this.container = container;
    this.commands = commands;
    this.mountTarget = document.body;
  }

  handleInput(value: string, cursorPos: number): boolean {
    const textBeforeCursor = value.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(?:^|\n)\/(\S*)$/);

    if (match) {
      const query = match[1].toLowerCase();
      this.filtered = this.commands.filter(c =>
        c.command.toLowerCase().includes(query)
      );
      if (this.filtered.length > 0) {
        this.selectedIndex = 0;
        this.renderPopup();
        return true;
      }
    }

    this.hide();
    return false;
  }

  private renderPopup(): void {
    this.removePopup();

    const rect = this.container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn('[SlashCommand] Container has zero dimensions, skipping popup');
      return;
    }

    const isDark = document.body.classList.contains('theme-dark') && !document.body.classList.contains('opensidian-theme-light')
      || document.body.classList.contains('opensidian-theme-dark');
    const bg = isDark ? '#2d2d2d' : '#ffffff';
    const text = isDark ? '#e0e0e0' : '#1a1a1a';
    const selBg = isDark ? '#3d3d3d' : '#e8e8ea';
    const accent = isDark ? '#7aa2f7' : '#5b8def';

    this.popup = document.createElement('div');
    this.popup.style.cssText = `position:fixed;left:${rect.left}px;bottom:${window.innerHeight - rect.top + 4}px;width:${Math.max(rect.width, 260)}px;z-index:99999;background:${bg};border:1px solid ${accent};border-radius:8px;padding:4px;`;
    document.body.appendChild(this.popup);

    let html = '';
    for (let i = 0; i < this.filtered.length; i++) {
      const cmd = this.filtered[i];
      const sel = i === this.selectedIndex ? `background:${selBg};` : '';
      html += `<div data-idx="${i}" style="display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;color:${text};${sel}border-radius:6px;"><span style="font-size:13px;font-weight:600;color:${accent};min-width:60px;">/${cmd.command}</span><span style="font-size:12px;color:${isDark?'#999':'#6b6b75'};">${cmd.description}</span></div>`;
    }
    this.popup.innerHTML = html;
    this.popup.addEventListener('click', (e) => {
      const target = (e.target as HTMLElement).closest('[data-idx]') as HTMLElement;
      if (target) {
        const idx = parseInt(target.getAttribute('data-idx')!);
        this.filtered[idx].action();
        this.hide();
      }
    });
    console.log('[SlashCommand] innerHTML popup, items:', this.filtered.length);
  }

  navigate(direction: 'up' | 'down'): void {
    if (!this.popup || this.filtered.length === 0) return;
    if (direction === 'down') {
      this.selectedIndex = (this.selectedIndex + 1) % this.filtered.length;
    } else {
      this.selectedIndex = (this.selectedIndex - 1 + this.filtered.length) % this.filtered.length;
    }
    this.renderPopup();
  }

  executeCurrent(): void {
    if (this.filtered.length === 0) return;
    this.filtered[this.selectedIndex].action();
    this.hide();
  }

  hide(): void {
    this.removePopup();
    this.filtered = [];
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
