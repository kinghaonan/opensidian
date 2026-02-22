import { Notice } from 'obsidian';
import OpensidianPlugin from '../../../main';
import { AgentMode, Language } from '../../../core/types/settings';
import { t } from '../../../i18n';

export class ChatHeader {
  private container: HTMLElement;
  private plugin: OpensidianPlugin;
  private modelBtn!: HTMLButtonElement;
  private modelDropdown!: HTMLElement;
  private statusIndicator!: HTMLElement;
  private modeBtn!: HTMLButtonElement;
  private langBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private currentMode: AgentMode;
  private isDropdownOpen = false;
  private boundClickHandler: ((e: MouseEvent) => void) | null = null;
  
  private onModelChange?: (model: string) => void;
  private onModeChange?: (mode: AgentMode) => void;
  private onLanguageChange?: (lang: Language) => void;
  private onHistoryClick?: () => void;
  private onSettingsClick?: () => void;
  private onRefreshModels?: () => void;
  private onReconnect?: () => void;
  private onStop?: () => void;
  
  constructor(container: HTMLElement, plugin: OpensidianPlugin) {
    this.container = container;
    this.plugin = plugin;
    this.currentMode = plugin.settings.agentMode;
  }

  /**
   * 销毁组件，移除事件监听器
   */
  unload(): void {
    if (this.boundClickHandler) {
      document.removeEventListener('click', this.boundClickHandler);
      this.boundClickHandler = null;
    }
  }

  setCallbacks(callbacks: {
    onModelChange?: (model: string) => void;
    onModeChange?: (mode: AgentMode) => void;
    onLanguageChange?: (lang: Language) => void;
    onHistoryClick?: () => void;
    onSettingsClick?: () => void;
    onRefreshModels?: () => void;
    onReconnect?: () => void;
    onStop?: () => void;
  }): void {
    this.onModelChange = callbacks.onModelChange;
    this.onModeChange = callbacks.onModeChange;
    this.onLanguageChange = callbacks.onLanguageChange;
    this.onHistoryClick = callbacks.onHistoryClick;
    this.onSettingsClick = callbacks.onSettingsClick;
    this.onRefreshModels = callbacks.onRefreshModels;
    this.onReconnect = callbacks.onReconnect;
    this.onStop = callbacks.onStop;
  }

  render(): void {
    this.container.empty();
    const lang = this.plugin.settings.language as Language;

    const header = this.container.createDiv({ cls: 'opensidian-header' });

    const leftSection = header.createDiv({ cls: 'opensidian-header-left' });
    this.renderModelSelector(leftSection, lang);
    this.renderStatusIndicator(leftSection, lang);

    const rightSection = header.createDiv({ cls: 'opensidian-header-right' });
    this.renderStopButton(rightSection, lang);
    this.renderHistoryButton(rightSection, lang);
    this.renderLanguageButton(rightSection, lang);
    this.renderModeButton(rightSection, lang);
    this.renderSettingsButton(rightSection, lang);
    
    this.closeDropdownOnClickOutside();
  }

