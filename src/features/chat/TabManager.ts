import { ChatMessage } from '../../core/types/chat';
import { AgentMode } from '../../core/types/settings';

export interface Tab {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  mode: AgentMode;
  sessionId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TabEventCallbacks {
  onTabCreated?: (tab: Tab) => void;
  onTabClosed?: (tabId: string) => void;
  onTabSwitched?: (tabId: string) => void;
}

export class TabManager {
  private tabs: Tab[] = [];
  private activeTabId: string | null = null;
  private callbacks: TabEventCallbacks = {};
  private maxTabs = 10;
  private snapshots: Map<string, ChatMessage[][]> = new Map();

  setCallbacks(callbacks: TabEventCallbacks): void {
    this.callbacks = callbacks;
  }

  createTab(title?: string, model?: string, mode?: AgentMode): Tab {
    if (this.tabs.length >= this.maxTabs) {
      this.closeTab(this.tabs[0].id);
    }

    const tab: Tab = {
      id: this.generateId(),
      title: title || 'New Chat',
      messages: [],
      model: model || 'auto',
      mode: mode || 'build',
      sessionId: this.generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    this.tabs.push(tab);
    this.activeTabId = tab.id;
    this.callbacks.onTabCreated?.(tab);
    return tab;
  }

  closeTab(id: string): void {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;

    this.tabs.splice(idx, 1);
    this.callbacks.onTabClosed?.(id);

    if (this.activeTabId === id) {
      this.activeTabId = this.tabs.length > 0 ? this.tabs[Math.min(idx, this.tabs.length - 1)].id : null;
      if (this.activeTabId) {
        this.callbacks.onTabSwitched?.(this.activeTabId);
      }
    }
  }

  switchTab(id: string): void {
    if (!this.tabs.find(t => t.id === id)) return;
    if (this.activeTabId === id) return;

    this.activeTabId = id;
    this.callbacks.onTabSwitched?.(id);
  }

  getActiveTab(): Tab | null {
    return this.tabs.find(t => t.id === this.activeTabId) || null;
  }

  getTabs(): Tab[] {
    return this.tabs;
  }

  getTabCount(): number {
    return this.tabs.length;
  }

  updateTab(id: string, updates: Partial<Pick<Tab, 'title' | 'messages' | 'model' | 'mode'>>): void {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return;
    Object.assign(tab, updates);
    tab.updatedAt = Date.now();
  }

  setActiveTabId(id: string): void {
    this.activeTabId = id;
  }

  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  saveSnapshot(tabId: string): void {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return;
    if (!this.snapshots.has(tabId)) {
      this.snapshots.set(tabId, []);
    }
    this.snapshots.get(tabId)!.push([...tab.messages.map(m => ({ ...m }))]);
  }

  rewindToSnapshot(tabId: string, snapshotIndex: number): ChatMessage[] | null {
    const snaps = this.snapshots.get(tabId);
    if (!snaps || snapshotIndex < 0 || snapshotIndex >= snaps.length) return null;
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab) return null;
    const restored = snaps[snapshotIndex];
    tab.messages = restored;
    tab.updatedAt = Date.now();
    this.snapshots.set(tabId, snaps.slice(0, snapshotIndex + 1));
    return restored;
  }

  getSnapshotCount(tabId: string): number {
    return this.snapshots.get(tabId)?.length || 0;
  }
}
