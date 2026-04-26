import { TabManager, Tab } from '../TabManager';

export class TabBar {
  private container: HTMLElement;
  private tabManager: TabManager;
  private onTabClick?: (tabId: string) => void;
  private onNewTab?: () => void;

  constructor(
    container: HTMLElement,
    tabManager: TabManager,
    callbacks?: { onTabClick?: (tabId: string) => void; onNewTab?: () => void }
  ) {
    this.container = container;
    this.tabManager = tabManager;
    this.onTabClick = callbacks?.onTabClick;
    this.onNewTab = callbacks?.onNewTab;
  }

  render(): void {
    this.container.empty();
    this.container.addClass('opensidian-tab-bar');

    const tabs = this.tabManager.getTabs();
    const activeId = this.tabManager.getActiveTabId();

    for (const tab of tabs) {
      const tabEl = this.container.createDiv({
        cls: `opensidian-tab ${tab.id === activeId ? 'opensidian-tab-active' : ''}`,
      });
      tabEl.setAttribute('data-tab-id', tab.id);

      const titleEl = tabEl.createSpan({ cls: 'opensidian-tab-title' });
      titleEl.textContent = tab.title.length > 20 ? tab.title.slice(0, 20) + '…' : tab.title;

      const closeBtn = tabEl.createSpan({ cls: 'opensidian-tab-close' });
      closeBtn.textContent = '×';
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        this.tabManager.closeTab(tab.id);
        this.render();
      };

      tabEl.onclick = () => {
        this.onTabClick?.(tab.id);
        this.render();
      };
    }

    const newTabBtn = this.container.createEl('button', { cls: 'opensidian-tab-new' });
    newTabBtn.textContent = '+';
    newTabBtn.onclick = () => {
      this.onNewTab?.();
      this.render();
    };
  }

  refresh(): void {
    this.render();
  }
}
