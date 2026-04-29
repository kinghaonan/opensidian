import { TabManager, Tab } from '../TabManager';

export class TabBar {
  private container: HTMLElement;
  private tabManager: TabManager;
  private onTabClick?: (tabId: string) => void;
  private onNewTab?: () => void;

  constructor(container: HTMLElement, tabManager: TabManager, callbacks?: { onTabClick?: (tabId: string) => void; onNewTab?: () => void }) {
    this.container = container; this.tabManager = tabManager;
    this.onTabClick = callbacks?.onTabClick; this.onNewTab = callbacks?.onNewTab;
  }

  render(): void {
    try { this.container.empty(); } catch {}
    this.container.addClass('opensidian-tab-bar');

    const tabs = this.tabManager.getTabs();
    const activeId = this.tabManager.getActiveTabId();

    for (const tab of tabs) {
      const tabEl = this.container.createDiv({ cls: `opensidian-tab ${tab.id === activeId ? 'opensidian-tab-active' : ''}` });
      tabEl.setAttribute('data-tab-id', tab.id);

      const titleEl = tabEl.createSpan({ cls: 'opensidian-tab-title' });
      titleEl.textContent = tab.title.length > 20 ? tab.title.slice(0, 20) + '…' : tab.title;

      const closeBtn = tabEl.createSpan({ cls: 'opensidian-tab-close' });
      closeBtn.textContent = '×';
      closeBtn.onclick = (e) => { e.stopPropagation(); this.tabManager.closeTab(tab.id); this.render(); };

      tabEl.onclick = () => { this.onTabClick?.(tab.id); this.render(); };

      tabEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const oldTitle = tab.title;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldTitle;
        input.style.cssText = 'width:100%;padding:2px 4px;border:1px solid var(--os-accent);border-radius:4px;font-size:12px;background:var(--os-bg);color:var(--os-text);';
        titleEl.empty();
        titleEl.appendChild(input);
        input.focus();
        input.select();
        
        const finish = () => {
          const newName = input.value.trim() || oldTitle;
          this.tabManager.updateTab(tab.id, { title: newName });
          this.render();
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') { input.blur(); }
          if (ke.key === 'Escape') { input.value = oldTitle; input.blur(); }
        });
      });
    }

    const newTabBtn = this.container.createEl('button', { cls: 'opensidian-tab-new' });
    newTabBtn.textContent = '+';
    newTabBtn.onclick = () => { this.onNewTab?.(); this.render(); };
  }

  refresh(): void { this.render(); }
}
