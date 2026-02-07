import { ItemView, WorkspaceLeaf, TFile, MarkdownRenderer, Component, Notice } from 'obsidian';
import OpensidianPlugin from '../../main';
import { ChatMessage, ImageAttachment } from '../../core/types/chat';
import { AgentMode, ModelInfo } from '../../core/types/settings';
import { SessionData } from '../../core/storage/StorageService';
import { t, Language } from '../../i18n';

export const VIEW_TYPE_OPENCODE = 'opensidian-chat-view';

export class OpensidianView extends ItemView {
  private plugin: OpensidianPlugin;
  private container!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private inputContainer!: HTMLElement;
  private sidebarContainer!: HTMLElement;
  private currentConversationId: string | null = null;
  private isStreaming = false;
  private messages: ChatMessage[] = [];
  private attachments: ImageAttachment[] = [];
  private component: Component;
  private textarea!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private stopBtn!: HTMLButtonElement;
  private modelSelect!: HTMLSelectElement;
  private historySelect!: HTMLSelectElement;
  private historyDeleteBtn!: HTMLButtonElement;
  private modeBtn!: HTMLButtonElement;
  private langBtn!: HTMLButtonElement;
  private thinkingElements: Map<string, HTMLElement> = new Map();
  private statusIndicator!: HTMLElement;
  private currentMode: AgentMode;
  private modeMemory: Map<string, { mode: AgentMode; messages: ChatMessage[] }> = new Map();
  private historyDropdown?: HTMLElement;
  private historyCheckboxes: Map<string, HTMLInputElement> = new Map();
  private selectedHistoryIds: Set<string> = new Set();
  private historyPanel?: HTMLElement;

   constructor(leaf: WorkspaceLeaf, plugin: OpensidianPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.component = new Component();
    this.currentMode = plugin.settings.agentMode;
  }

  private getLang(): Language {
    return this.plugin.settings.language as Language || 'en';
  }

  getViewType(): string {
    return VIEW_TYPE_OPENCODE;
  }

  getDisplayText(): string {
    return t('pluginName', this.plugin.settings.language);
  }

  getIcon(): string {
    return 'message-circle';
  }

  async onOpen(): Promise<void> {
    this.component.load();
    this.container = this.contentEl.createDiv({ cls: 'opensidian-container' });
    
    // Create sidebar for history
    this.createSidebar();
    
    // Create main content area
    const mainContent = this.container.createDiv({ cls: 'opensidian-main-content' });
    
    // Create header
    this.createHeader(mainContent);
    
    // Create messages area
    this.createMessagesArea(mainContent);
    
    // Create input area
    this.createInputArea(mainContent);
    
    // Load conversation
    await this.loadConversation();
    
    // Register events
    this.registerEvents();
  }

  async onClose(): Promise<void> {
    this.component.unload();
  }

  private createSidebar(): void {
    this.sidebarContainer = this.container.createDiv({ cls: 'opensidian-sidebar' });
    const lang = this.plugin.settings.language;
    
    // Sidebar header
    const sidebarHeader = this.sidebarContainer.createDiv({ cls: 'opensidian-sidebar-header' });
    
    // Collapse button
    const collapseBtn = sidebarHeader.createEl('button', {
      cls: 'opensidian-sidebar-collapse-btn',
      attr: { 'aria-label': t('toggleSidebar', lang) }
    });
    collapseBtn.innerHTML = '◀';
    collapseBtn.onclick = () => this.toggleSidebar();
    
    // Title
    sidebarHeader.createEl('h4', { text: t('conversationHistory', lang) });
    
    // New chat button
    const newChatBtn = sidebarHeader.createEl('button', {
      cls: 'opensidian-sidebar-btn',
      attr: { 'aria-label': t('newConversation', lang) }
    });
    newChatBtn.innerHTML = '➕';
    newChatBtn.onclick = () => this.startNewConversation();
    
    // History list - moved to header
    // const historyList = this.sidebarContainer.createDiv({ cls: 'opensidian-history-list' });
    // this.loadHistoryList(historyList);
  }

