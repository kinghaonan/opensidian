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

    const header = this.container.createDiv({ cls: 'opensidian-sidebar-header' });

    const collapseBtn = header.createEl('button', {
      cls: 'opensidian-sidebar-collapse-btn',
      attr: { 'aria-label': t('toggleSidebar', lang) }
    });
    collapseBtn.innerHTML = '◀';
    collapseBtn.onclick = () => this.toggle();

    header.createEl('h4', { text: t('conversationHistory', lang) });

    const newChatBtn = header.createEl('button', {
      cls: 'opensidian-sidebar-btn',
      attr: { 'aria-label': t('newConversation', lang) }
    });
    newChatBtn.innerHTML = '➕';
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
      this.historyPanel.createDiv({ 
        cls: 'opensidian-history-empty',
        text: t('noHistoryFound', lang)
      });
      return;
    }

    for (const sessionId of sessions) {
      const session = await this.plugin.storage.loadSession(sessionId);
      if (!session) continue;

      this.renderHistoryItem(session, lang);
    }
  }

  private renderHistoryItem(session: SessionData, lang: Language): void {
    if (!this.historyPanel) return;

    const item = this.historyPanel.createDiv({ cls: 'opensidian-history-panel-item' });

    const checkbox = item.createEl('input', {
      type: 'checkbox',
      cls: 'opensidian-history-checkbox',
      attr: { 'data-session-id': session.id }
    });
    checkbox.checked = this.selectedHistoryIds.has(session.id);
    checkbox.onchange = () => {
      if (checkbox.checked) {
        this.selectedHistoryIds.add(session.id);
      } else {
        this.selectedHistoryIds.delete(session.id);
      }
    };
    this.historyCheckboxes.set(session.id, checkbox);

    const content = item.createDiv({ cls: 'opensidian-history-item-content' });
    content.createDiv({ 
      cls: 'opensidian-history-title',
      text: session.title || 'Untitled'
    });
    content.createDiv({ 
      cls: 'opensidian-history-date',
      text: this.formatDate(session.updatedAt)
    });

    content.onclick = () => this.onLoadSession?.(session.id);

    const deleteBtn = item.createEl('button', { 
      cls: 'opensidian-history-delete-btn',
      attr: { 'aria-label': t('deleteConversation', lang) }
    });
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.onclick = async (e) => {
      e.stopPropagation();
      if (confirm(t('deleteConfirm', lang))) {
        await this.plugin.storage.deleteSession(session.id);
        new Notice(t('sessionDeleted', lang));
        await this.loadHistoryList();
      }
    };
  }

  toggle(): void {
    this.container.classList.toggle('opensidian-sidebar-collapsed');
    const collapseBtn = this.container.querySelector('.opensidian-sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.innerHTML = this.container.classList.contains('opensidian-sidebar-collapsed') ? '▼' : '◀';
    }
  }

  expand(): void {
    this.container.classList.remove('opensidian-sidebar-collapsed');
    const collapseBtn = this.container.querySelector('.opensidian-sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.innerHTML = '◀';
    }
  }

  collapse(): void {
    this.container.classList.add('opensidian-sidebar-collapsed');
    const collapseBtn = this.container.querySelector('.opensidian-sidebar-collapse-btn');
    if (collapseBtn) {
      collapseBtn.innerHTML = '▼';
    }
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
