import { Notice } from 'obsidian';
import OpensidianPlugin from '../../../main';
import { t, Language } from '../../../i18n';
import { SessionData } from '../../../core/storage/StorageService';

export class Sidebar {
  private container: HTMLElement;
  private plugin: OpensidianPlugin;
  private historyPanel?: HTMLElement;
  private historyCheckboxes: Map<string, HTMLInputElement> = new Map();
  private selectedHistoryIds: Set<string> = new Set();
  private collapsed = true;
  private collapseBtn?: HTMLButtonElement;
  
  private onLoadSession?: (sessionId: string) => void;
  private onNewConversation?: () => void;
  private onDeleteSessions?: (sessionIds: string[]) => void;

  constructor(container: HTMLElement, plugin: OpensidianPlugin) {
    this.container = container;
    this.plugin = plugin;
  }

  setCallbacks(callbacks: {
    onLoadSession?: (sessionId: string) => void;
    onNewConversation?: () => void;
    onDeleteSessions?: (sessionIds: string[]) => void;
  }): void {
    this.onLoadSession = callbacks.onLoadSession;
    this.onNewConversation = callbacks.onNewConversation;
    this.onDeleteSessions = callbacks.onDeleteSessions;
  }

  render(): void {
    this.container.empty();
    const lang = this.plugin.settings.language;
    this.container.addClass('opensidian-sidebar-collapsed');

    const header = this.container.createDiv({ cls: 'opensidian-sidebar-header' });

    const collapseBtn = header.createEl('button', {
      cls: 'opensidian-sidebar-collapse-btn',
      attr: { 'aria-label': t('toggleSidebar', lang) }
    });
    collapseBtn.innerHTML = '▶';
    collapseBtn.title = lang === 'zh' ? '展开历史' : 'Expand history';
    collapseBtn.onclick = () => this.toggle();
    this.collapseBtn = collapseBtn;

    header.createEl('h4', { text: t('conversationHistory', lang) });

    const newChatBtn = header.createEl('button', {
      cls: 'opensidian-sidebar-btn',
      attr: { 'aria-label': t('newConversation', lang) }
    });
    newChatBtn.innerHTML = '+';
    newChatBtn.title = lang === 'zh' ? '新建对话' : 'New conversation';
    newChatBtn.onclick = () => this.onNewConversation?.();

    this.historyPanel = this.container.createDiv({ cls: 'opensidian-history-panel' });
    this.loadHistoryList();
  }

  private async loadHistoryList(): Promise<void> {
    if (!this.historyPanel) return;
    this.historyPanel.empty();
    this.historyCheckboxes.clear();
    const lang = this.plugin.settings.language;
    const sessions = await this.plugin.storage.listSessions();

    if (sessions.length === 0) {
      this.historyPanel.createDiv({ cls: 'opensidian-history-empty', text: lang === 'zh' ? '暂无历史' : 'No history' });
      return;
    }

    for (const sessionId of sessions) {
      const session = await this.plugin.storage.loadSession(sessionId);
      if (!session) continue;
      this.renderHistoryItem(session, lang);
    }

    this.renderBatchToolbar(lang);
  }

  private renderBatchToolbar(lang: string): void {
    if (!this.historyPanel) return;
    const toolbar = this.historyPanel.createDiv({ cls: 'opensidian-history-toolbar' });
    const selectAll = toolbar.createEl('button', { cls: 'opensidian-history-toolbar-btn', text: lang === 'zh' ? '全选' : 'Select All' });
    selectAll.onclick = () => this.selectAll();
    const deleteBtn = toolbar.createEl('button', { cls: 'opensidian-history-toolbar-btn opensidian-history-delete-selected', text: lang === 'zh' ? '删除选中' : 'Delete Selected' });
    deleteBtn.onclick = () => this.deleteSelected();
  }

  private renderHistoryItem(session: SessionData, lang: Language): void {
    if (!this.historyPanel) return;
    const item = this.historyPanel.createDiv({ cls: 'opensidian-history-item' });
    item.onclick = () => this.onLoadSession?.(session.id);

    const cb = item.createEl('input', { type: 'checkbox', cls: 'opensidian-history-item-cb' });
    cb.onclick = (e) => e.stopPropagation();
    cb.onchange = () => cb.checked ? this.selectedHistoryIds.add(session.id) : this.selectedHistoryIds.delete(session.id);
    this.historyCheckboxes.set(session.id, cb);

    const info = item.createDiv({ cls: 'opensidian-history-item-info' });
    info.createDiv({ cls: 'opensidian-history-item-title', text: session.title || 'Untitled' });
    info.createDiv({ cls: 'opensidian-history-item-date', text: this.formatDate(session.updatedAt) });

    const del = item.createEl('button', { cls: 'opensidian-history-item-del' });
    del.innerHTML = '×';
    del.onclick = async (e) => {
      e.stopPropagation();
      await this.plugin.storage.deleteSession(session.id);
      await this.loadHistoryList();
    };
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    if (this.collapsed) {
      this.container.addClass('opensidian-sidebar-collapsed');
    } else {
      this.container.removeClass('opensidian-sidebar-collapsed');
    }
    if (this.collapseBtn) {
      this.collapseBtn.innerHTML = this.collapsed ? '▶' : '◀';
    }
  }

  expand(): void {
    if (this.collapsed) this.toggle();
  }

  selectAll(): void {
    for (const checkbox of this.historyCheckboxes.values()) {
      checkbox.checked = true;
      this.selectedHistoryIds.add(checkbox.dataset.sessionId || '');
    }
  }

  deselectAll(): void {
    for (const checkbox of this.historyCheckboxes.values()) {
      checkbox.checked = false;
    }
    this.selectedHistoryIds.clear();
  }

  async deleteSelected(): Promise<void> {
    const lang = this.plugin.settings.language as Language;
    if (this.selectedHistoryIds.size === 0) {
      new Notice(lang === 'zh' ? '请先选择要删除的对话' : 'Please select conversations to delete');
      return;
    }

    if (confirm(lang === 'zh' 
      ? `确定删除 ${this.selectedHistoryIds.size} 个对话？` 
      : `Delete ${this.selectedHistoryIds.size} conversations?`
    )) {
      for (const sessionId of this.selectedHistoryIds) {
        await this.plugin.storage.deleteSession(sessionId);
      }
      new Notice(t('sessionDeleted', lang));
      this.selectedHistoryIds.clear();
      await this.loadHistoryList();
    }
  }

  async refresh(): Promise<void> {
    await this.loadHistoryList();
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const lang = this.plugin.settings.language as Language;

    if (days === 0) return t('today', lang);
    if (days === 1) return t('yesterday', lang);

    return date.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
  }
}