  private createHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: 'opensidian-header' });
    const lang = this.plugin.settings.language;
    
    // Left: Model selector
    const leftSection = header.createDiv({ cls: 'opensidian-header-left' });
    
    this.modelSelect = leftSection.createEl('select', { cls: 'opensidian-model-select' });
    this.populateModelSelect();
    this.modelSelect.onchange = async () => {
      await this.plugin.openCodeService.switchModel(this.modelSelect.value);
      new Notice(t('currentModel', lang) + ': ' + this.modelSelect.value);
    };
    
    // Refresh models button
    const refreshBtn = leftSection.createEl('button', {
      cls: 'opensidian-btn opensidian-refresh-btn',
      attr: { 'aria-label': t('refreshModels', lang) }
    });
    refreshBtn.innerHTML = '🔄';
    refreshBtn.onclick = async () => {
      await this.plugin.openCodeService.loadAvailableModels();
      this.populateModelSelect();
      new Notice(t('refreshModels', lang));
    };

    // Connection status indicator
    this.statusIndicator = leftSection.createDiv({ cls: 'opensidian-status-indicator' });
    this.updateConnectionStatus();
    
    // Right: History, language, mode, settings
    const rightSection = header.createDiv({ cls: 'opensidian-header-right' });
    
    // History icon button with dropdown
    const historyBtn = rightSection.createEl('button', {
      cls: 'opensidian-btn opensidian-history-btn',
      attr: { 'aria-label': t('conversationHistory', lang) }
    });
    historyBtn.innerHTML = '📚';
    historyBtn.onclick = () => this.toggleHistoryDropdown();
    
    // Create dropdown panel (initially hidden)
    this.historyDropdown = rightSection.createDiv({ cls: 'opensidian-history-dropdown' });
    this.historyDropdown.style.display = 'none';
    
    // Create panel content
    const panelHeader = this.historyDropdown.createDiv({ cls: 'opensidian-history-panel-header' });
    panelHeader.createEl('h4', { text: t('conversationHistory', lang) });
    
    // Action buttons
    const actions = panelHeader.createDiv({ cls: 'opensidian-history-actions' });
    const selectAllBtn = actions.createEl('button', {
      cls: 'opensidian-btn opensidian-history-action-btn',
      text: t('selectAll', lang)
    });
    selectAllBtn.onclick = () => this.selectAllHistories();
    
    const deselectAllBtn = actions.createEl('button', {
      cls: 'opensidian-btn opensidian-history-action-btn',
      text: t('deselectAll', lang)
    });
    deselectAllBtn.onclick = () => this.deselectAllHistories();
    
    const deleteSelectedBtn = actions.createEl('button', {
      cls: 'opensidian-btn opensidian-history-action-btn opensidian-history-delete-btn',
      text: t('deleteSelected', lang)
    });
    deleteSelectedBtn.onclick = () => this.deleteSelectedHistories();
    
    const clearCurrentBtn = actions.createEl('button', {
      cls: 'opensidian-btn opensidian-history-action-btn',
      text: t('clearCurrentConversation', lang)
    });
    clearCurrentBtn.onclick = () => this.clearCurrentConversation();
    
    // History list container
    this.historyPanel = this.historyDropdown.createDiv({ cls: 'opensidian-history-panel' });
    
    // Close button
    const closeBtn = panelHeader.createEl('button', {
      cls: 'opensidian-btn opensidian-history-close-btn',
      text: '×'
    });
    closeBtn.onclick = () => this.hideHistoryDropdown();
    
    // Populate history panel
    this.populateHistoryPanel();
    
    // Language toggle button
    this.langBtn = rightSection.createEl('button', {
      cls: 'opensidian-btn opensidian-lang-btn',
      attr: { 'aria-label': t('switchLanguage', lang) }
    });
    this.langBtn.innerHTML = '🌐';
    this.langBtn.onclick = () => this.toggleLanguage();
    
    // Plan/Build mode toggle
    this.modeBtn = rightSection.createEl('button', {
      cls: 'opensidian-mode-btn',
      text: this.currentMode === 'plan' ? t('planMode', lang) : t('buildMode', lang)
    });
    this.modeBtn.onclick = () => this.toggleMode();
    
    // Settings button
    const settingsBtn = rightSection.createEl('button', {
      cls: 'opensidian-btn',
      attr: { 'aria-label': t('settings', lang) }
    });
    settingsBtn.innerHTML = '⚙️';
    settingsBtn.onclick = () => this.openSettings();
  }

  private createMessagesArea(container: HTMLElement): void {
    this.messagesContainer = container.createDiv({ cls: 'opensidian-messages' });
    this.messagesContainer.setAttribute('tabindex', '0');
    
    // Enable drag and drop for files
    this.messagesContainer.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.messagesContainer.addClass('opensidian-drag-over');
    });
    
    this.messagesContainer.addEventListener('dragleave', () => {
      this.messagesContainer.removeClass('opensidian-drag-over');
    });
    
    this.messagesContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.messagesContainer.removeClass('opensidian-drag-over');
      await this.handleFileDrop(e);
    });
  }

  private createInputArea(container: HTMLElement): void {
    this.inputContainer = container.createDiv({ cls: 'opensidian-input-area' });
    
    // Attachments preview
    this.inputContainer.createDiv({ cls: 'opensidian-attachments' });
    
    // Input wrapper
    const inputWrapper = this.inputContainer.createDiv({ cls: 'opensidian-input-wrapper' });
    
    // Attachment button
    const attachBtn = inputWrapper.createEl('button', {
      cls: 'opensidian-attach-btn',
      attr: { 'aria-label': 'Add attachment' }
    });
    attachBtn.innerHTML = '📎';
    attachBtn.onclick = () => this.addAttachment();
    
    // Text input
    this.textarea = inputWrapper.createEl('textarea', {
      cls: 'opensidian-input',
      attr: {
        placeholder: t('chatPlaceholder', this.getLang()),
        rows: '1'
      }
    });
    
    // Auto-resize textarea
    this.textarea.addEventListener('input', () => {
      this.textarea.style.height = 'auto';
      this.textarea.style.height = Math.min(this.textarea.scrollHeight, 200) + 'px';
    });
    
    // Handle enter key
    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Send button
    this.sendBtn = inputWrapper.createEl('button', {
      cls: 'opensidian-send-btn',
      text: t('send', this.getLang())
    });
    this.sendBtn.onclick = () => this.sendMessage();
    
    // Stop button (hidden by default)
    this.stopBtn = inputWrapper.createEl('button', {
      cls: 'opensidian-stop-btn',
      text: t('stop', this.getLang())
    });
    this.stopBtn.style.display = 'none';
    this.stopBtn.onclick = () => this.stopGeneration();
  }

  private populateModelSelect(): void {
    const currentModel = this.plugin.openCodeService.getActiveModel();
    const availableModels = this.plugin.openCodeService.getAvailableModels();
    const lang = this.plugin.settings.language;
    
    // Clear existing options
    this.modelSelect.empty();
    
    // Add auto option
    const autoOption = this.modelSelect.createEl('option', {
      value: 'auto',
      text: 'Auto'
    });
    if (this.plugin.settings.model === 'auto') {
      autoOption.selected = true;
    }
    
    // Group models by category
    const freeModels = availableModels.filter((m: ModelInfo) => m.isFree);
    const paidModels = availableModels.filter((m: ModelInfo) => !m.isFree && m.provider === 'opencode');
    const localModels = availableModels.filter((m: ModelInfo) => m.provider === 'local');
    const otherModels = availableModels.filter((m: ModelInfo) => 
      !m.isFree && m.provider !== 'opencode' && m.provider !== 'local'
    );
    
    // Free models group
    if (freeModels.length > 0) {
      const freeGroup = this.modelSelect.createEl('optgroup', { 
        attr: { label: `🆓 ${t('freeModels', lang)}` }
      });
      for (const model of freeModels) {
        const option = freeGroup.createEl('option', {
          value: model.id,
          text: model.name
        });
        if (model.id === currentModel) {
          option.selected = true;
        }
      }
    }
    
    // Paid OpenCode Zen models
    if (paidModels.length > 0) {
      const paidGroup = this.modelSelect.createEl('optgroup', { 
        attr: { label: `✨ OpenCode Zen` }
      });
      for (const model of paidModels) {
        const option = paidGroup.createEl('option', {
          value: model.id,
          text: model.name
        });
        if (model.id === currentModel) {
          option.selected = true;
        }
      }
    }
    
    // Local models
    if (localModels.length > 0) {
      const localGroup = this.modelSelect.createEl('optgroup', { 
        attr: { label: `💻 ${t('localModels', lang)}` }
      });
      for (const model of localModels) {
        const option = localGroup.createEl('option', {
          value: model.id,
          text: model.name
        });
        if (model.id === currentModel) {
          option.selected = true;
        }
      }
    }
    
    // Other configured models
    if (otherModels.length > 0) {
      const otherGroup = this.modelSelect.createEl('optgroup', { 
        attr: { label: `📦 ${t('configuredModels', lang)}` }
      });
      for (const model of otherModels) {
        const option = otherGroup.createEl('option', {
          value: model.id,
          text: model.name
        });
        if (model.id === currentModel) {
          option.selected = true;
        }
      }
    }
  }

  private async loadConversation(): Promise<void> {
    this.messages = [];
    this.messagesContainer.empty();
    this.addWelcomeMessage();
  }

  private addWelcomeMessage(): void {
    const welcome = this.messagesContainer.createDiv({ cls: 'opensidian-message opensidian-welcome' });
    const lang = this.plugin.settings.language;
    
    const avatar = welcome.createDiv({ cls: 'opensidian-avatar' });
    avatar.innerHTML = '🤖';
    
    const content = welcome.createDiv({ cls: 'opensidian-message-content' });
    
    content.innerHTML = `
      <p><strong>${t('welcomeTitle', lang)}</strong></p>
      <p>${t('welcomeMessage', lang)}</p>
      <ul>
        <li>${t('welcomeTip1', lang)}</li>
        <li>${t('welcomeTip2', lang)}</li>
        <li>${t('welcomeTip3', lang)}</li>
        <li>${t('welcomeTip4', lang)}</li>
        <li>${t('welcomeTip5', lang)}</li>
      </ul>
      <p>${lang === 'zh' ? '当前模式' : 'Current mode'}: <strong>${this.currentMode === 'plan' ? t('planMode', lang) : t('buildMode', lang)}</strong></p>
    `;
  }

  private async sendMessage(): Promise<void> {
    const userText = this.textarea.value.trim();
    if (!userText || this.isStreaming) return;
    
    const lang = this.plugin.settings.language;
    
    // Check conversation history length and warn if too long
    const MAX_HISTORY_WARNING = 20;
    if (this.messages.length >= MAX_HISTORY_WARNING) {
      const warningMsg = lang === 'zh'
        ? `当前对话历史已超过 ${MAX_HISTORY_WARNING} 条消息。长对话历史可能导致响应超时或失败。建议使用"清空当前对话"功能开始新对话。是否继续？`
        : `Current conversation history has exceeded ${MAX_HISTORY_WARNING} messages. Long conversation history may cause timeouts or failures. It's recommended to use "Clear current" to start a new conversation. Continue?`;
      
      if (!confirm(warningMsg)) {
        return;
      }
    }
    
    // Clear input
    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    
    // Save attachments before clearing
    const attachmentsToSend = [...this.attachments];
    
    // Build message content with attachment paths
    let messageContent = userText;
    if (attachmentsToSend.length > 0) {
      const lang = this.plugin.settings.language;
      const attachmentList = attachmentsToSend
        .map(att => `- ${att.fileName} (保存为: ${att.filePath})`)
        .join('\n');
      
      if (lang === 'zh') {
        messageContent = `用户上传了以下附件，请使用 MCP read_file 工具读取文件内容：

${attachmentList}

用户的问题：
${userText}`;
      } else {
        messageContent = `The user has uploaded the following attachments. Please use the MCP read_file tool to read the file content:

${attachmentList}

User's question:
${userText}`;
      }
    }
    
    // Add user message
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: messageContent,
      timestamp: Date.now(),
      images: attachmentsToSend.length > 0 ? [...attachmentsToSend] : undefined
    };
    
    this.messages.push(userMessage);
    this.addMessage(userMessage);
    
    // Clear attachments
    this.attachments = [];
    this.updateAttachmentsUI();
    
    // Start streaming
    this.isStreaming = true;
    this.updateInputButtons();
    
    // Prepare context
    const context = await this.prepareContext(userText);
    
    // Create assistant message
    const assistantMsgId = this.generateId();
    const assistantContainer = this.createAssistantMessageContainer(assistantMsgId);
    
    let fullContent = '';
    let thinkingContent = '';
    
    try {
      // 排除当前用户消息的对话历史
      const conversationHistory = this.messages.slice(0, -1); // 排除最后一条（当前）消息
      
      const systemPrompt = this.buildSystemPrompt(context);
      console.log('System prompt (first 500 chars):', systemPrompt.substring(0, 500));
      
      const stream = this.plugin.openCodeService.query(messageContent, {
        conversationHistory: conversationHistory,
        systemPrompt: systemPrompt,
        stream: true,
        model: this.modelSelect.value !== 'auto' ? this.modelSelect.value : undefined,
        thinking: this.plugin.settings.showThinking,
        attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined
      });
      
      for await (const chunk of stream) {
        console.log('Received chunk:', chunk.type, chunk.content ? `content length: ${chunk.content.length}` : '');
        if (chunk.type === 'text' && chunk.content) {
          fullContent += chunk.content;
          await this.updateAssistantContent(assistantContainer, fullContent, thinkingContent);
        } else if (chunk.type === 'thinking' && chunk.content) {
          thinkingContent += chunk.content;
          await this.updateAssistantThinking(assistantContainer, thinkingContent);
        } else if (chunk.type === 'error') {
          await this.updateAssistantError(assistantContainer, chunk.error || t('error', lang));
          break;
        } else if (chunk.type === 'done') {
          console.log('Stream done, fullContent length:', fullContent.length, 'thinkingContent length:', thinkingContent.length);
          break;
        }
      }
      
      // Save assistant message
      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
        thinking: thinkingContent || undefined
      };
      
      this.messages.push(assistantMessage);
      
      // Save conversation
      await this.saveConversation();
      
    } catch (error) {
      console.error('Error sending message:', error);
      await this.updateAssistantError(assistantContainer, t('connectionError', lang));
    } finally {
      this.isStreaming = false;
      this.updateInputButtons();
      
      // Ensure input is enabled
      if (this.textarea) {
        this.textarea.disabled = false;
        this.textarea.readOnly = false;
        this.textarea.focus();
      }
    }
  }

  private stopGeneration(): void {
    this.plugin.openCodeService.stopGeneration();
    this.isStreaming = false;
    this.updateInputButtons();
    
    // Ensure input is enabled
    if (this.textarea) {
      this.textarea.disabled = false;
      this.textarea.readOnly = false;
      this.textarea.focus();
    }
    
    new Notice(t('requestCancelled', this.plugin.settings.language));
  }

  private updateInputButtons(): void {
    if (this.isStreaming) {
      this.sendBtn.style.display = 'none';
      this.stopBtn.style.display = 'inline-block';
    } else {
      this.sendBtn.style.display = 'inline-block';
      this.stopBtn.style.display = 'none';
    }
  }

  private addMessage(message: ChatMessage): void {
    const lang = this.plugin.settings.language;
    
    if (message.role === 'user') {
      const msgEl = this.messagesContainer.createDiv({ 
        cls: 'opensidian-message opensidian-user',
        attr: { 'data-message-id': message.id }
      });
      
      const avatar = msgEl.createDiv({ cls: 'opensidian-avatar' });
      avatar.innerHTML = '👤';
      
      const contentContainer = msgEl.createDiv({ cls: 'opensidian-message-container' });
      
      const contentEl = contentContainer.createDiv({ cls: 'opensidian-message-content' });
      contentEl.textContent = message.content;
      
      // Copy button
      const copyBtn = contentContainer.createEl('button', {
        cls: 'opensidian-copy-btn',
        attr: { 'aria-label': t('copy', lang) }
      });
      copyBtn.innerHTML = '📋';
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(message.content).then(() => {
          new Notice(t('copied', lang));
        });
      };
      
      // Show attachments if any
      if (message.images && message.images.length > 0) {
        const attachmentsEl = contentEl.createDiv({ cls: 'opensidian-attachments-preview' });
        for (const img of message.images) {
          attachmentsEl.createEl('img', {
            cls: 'opensidian-attachment',
            attr: { src: `data:${img.mimeType};base64,${img.base64Data}` }
          });
        }
      }
      
      const time = msgEl.createDiv({ cls: 'opensidian-message-time' });
      time.textContent = this.formatTime(message.timestamp);
    }
    
    this.scrollToBottom();
  }

  private createAssistantMessageContainer(id: string): HTMLElement {
    const lang = this.plugin.settings.language;
    
    const msgEl = this.messagesContainer.createDiv({ 
      cls: 'opensidian-message opensidian-assistant',
      attr: { 'data-message-id': id }
    });
    
    const avatar = msgEl.createDiv({ cls: 'opensidian-avatar' });
    avatar.innerHTML = '🤖';
    
    const contentContainer = msgEl.createDiv({ cls: 'opensidian-message-container' });
    
    // Thinking section (initially hidden)
    const thinkingEl = contentContainer.createDiv({ 
      cls: `opensidian-thinking ${this.plugin.settings.thinkingCollapsed ? 'collapsed' : ''}`,
      attr: { style: 'display: none;' }
    });
    const thinkingHeader = thinkingEl.createDiv({ cls: 'opensidian-thinking-header' });
    thinkingHeader.innerHTML = `🤔 ${t('thinkingProcess', lang)}`;
    const thinkingContent = thinkingEl.createDiv({ cls: 'opensidian-thinking-content' });
    
    thinkingHeader.onclick = () => {
      thinkingEl.toggleClass('collapsed', !thinkingEl.hasClass('collapsed'));
    };
    
    this.thinkingElements.set(id, thinkingContent);
    
    // Main content
    const contentEl = contentContainer.createDiv({ cls: 'opensidian-message-content opensidian-streaming' });
    contentEl.textContent = t('generating', lang);
    
    // Action buttons (copy, etc.)
    const actionsEl = contentContainer.createDiv({ cls: 'opensidian-message-actions' });
    const copyBtn = actionsEl.createEl('button', { 
      cls: 'opensidian-action-btn',
      attr: { 'aria-label': t('copy', lang) }
    });
    copyBtn.innerHTML = '📋';
    copyBtn.onclick = async () => {
      const content = contentEl.textContent || '';
      await navigator.clipboard.writeText(content);
      new Notice(t('copied', lang));
    };
    
    this.scrollToBottom();
    
    return contentContainer;
  }

  private async updateAssistantContent(container: HTMLElement, content: string, thinking: string): Promise<void> {
    const contentEl = container.querySelector('.opensidian-message-content');
    if (contentEl) {
      contentEl.removeClass('opensidian-streaming');
      contentEl.empty();
      
      // Render markdown
      await MarkdownRenderer.render(
        this.app,
        content,
        contentEl as HTMLElement,
        '',
        this.component
      );
    }
    
    // Show thinking if exists
    if (thinking && this.plugin.settings.showThinking) {
      const thinkingEl = container.querySelector('.opensidian-thinking') as HTMLElement;
      if (thinkingEl) {
        thinkingEl.style.display = 'block';
      }
    }
    
    this.scrollToBottom();
  }

  private async updateAssistantThinking(container: HTMLElement, thinking: string): Promise<void> {
    const thinkingContent = container.querySelector('.opensidian-thinking-content');
    if (thinkingContent) {
      thinkingContent.textContent = thinking;
    }
    
    const thinkingEl = container.querySelector('.opensidian-thinking') as HTMLElement;
    if (thinkingEl && this.plugin.settings.showThinking) {
      thinkingEl.style.display = 'block';
    }
  }

  private async updateAssistantError(container: HTMLElement, error: string): Promise<void> {
    const lang = this.plugin.settings.language;
    const contentEl = container.querySelector('.opensidian-message-content');
    if (contentEl) {
      contentEl.removeClass('opensidian-streaming');
      contentEl.addClass('opensidian-error');
      
      // Provide more user-friendly error messages
      let userError = error;
      
      if (error.includes('timeout') || error.includes('terminated') || error.includes('SIGTERM')) {
        if (lang === 'zh') {
          userError = '请求超时。对话历史可能过长，建议使用"清空当前对话"功能开始新对话。';
        } else {
          userError = 'Request timeout. Conversation history may be too long. It is recommended to use "Clear current" to start a new conversation.';
        }
      } else if (error.includes('exit code')) {
        if (lang === 'zh') {
          userError = `处理失败：${error}`;
        } else {
          userError = `Processing failed: ${error}`;
        }
      }
      
      contentEl.textContent = `${t('error', lang)}: ${userError}`;
    }
  }

  private async prepareContext(input: string): Promise<any> {
    const context: any = {
      files: [],
      activeFile: null,
      mode: this.currentMode,
      vaultPath: this.plugin.getVaultPath()
    };
    
    // Extract @ mentions
    const mentions = input.match(/@(\S+)/g) || [];
    for (const mention of mentions) {
      const fileName = mention.slice(1);
      const file = this.plugin.app.metadataCache.getFirstLinkpathDest(fileName, '');
      if (file) {
        let content = await this.plugin.getFileContent(file);
        // Limit content length to avoid token overflow
        if (content.length > 4000) {
          content = content.substring(0, 4000) + '\n\n... (内容过长，已截断)';
        }
        const fullPath = this.plugin.getVaultPath() ? 
          `${this.plugin.getVaultPath()}/${file.path}` : file.path;
        context.files.push({ 
          path: file.path, 
          fullPath: fullPath,
          content 
        });
      }
    }
    
    // Add active file
    const activeFile = this.plugin.getActiveFile();
    if (activeFile && !context.files.find((f: any) => f.path === activeFile.path)) {
      let content = await this.plugin.getFileContent(activeFile);
      // Limit content length to avoid token overflow
      if (content.length > 4000) {
        content = content.substring(0, 4000) + '\n\n... (内容过长，已截断)';
      }
      const fullPath = this.plugin.getVaultPath() ? 
        `${this.plugin.getVaultPath()}/${activeFile.path}` : activeFile.path;
      context.activeFile = { 
        path: activeFile.path, 
        fullPath: fullPath,
        content 
      };
    }
    
    return context;
  }

  private buildSystemPrompt(context: any): string {
    const lang = this.plugin.settings.language;
    let prompt = lang === 'zh' 
      ? '你是一个帮助管理 Obsidian 笔记库的 AI 助手。'
      : 'You are an AI assistant helping with an Obsidian vault.';
    
    prompt += lang === 'zh'
      ? '你可以访问笔记库内容，读取、写入和编辑笔记。请提供有帮助、简洁且准确的回答。\n\n'
      : 'You have access to the vault contents and can read, write, and edit notes. Be helpful, concise, and accurate.\n\n';
    
    // Add mode instruction
    if (context.mode === 'plan') {
      prompt += lang === 'zh'
        ? '【计划模式】你只能提供建议和方案，不能直接执行任何操作。请详细说明你的计划，等待用户确认后再执行。\n\n'
        : '[PLAN MODE] You can only provide suggestions and plans, cannot execute any actions. Explain your plan in detail and wait for user confirmation.\n\n';
    } else {
      prompt += lang === 'zh'
        ? '【构建模式】你可以直接执行操作来完成任务。\n\n'
        : '[BUILD MODE] You can execute actions directly to complete tasks.\n\n';
    }
    
    // Add vault path information
    if (context.vaultPath) {
      prompt += lang === 'zh' 
        ? `笔记库路径：${context.vaultPath}\n\n`
        : `Vault path: ${context.vaultPath}\n\n`;
    }
    
    if (context.files.length > 0) {
      prompt += lang === 'zh' ? '引用的文件：\n' : 'Referenced files:\n';
      for (const file of context.files) {
        prompt += lang === 'zh' 
          ? `文件：${file.path}\n完整路径：${file.fullPath}\n内容：\n${file.content}\n\n`
          : `File: ${file.path}\nFull path: ${file.fullPath}\nContent:\n${file.content}\n\n`;
      }
    }
    
    if (context.activeFile) {
      prompt += lang === 'zh' 
        ? `当前文件：${context.activeFile.path}\n完整路径：${context.activeFile.fullPath}\n`
        : `Active file: ${context.activeFile.path}\nFull path: ${context.activeFile.fullPath}\n`;
    }
    
    if (this.plugin.settings.customSystemPrompt) {
      prompt += `\n${this.plugin.settings.customSystemPrompt}`;
    }
    
    return prompt;
  }

  private toggleMode(): void {
    const lang = this.plugin.settings.language;
    
    // Save current mode's context
    if (this.currentConversationId) {
      this.modeMemory.set(`${this.currentConversationId}-${this.currentMode}`, {
        mode: this.currentMode,
        messages: [...this.messages]
      });
    }
    
    // Switch mode
    const newMode: AgentMode = this.currentMode === 'plan' ? 'build' : 'plan';
    
    // Check if we have saved messages for this conversation + new mode
    let restoredMessages: ChatMessage[] | null = null;
    if (this.currentConversationId) {
      const saved = this.modeMemory.get(`${this.currentConversationId}-${newMode}`);
      if (saved) {
        restoredMessages = saved.messages;
      }
    }
    
    this.currentMode = newMode;
    this.plugin.settings.agentMode = newMode;
    this.plugin.saveSettings();
    
    // Update button text
    this.modeBtn.textContent = newMode === 'plan' 
      ? t('planMode', lang)
      : t('buildMode', lang);
    
    // Add mode switch indicator in chat
    const modeIndicator = this.messagesContainer.createDiv({ cls: 'opensidian-mode-indicator' });
    modeIndicator.textContent = newMode === 'plan'
      ? (lang === 'zh' ? '🔄 已切换到计划模式 - AI 将只提供建议' : '🔄 Switched to Plan Mode - AI will only provide suggestions')
      : (lang === 'zh' ? '🔄 已切换到构建模式 - AI 可以执行操作' : '🔄 Switched to Build Mode - AI can execute actions');
    
    // Restore messages if available
    if (restoredMessages) {
      this.messages = restoredMessages;
      this.messagesContainer.empty();
      for (const message of this.messages) {
        this.addMessage(message);
      }
    }
    
    this.scrollToBottom();
    
    // Show notification
    const noticeText = restoredMessages 
      ? t('modeSwitched', lang) + ' - ' + (lang === 'zh' ? '已恢复该模式下的对话历史' : 'Restored conversation history for this mode')
      : t('modeSwitched', lang) + ': ' + (newMode === 'plan' ? t('planMode', lang) : t('buildMode', lang));
    new Notice(noticeText);
  }

  private toggleLanguage(): void {
    const newLang: Language = this.plugin.settings.language === 'zh' ? 'en' : 'zh';
    this.plugin.settings.language = newLang;
    this.plugin.saveSettings();
    
    // Refresh the entire view
    this.refreshView();
    
    new Notice(newLang === 'zh' ? '已切换到中文' : 'Switched to English');
  }

  private async refreshView(): Promise<void> {
    // Save current state
    const savedMessages = [...this.messages];
    const savedConversationId = this.currentConversationId;
    
    // Clear and rebuild UI
    this.container.empty();
    
    // Recreate sidebar
    this.createSidebar();
    
    // Create main content area
    const mainContent = this.container.createDiv({ cls: 'opensidian-main-content' });
    
    // Create header
    this.createHeader(mainContent);
    
    // Create messages area
    this.createMessagesArea(mainContent);
    
    // Create input area
    this.createInputArea(mainContent);
    
    // Restore state
    this.currentConversationId = savedConversationId;
    this.messages = savedMessages;
    
    // Re-render messages
    this.messagesContainer.empty();
    if (this.messages.length === 0) {
      this.addWelcomeMessage();
    } else {
      for (const message of this.messages) {
        if (message.role === 'user') {
          this.addMessage(message);
        } else {
          const container = this.createAssistantMessageContainer(message.id);
          await this.updateAssistantContent(container, message.content, message.thinking || '');
        }
      }
    }
  }

  private async addAttachment(): Promise<void> {
    const lang = this.plugin.settings.language;
    
    // Create file input that can select files from anywhere
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.txt,.md,.doc,.docx,.json,.js,.ts,.py,.java,.c,.cpp,.h,.css,.html,.xml,.yaml,.yml';
    
    input.onchange = async () => {
      if (!input.files) return;
      
      for (const file of Array.from(input.files)) {
        if (this.attachments.length >= 5) {
          new Notice(t('attachmentLimit', lang));
          break;
        }
        
        try {
          const base64 = await this.fileToBase64(file);
          // 保存到附件目录
          const filePath = await this.saveAttachmentToVault(file, base64);
          
          this.attachments.push({
            id: this.generateId(),
            mimeType: file.type || 'application/octet-stream',
            base64Data: base64,
            fileName: file.name,
            filePath: filePath
          });
          
          new Notice(`已添加附件: ${file.name}`);
        } catch (error) {
          console.error('Failed to save attachment:', error);
          new Notice(`添加失败: ${file.name}`);
        }
      }
      
      this.updateAttachmentsUI();
    };
    
    input.click();
  }

  private async handleFileDrop(e: DragEvent): Promise<void> {
    const lang = this.plugin.settings.language;
    const files = e.dataTransfer?.files;
    
    if (!files) return;
    
    for (const file of Array.from(files)) {
      if (this.attachments.length >= 5) {
        new Notice(t('attachmentLimit', lang));
        break;
      }
      
      try {
        const base64 = await this.fileToBase64(file);
        // 保存到附件目录
        const filePath = await this.saveAttachmentToVault(file, base64);
        
        this.attachments.push({
          id: this.generateId(),
          mimeType: file.type || 'application/octet-stream',
          base64Data: base64,
          fileName: file.name,
          filePath: filePath
        });
        
        new Notice(`已添加附件: ${file.name}`);
      } catch (error) {
        console.error('Failed to save dropped file:', error);
        new Notice(`添加失败: ${file.name}`);
      }
    }
    
    this.updateAttachmentsUI();
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private generateAttachmentFileName(originalName: string): string {
    // 移除路径信息，只保留文件名
    const fileName = originalName.replace(/^.*[\\/]/, '');
    // 替换不安全字符
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    // 添加时间戳确保唯一性
    const timestamp = Date.now();
    return `${timestamp}_${safeName}`;
  }

  private async saveAttachmentToVault(file: File, base64Data: string): Promise<string> {
    const fileName = this.generateAttachmentFileName(file.name);
    const filePath = `.opensidian/attachments/${fileName}`;
    
    try {
      // 解码 base64 为二进制数据
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // 写入文件
      await this.plugin.app.vault.adapter.write(filePath, bytes.buffer);
      return filePath;
    } catch (error) {
      console.error('Failed to save attachment to vault:', error);
      throw new Error(`无法保存附件: ${file.name}`);
    }
  }

  private updateAttachmentsUI(): void {
    const container = this.inputContainer.querySelector('.opensidian-attachments');
    if (!container) return;
    
    container.empty();
    
    for (const attachment of this.attachments) {
      const item = container.createDiv({ cls: 'opensidian-attachment-item' });
      
      if (attachment.mimeType.startsWith('image/')) {
        const img = item.createEl('img');
        img.src = `data:${attachment.mimeType};base64,${attachment.base64Data}`;
      } else {
        item.createSpan({ text: '📄 ' + attachment.fileName });
      }
      
      const removeBtn = item.createEl('button', { cls: 'opensidian-attachment-remove' });
      removeBtn.innerHTML = '✕';
      removeBtn.onclick = () => {
        this.attachments = this.attachments.filter(a => a.id !== attachment.id);
        this.updateAttachmentsUI();
      };
    }
  }

  private async loadHistoryList(container: HTMLElement): Promise<void> {
    container.empty();
    const lang = this.plugin.settings.language;
    
    const sessions = await this.plugin.storage.listSessions();
    
    if (sessions.length === 0) {
      container.createDiv({ 
        cls: 'opensidian-history-empty',
        text: t('noHistory', lang)
      });
      return;
    }
    
    for (const sessionId of sessions) {
      const session = await this.plugin.storage.loadSession(sessionId);
      if (!session) continue;
      
      const item = container.createDiv({ cls: 'opensidian-history-item' });
      item.createDiv({ 
        cls: 'opensidian-history-title',
        text: session.title || 'Untitled'
      });
      item.createDiv({ 
        cls: 'opensidian-history-date',
        text: this.formatDate(session.updatedAt)
      });
      
      item.onclick = () => this.loadSession(sessionId);
      
      // Delete button
      const deleteBtn = item.createEl('button', { 
        cls: 'opensidian-history-delete',
        attr: { 'aria-label': t('deleteConversation', lang) }
      });
      deleteBtn.innerHTML = '🗑️';
      deleteBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(t('deleteConfirm', lang))) {
          await this.plugin.storage.deleteSession(sessionId);
          new Notice(t('sessionDeleted', lang));
          this.loadHistoryList(container);
          
          // If deleted current session, start new
          if (sessionId === this.currentConversationId) {
            this.startNewConversation();
          }
        }
      };
    }
  }

  private async populateHistorySelect(): Promise<void> {
    // Update dropdown panel if exists
    if (this.historyPanel) {
      await this.populateHistoryPanel();
    }
    
    // Keep compatibility with old select element if it exists
    if (!this.historySelect) return;
    
    const lang = this.plugin.settings.language;
    const sessions = await this.plugin.storage.listSessions();
    
    // Store current selection
    const currentValue = this.historySelect.value;
    this.historySelect.empty();
    
    // Add default option
    this.historySelect.createEl('option', {
      value: '',
      text: t('history', lang)
    });
    
    // Add sessions
    for (const sessionId of sessions) {
      const session = await this.plugin.storage.loadSession(sessionId);
      if (!session) continue;
      
      const option = this.historySelect.createEl('option', {
        value: sessionId,
        text: session.title || 'Untitled'
      });
      
      // Add date as title attribute for tooltip
      option.setAttribute('title', this.formatDate(session.updatedAt));
      
      if (sessionId === this.currentConversationId) {
        option.selected = true;
      }
    }
    
    // Restore selection if still exists
    if (currentValue && this.historySelect.querySelector(`option[value="${currentValue}"]`)) {
      this.historySelect.value = currentValue;
    }
  }

  private async deleteCurrentHistory(): Promise<void> {
    let sessionId: string | null = null;
    
    // Try to get session ID from history select if exists
    if (this.historySelect) {
      sessionId = this.historySelect.value;
    }
    
    // If no session ID from select, use current conversation
    if (!sessionId && this.currentConversationId) {
      sessionId = this.currentConversationId;
    }
    
    if (!sessionId) return;
    
    const lang = this.plugin.settings.language;
    if (confirm(t('deleteConfirm', lang))) {
      await this.plugin.storage.deleteSession(sessionId);
      new Notice(t('sessionDeleted', lang));
      
      // If deleted current session, start new
      if (sessionId === this.currentConversationId) {
        this.startNewConversation();
      }
      
      // Refresh history select
      await this.populateHistorySelect();
    }
  }

  private async loadSession(sessionId: string): Promise<void> {
    const session = await this.plugin.storage.loadSession(sessionId);
    if (!session) return;
    
    this.currentConversationId = sessionId;
    this.messages = session.messages || [];
    this.currentMode = session.mode || this.plugin.settings.agentMode;
    this.messagesContainer.empty();
    
    // Update history select
    if (this.historySelect) {
      this.historySelect.value = sessionId;
    }
    
    // Save to mode memory for this conversation + mode
    this.modeMemory.set(`${this.currentConversationId}-${this.currentMode}`, {
      mode: this.currentMode,
      messages: [...this.messages]
    });
    
    // Update mode button
    this.modeBtn.textContent = this.currentMode === 'plan' 
      ? t('planMode', this.plugin.settings.language)
      : t('buildMode', this.plugin.settings.language);
    
    for (const message of this.messages) {
      if (message.role === 'user') {
        this.addMessage(message);
      } else {
        const container = this.createAssistantMessageContainer(message.id);
        await this.updateAssistantContent(container, message.content, message.thinking || '');
      }
    }
  }

  private async saveConversation(): Promise<void> {
    if (this.messages.length === 0) return;
    
    if (!this.currentConversationId) {
      this.currentConversationId = this.generateId();
    }
    
    const session: SessionData = {
      id: this.currentConversationId,
      title: this.messages[0]?.content.slice(0, 50) || 'New Conversation',
      messages: this.messages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      model: this.plugin.openCodeService.getActiveModel(),
      mode: this.currentMode
    };
    
    await this.plugin.storage.saveSession(this.currentConversationId, session);
    
    // Refresh history list
    const historyList = this.sidebarContainer.querySelector('.opensidian-history-list');
    if (historyList) {
      await this.loadHistoryList(historyList as HTMLElement);
    }
    
    // Refresh history select
    await this.populateHistorySelect();
  }

  private startNewConversation(): void {
    this.currentConversationId = null;
    this.messages = [];
    this.messagesContainer.empty();
    this.addWelcomeMessage();
    
    // Reset history select
    if (this.historySelect) {
      this.historySelect.value = '';
    }
    
    // Ensure input is enabled and focused
    if (this.textarea) {
      this.textarea.disabled = false;
      this.textarea.readOnly = false;
      this.textarea.focus();
    }
    
    // Ensure buttons are in correct state
    this.isStreaming = false;
    this.updateInputButtons();
  }

  private toggleSidebar(): void {
    this.sidebarContainer.classList.toggle('opensidian-sidebar-collapsed');
    const collapseBtn = this.sidebarContainer.querySelector('.opensidian-sidebar-collapse-btn');
    if (collapseBtn) {
      if (this.sidebarContainer.classList.contains('opensidian-sidebar-collapsed')) {
        collapseBtn.innerHTML = '▼'; // 向下箭头，表示可以展开
      } else {
        collapseBtn.innerHTML = '▲'; // 向上箭头，表示可以折叠
      }
    }
  }

  private registerEvents(): void {
    this.registerEvent(
      (this.app.workspace as any).on('opensidian:new-conversation', () => {
        this.startNewConversation();
      })
    );
    
    this.registerEvent(
      (this.app.workspace as any).on('opensidian:active-file-change', (_file: TFile) => {
        // Could update context here
      })
    );
  }

  private openSettings(): void {
    // @ts-expect-error - Obsidian API internal method
    this.app.setting.open();
    // @ts-expect-error - Obsidian API internal method
    this.app.setting.openTabById('opensidian');
  }

  private scrollToBottom(): void {
    if (this.plugin.settings.enableAutoScroll) {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(
      this.plugin.settings.language === 'zh' ? 'zh-CN' : 'en-US'
    );
  }

  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const lang = this.plugin.settings.language;
    
    if (days === 0) return t('today', lang);
    if (days === 1) return t('yesterday', lang);
    
    return date.toLocaleDateString(
      lang === 'zh' ? 'zh-CN' : 'en-US'
    );
  }

  private async updateConnectionStatus(): Promise<void> {
    const lang = this.plugin.settings.language;
    const service = this.plugin.openCodeService;
    
    // Check OpenCode CLI connection
    const opencodePath = service.getOpenCodePath();
    const hasOpencodeCli = !!opencodePath;
    
    // Check local model connection
    let localModelConnected = false;
    if (this.plugin.settings.localModel.enabled) {
      const baseUrl = this.plugin.settings.localModel.baseUrl;
      if (baseUrl) {
        try {
          const testUrl = baseUrl.replace(/\/$/, '') + '/v1/models';
          const response = await fetch(testUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
          localModelConnected = response.ok;
        } catch {
          localModelConnected = false;
        }
      }
    }
    
    // Determine overall status
    let statusText = '';
    let statusClass = '';
    
    if (hasOpencodeCli) {
      statusText = lang === 'zh' ? '✅ CLI 已连接' : '✅ CLI Connected';
      statusClass = 'opensidian-status-connected';
    } else if (localModelConnected) {
      statusText = lang === 'zh' ? '✅ 本地模型已连接' : '✅ Local Model Connected';
      statusClass = 'opensidian-status-connected';
    } else if (this.plugin.settings.opencodeZenApiKey) {
      statusText = lang === 'zh' ? '🌐 API 密钥已配置' : '🌐 API Key Configured';
      statusClass = 'opensidian-status-api';
    } else {
      statusText = lang === 'zh' ? '❌ 未连接' : '❌ Not Connected';
      statusClass = 'opensidian-status-disconnected';
    }
    
    this.statusIndicator.textContent = statusText;
    this.statusIndicator.className = 'opensidian-status-indicator ' + statusClass;
  }

  private toggleHistoryDropdown(): void {
    if (!this.historyDropdown) return;
    
    if (this.historyDropdown.style.display === 'none') {
      this.showHistoryDropdown();
    } else {
      this.hideHistoryDropdown();
    }
  }

  private showHistoryDropdown(): void {
    if (!this.historyDropdown || !this.historyPanel) return;
    
    this.historyDropdown.style.display = 'block';
    this.populateHistoryPanel();
    
    // Close dropdown when clicking outside
    const closeOnClickOutside = (e: MouseEvent) => {
      if (this.historyDropdown && !this.historyDropdown.contains(e.target as Node)) {
        this.hideHistoryDropdown();
        document.removeEventListener('click', closeOnClickOutside);
      }
    };
    
    setTimeout(() => {
      document.addEventListener('click', closeOnClickOutside);
    }, 0);
  }

  private hideHistoryDropdown(): void {
    if (!this.historyDropdown) return;
    this.historyDropdown.style.display = 'none';
    this.selectedHistoryIds.clear();
  }

  private async populateHistoryPanel(): Promise<void> {
    if (!this.historyPanel) return;
    
    const lang = this.plugin.settings.language;
    this.historyPanel.empty();
    this.historyCheckboxes.clear();
    
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
      
      const item = this.historyPanel.createDiv({ cls: 'opensidian-history-panel-item' });
      
      // Checkbox
      const checkbox = item.createEl('input', {
        type: 'checkbox',
        cls: 'opensidian-history-checkbox',
        attr: { 'data-session-id': sessionId }
      }) as HTMLInputElement;
      
      checkbox.onchange = () => {
        if (checkbox.checked) {
          this.selectedHistoryIds.add(sessionId);
        } else {
          this.selectedHistoryIds.delete(sessionId);
        }
      };
      
      this.historyCheckboxes.set(sessionId, checkbox);
      
      // Session info
      const info = item.createDiv({ cls: 'opensidian-history-info' });
      info.createDiv({ 
        cls: 'opensidian-history-title',
        text: session.title || 'Untitled'
      });
      info.createDiv({ 
        cls: 'opensidian-history-date',
        text: this.formatDate(session.updatedAt)
      });
      
      // Click to load session
      item.onclick = (e) => {
        if (e.target === checkbox || checkbox.contains(e.target as Node)) {
          return; // Don't load when clicking checkbox
        }
        this.loadSession(sessionId);
        this.hideHistoryDropdown();
      };
    }
  }

  private selectAllHistories(): void {
    this.selectedHistoryIds.clear();
    for (const [sessionId, checkbox] of this.historyCheckboxes) {
      checkbox.checked = true;
      this.selectedHistoryIds.add(sessionId);
    }
  }

  private deselectAllHistories(): void {
    this.selectedHistoryIds.clear();
    for (const checkbox of this.historyCheckboxes.values()) {
      checkbox.checked = false;
    }
  }

  private async deleteSelectedHistories(): Promise<void> {
    const lang = this.plugin.settings.language;
    if (this.selectedHistoryIds.size === 0) {
      new Notice(t('noHistoryFound', lang));
      return;
    }
    
    if (!confirm(t('deleteConfirm', lang) + ` (${this.selectedHistoryIds.size})`)) {
      return;
    }
    
    for (const sessionId of this.selectedHistoryIds) {
      await this.plugin.storage.deleteSession(sessionId);
      
      // If deleted current session, start new
      if (sessionId === this.currentConversationId) {
        this.startNewConversation();
      }
    }
    
    this.selectedHistoryIds.clear();
    await this.populateHistoryPanel();
    new Notice(t('sessionDeleted', lang));
  }

  private clearCurrentConversation(): void {
    const lang = this.plugin.settings.language;
    
    if (this.messages.length === 0) {
      new Notice(t('noMessages', lang));
      return;
    }
    
    if (confirm(t('clearCurrentConfirm', lang))) {
      this.messages = [];
      this.messagesContainer.empty();
      this.addWelcomeMessage();
      this.hideHistoryDropdown();
      new Notice(t('currentConversationCleared', lang));
    }
  }
}