  private renderModelSelector(container: HTMLElement, _lang: Language): void {
    const wrapper = container.createDiv({ cls: 'opensidian-model-wrapper' });
    
    this.modelBtn = wrapper.createEl('button', { cls: 'opensidian-model-btn' });
    this.updateModelButtonText();
    
    this.modelDropdown = wrapper.createDiv({ cls: 'opensidian-model-dropdown' });
    this.populateModelDropdown();
    
    this.modelBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggleDropdown();
    };
  }

  private updateModelButtonText(): void {
    const currentModel = this.plugin.openCodeService.getActiveModel();
    const displayModel = currentModel === 'auto' ? 'Auto' : this.getShortModelName(currentModel);
    this.modelBtn.textContent = displayModel;
  }

  private getShortModelName(modelId: string): string {
    const parts = modelId.split('/');
    const name = parts[parts.length - 1] || modelId;
    return name.length > 10 ? name.substring(0, 10) + '..' : name;
  }

  private toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
    if (this.isDropdownOpen) {
      this.modelDropdown.addClass('opensidian-dropdown-open');
    } else {
      this.modelDropdown.removeClass('opensidian-dropdown-open');
    }
  }

  private closeDropdown(): void {
    this.isDropdownOpen = false;
    this.modelDropdown.removeClass('opensidian-dropdown-open');
  }

  private closeDropdownOnClickOutside(): void {
    // 先移除旧的监听器（如果存在）
    if (this.boundClickHandler) {
      document.removeEventListener('click', this.boundClickHandler);
    }
    
    // 创建新的监听器并存储引用
    this.boundClickHandler = (e: MouseEvent) => {
      if (this.isDropdownOpen && !this.modelBtn.contains(e.target as Node)) {
        this.closeDropdown();
      }
    };
    document.addEventListener('click', this.boundClickHandler);
  }

  private populateModelDropdown(): void {
    this.modelDropdown.empty();
    const currentModel = this.plugin.openCodeService.getActiveModel();
    const availableModels = this.plugin.openCodeService.getAvailableModels();
    const lang = this.plugin.settings.language as Language;

    const autoItem = this.modelDropdown.createDiv({ cls: 'opensidian-model-item' });
    autoItem.textContent = 'Auto';
    if (this.plugin.settings.model === 'auto') {
      autoItem.addClass('opensidian-model-item-active');
    }
    autoItem.onclick = () => this.selectModel('auto');

    const freeModels = availableModels.filter((m: any) => m.isFree);
    const paidModels = availableModels.filter((m: any) => !m.isFree && m.provider === 'opencode');
    const localModels = availableModels.filter((m: any) => m.provider === 'local');
    const otherModels = availableModels.filter((m: any) => 
      !m.isFree && m.provider !== 'opencode' && m.provider !== 'local'
    );

    if (freeModels.length > 0) {
      this.createModelGroup('Free', freeModels, currentModel);
    }

    if (paidModels.length > 0) {
      this.createModelGroup('Zen', paidModels, currentModel);
    }

    if (localModels.length > 0) {
      this.createModelGroup('Local', localModels, currentModel);
    }

    if (otherModels.length > 0) {
      this.createModelGroup('Other', otherModels, currentModel);
    }
    
    const refreshItem = this.modelDropdown.createDiv({ cls: 'opensidian-model-refresh' });
    refreshItem.innerHTML = 'Refresh';
    refreshItem.onclick = () => {
      this.onRefreshModels?.();
      this.closeDropdown();
    };
  }

  private createModelGroup(label: string, models: any[], currentModel: string): void {
    const group = this.modelDropdown.createDiv({ cls: 'opensidian-model-group' });
    group.createDiv({ cls: 'opensidian-model-group-label', text: label });
    
    for (const model of models) {
      const item = group.createDiv({ cls: 'opensidian-model-item' });
      item.textContent = model.name;
      if (model.id === currentModel) {
        item.addClass('opensidian-model-item-active');
      }
      item.onclick = () => this.selectModel(model.id);
    }
  }

  private selectModel(modelId: string): void {
    this.onModelChange?.(modelId);
    this.closeDropdown();
    this.updateModelButtonText();
    this.populateModelDropdown();
    const lang = this.plugin.settings.language as Language;
    new Notice(t('currentModel', lang) + ': ' + modelId);
  }

  private renderStatusIndicator(container: HTMLElement, lang: Language): void {
    this.statusIndicator = container.createDiv({ cls: 'opensidian-status-indicator' });
    this.statusIndicator.title = lang === 'zh' ? '点击重连' : 'Click to reconnect';
    this.statusIndicator.onclick = () => this.onReconnect?.();
    this.updateConnectionStatus();
  }

  private renderStopButton(container: HTMLElement, lang: Language): void {
    this.stopBtn = container.createEl('button', {
      cls: 'opensidian-header-stop-btn',
      attr: { 'aria-label': t('stop', lang) }
    });
    this.stopBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
    this.stopBtn.style.display = 'none';
    this.stopBtn.onclick = () => this.onStop?.();
  }

  setStreaming(streaming: boolean): void {
    if (this.stopBtn) {
      if (streaming) {
        this.stopBtn.addClass('visible');
      } else {
        this.stopBtn.removeClass('visible');
      }
    }
  }

  private renderHistoryButton(container: HTMLElement, lang: Language): void {
    const historyBtn = container.createEl('button', {
      cls: 'opensidian-header-btn',
      attr: { 'aria-label': t('conversationHistory', lang) }
    });
    historyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="10"/></svg>`;
    historyBtn.onclick = () => this.onHistoryClick?.();
  }

  private renderLanguageButton(container: HTMLElement, _lang: Language): void {
    this.langBtn = container.createEl('button', {
      cls: 'opensidian-header-btn',
      attr: { 'aria-label': t('switchLanguage', this.plugin.settings.language as Language) }
    });
    this.langBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
    this.langBtn.onclick = () => this.toggleLanguage();
  }

  private renderModeButton(container: HTMLElement, lang: Language): void {
    this.modeBtn = container.createEl('button', {
      cls: 'opensidian-mode-btn',
      text: this.currentMode === 'plan' ? t('planMode', lang) : t('buildMode', lang)
    });
    this.modeBtn.onclick = () => this.toggleMode();
  }

  private renderSettingsButton(container: HTMLElement, lang: Language): void {
    const settingsBtn = container.createEl('button', {
      cls: 'opensidian-header-btn',
      attr: { 'aria-label': t('settings', lang) }
    });
    settingsBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
    settingsBtn.onclick = () => this.onSettingsClick?.();
  }

  populateModelSelect(): void {
    this.populateModelDropdown();
    this.updateModelButtonText();
  }

  updateConnectionStatus(): void {
    const lang = this.plugin.settings.language as Language;
    const service = this.plugin.openCodeService;
    const opencodePath = service.getOpenCodePath();
    const hasOpencodeCli = !!opencodePath;

    let localModelConnected = false;
    if (this.plugin.settings.localModel.enabled) {
      const baseUrl = this.plugin.settings.localModel.baseUrl;
      if (baseUrl) {
        fetch(baseUrl.replace(/\/$/, '') + '/v1/models', { method: 'GET' })
          .then(res => { localModelConnected = res.ok; this.updateStatusText(lang, hasOpencodeCli, localModelConnected); })
          .catch(() => { this.updateStatusText(lang, hasOpencodeCli, false); });
        return;
      }
    }

    this.updateStatusText(lang, hasOpencodeCli, localModelConnected);
  }

  private updateStatusText(lang: Language, hasOpencodeCli: boolean, localModelConnected: boolean): void {
    let statusText = '';
    let statusClass = '';

    if (hasOpencodeCli || localModelConnected) {
      statusText = '●';
      statusClass = 'opensidian-status-connected';
    } else if (this.plugin.settings.opencodeZenApiKey) {
      statusText = '●';
      statusClass = 'opensidian-status-api';
    } else {
      statusText = '●';
      statusClass = 'opensidian-status-disconnected';
    }

    this.statusIndicator.textContent = statusText;
    this.statusIndicator.className = 'opensidian-status-indicator ' + statusClass;
  }

  private toggleMode(): void {
    const newMode: AgentMode = this.currentMode === 'plan' ? 'build' : 'plan';
    this.currentMode = newMode;
    this.plugin.settings.agentMode = newMode;
    this.plugin.saveSettings();
    
    const lang = this.plugin.settings.language as Language;
    this.modeBtn.textContent = newMode === 'plan' ? t('planMode', lang) : t('buildMode', lang);
    this.onModeChange?.(newMode);
  }

  private toggleLanguage(): void {
    const newLang: Language = this.plugin.settings.language === 'zh' ? 'en' : 'zh';
    this.plugin.settings.language = newLang;
    this.plugin.saveSettings();
    this.onLanguageChange?.(newLang);
    new Notice(newLang === 'zh' ? '已切换到中文' : 'Switched to English');
  }

  getMode(): AgentMode {
    return this.currentMode;
  }

  setMode(mode: AgentMode): void {
    this.currentMode = mode;
    const lang = this.plugin.settings.language as Language;
    this.modeBtn.textContent = mode === 'plan' ? t('planMode', lang) : t('buildMode', lang);
  }
}
