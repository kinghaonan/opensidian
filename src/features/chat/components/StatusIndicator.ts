import OpensidianPlugin from '../../../main';
import { ConnectionState } from '../../../core/agent/ConnectionManager';
import { t } from '../../../i18n';

export class StatusIndicator {
  private container: HTMLElement;
  private plugin: OpensidianPlugin;
  private state: ConnectionState = 'disconnected';
  private retryInfo?: { current: number; max: number };

  constructor(container: HTMLElement, plugin: OpensidianPlugin) {
    this.container = container;
    this.plugin = plugin;
  }

  setState(state: ConnectionState, retryInfo?: { current: number; max: number }): void {
    this.state = state;
    this.retryInfo = retryInfo;
    this.render();
  }

  setRetryInfo(retryInfo: { current: number; max: number }): void {
    this.retryInfo = retryInfo;
    this.render();
  }

  render(): void {
    this.container.empty();
    const lang = this.plugin.settings.language;

    const indicator = this.container.createDiv({ cls: `opensidian-connection-status opensidian-status-${this.state}` });

    const icon = this.getStateIcon();
    const text = this.getStateText(lang);

    indicator.innerHTML = `${icon} ${text}`;

    if (this.retryInfo && this.state === 'reconnecting') {
      indicator.innerHTML += ` (${this.retryInfo.current}/${this.retryInfo.max})`;
    }
  }

  private getStateIcon(): string {
    switch (this.state) {
      case 'connected': return '✅';
      case 'connecting': return '🔄';
      case 'reconnecting': return '🔁';
      case 'error': return '❌';
      case 'disconnected':
      default: return '⚪';
    }
  }

  private getStateText(lang: string): string {
    switch (this.state) {
      case 'connected': 
        return lang === 'zh' ? '已连接' : 'Connected';
      case 'connecting': 
        return lang === 'zh' ? '连接中...' : 'Connecting...';
      case 'reconnecting': 
        return lang === 'zh' ? '重新连接中...' : 'Reconnecting...';
      case 'error': 
        return lang === 'zh' ? '连接错误' : 'Connection Error';
      case 'disconnected':
      default: 
        return lang === 'zh' ? '未连接' : 'Disconnected';
    }
  }
}
