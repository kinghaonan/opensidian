import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import OpensidianPlugin from '../../main';
import { ChatMessage, ImageAttachment } from '../../core/types/chat';
import { AgentMode, Language } from '../../core/types/settings';
import { SessionData } from '../../core/storage/StorageService';
import { t } from '../../i18n';
import { ChatHeader } from './components/ChatHeader';
import { MessageList } from './components/MessageList';
import { InputArea } from './components/InputArea';
import { Sidebar } from './components/Sidebar';
import { TabBar } from './components/TabBar';
import { ConnectionManager, StreamBuffer } from '../../core/agent/ConnectionManager';
import { QuickToolSelection } from './components/ToolQuickPicker';
import { TabManager, Tab } from './TabManager';
import { StreamController } from './controllers/StreamController';

export const VIEW_TYPE_OPENCODE = 'opensidian-chat-view';

export class OpensidianView extends ItemView {
  private plugin: OpensidianPlugin;
  private container!: HTMLElement;
  private messagesContainer!: HTMLElement;
  private inputContainer!: HTMLElement;
  private sidebarContainer!: HTMLElement;
  private headerContainer!: HTMLElement;
  
  private currentConversationId: string | null = null;
  private streamingTabs: Set<string> = new Set();
  
  private header!: ChatHeader;
  private messageList!: MessageList;
  private inputArea!: InputArea;
  private sidebar!: Sidebar;
  private tabBar!: TabBar;
  private tabManager!: TabManager;
  
  private connectionManager!: ConnectionManager;
  private streamBuffer!: StreamBuffer;
  
  private currentMode: AgentMode;
  private modeMemory: Map<string, { mode: AgentMode; messages: ChatMessage[] }> = new Map();

  constructor(leaf: WorkspaceLeaf, plugin: OpensidianPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentMode = plugin.settings.agentMode;
    
    this.tabManager = new TabManager();
    this.tabManager.setCallbacks({
      onTabCreated: (_tab) => {},
      onTabClosed: (tabId) => {
        this.streamingTabs.delete(tabId);
        this.plugin.openCodeService.stopGeneration();
      },
      onTabSwitched: (_id) => this.onTabSwitched(),
    });
    
    this.connectionManager = new ConnectionManager({
      maxRetries: 3,
      retryDelay: 1000,
      heartbeatInterval: 30000,
      timeout: 300000,
    });
    
    this.streamBuffer = new StreamBuffer();
    this.setupConnectionListeners();
  }

  private get isStreaming(): boolean {
    return this.tabManager.getActiveTabId() ? this.streamingTabs.has(this.tabManager.getActiveTabId()!) : false;
  }

  private get messages(): ChatMessage[] {
    return this.tabManager.getActiveTab()?.messages || [];
  }

  private set messages(msgs: ChatMessage[]) {
    const tab = this.tabManager.getActiveTab();
    if (tab) { tab.messages = msgs; tab.updatedAt = Date.now(); }
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
    this.container = this.contentEl.createDiv({ cls: 'opensidian-container' });
    
    this.createSidebar();
    
    const mainContent = this.container.createDiv({ cls: 'opensidian-main-content' });
    
    this.headerContainer = mainContent.createDiv();
    this.createHeader();
    
    const tabBarContainer = mainContent.createDiv({ cls: 'opensidian-tab-bar-container' });
    this.createTabBar(tabBarContainer);
    
    this.messagesContainer = mainContent.createDiv({ cls: 'opensidian-messages' });
    this.createMessageList();
    
    this.inputContainer = mainContent.createDiv({ cls: 'opensidian-input-area' });
    this.createInputArea();
    
    await this.loadConversation();
    this.registerEvents();
  }

  async onClose(): Promise<void> {
    this.messageList?.unload();
    this.header?.unload();
  }

  private createSidebar(): void {
    this.sidebarContainer = this.container.createDiv({ cls: 'opensidian-sidebar' });
    this.sidebar = new Sidebar(this.sidebarContainer, this.plugin);
    this.sidebar.setCallbacks({
      onLoadSession: (id) => this.loadSession(id),
      onNewConversation: () => this.startNewConversation(),
      onDeleteSessions: (ids) => this.deleteSessions(ids),
    });
    this.sidebar.render();
  }

  private createTabBar(container: HTMLElement): void {
    this.tabBar = new TabBar(container, this.tabManager, {
      onTabClick: (id) => {
        this.tabManager.switchTab(id);
      },
      onNewTab: () => {
        this.streamingTabs.clear();
        this.plugin.openCodeService.stopGeneration();
        this.tabManager.createTab('New Chat', this.plugin.openCodeService.getActiveModel(), this.currentMode);
        this.messageList.clear();
        this.inputArea.setStreaming(false);
        this.header.setStreaming(false);
        this.messageList.addWelcomeMessage();
      },
    });
    this.tabBar.render();
  }

  private onTabSwitched(): void {
    const newTab = this.tabManager.getActiveTab();
    if (!newTab) return;
    this.currentMode = newTab.mode;
    this.header.setMode(newTab.mode);
    this.inputArea.setStreaming(this.streamingTabs.has(newTab.id));
    this.header.setStreaming(this.streamingTabs.has(newTab.id));
    this.messageList.clear();
    const msgs = newTab.messages.filter(m => m.content || m.role === 'user');
    if (msgs.length === 0) {
      this.messageList.addWelcomeMessage();
    } else {
      this.messageList.setMessages(msgs);
    }
  }

  private createHeader(): void {
    this.header = new ChatHeader(this.headerContainer, this.plugin);
    this.header.setCallbacks({
      onModelChange: (model) => this.handleModelChange(model),
      onModeChange: (mode) => this.handleModeChange(mode),
      onLanguageChange: () => this.refreshView(),
      onHistoryClick: () => this.sidebar.expand(),
      onSettingsClick: () => this.openSettings(),
      onRefreshModels: () => this.refreshModels(),
      onReconnect: () => this.reconnect(),
      onStop: () => this.stopGeneration(),
    });
    this.header.render();
  }

  private createMessageList(): void {
    this.messageList = new MessageList(this.messagesContainer, this.plugin);
    this.messageList.load();
  }

  private createInputArea(): void {
    this.inputArea = new InputArea(this.inputContainer, this.plugin);
    this.inputArea.setCallbacks({
      onSend: (msg, attachments, tools) => this.sendMessage(msg, attachments, tools),
      onAppend: (msg, attachments, tools) => this.appendMessage(msg, attachments, tools),
    });
    this.inputArea.render();
  }

  private setupConnectionListeners(): void {
    this.connectionManager.setListeners({
      onStateChange: (state) => {
        console.log('Connection state:', state);
      },
      onError: (error) => {
        console.error('Connection error:', error);
        const lang = this.plugin.settings.language;
        new Notice(lang === 'zh' ? `连接错误: ${error.message}` : `Connection error: ${error.message}`);
      },
      onReconnect: (attempt) => {
        console.log('Reconnecting...', attempt);
        const lang = this.plugin.settings.language;
        new Notice(lang === 'zh' ? `正在重连 (${attempt})...` : `Reconnecting (${attempt})...`);
      },
    });
  }

  private async handleModelChange(model: string): Promise<void> {
    await this.plugin.openCodeService.switchModel(model);
    this.header.populateModelSelect();
  }

  private handleModeChange(mode: AgentMode): void {
    if (this.currentConversationId) {
      this.modeMemory.set(`${this.currentConversationId}-${this.currentMode}`, {
        mode: this.currentMode,
        messages: [...this.messages]
      });
    }
    
    this.currentMode = mode;
    this.messageList.addModeIndicator(mode);
    
    const saved = this.modeMemory.get(`${this.currentConversationId}-${mode}`);
    if (saved) {
      this.messages = saved.messages;
      this.messageList.setMessages(this.messages);
    }
    
    new Notice(t('modeSwitched', this.plugin.settings.language));
  }

  private async refreshModels(): Promise<void> {
    await this.plugin.openCodeService.loadAvailableModels();
    this.header.populateModelSelect();
    this.header.updateConnectionStatus();
    new Notice(t('refreshModels', this.plugin.settings.language));
  }

  private async loadConversation(): Promise<void> {
    if (this.tabManager.getTabCount() === 0) {
      this.tabManager.createTab('Chat', this.plugin.openCodeService.getActiveModel(), this.currentMode);
      this.tabBar.render();
    }
    this.messageList.clear();
    this.messageList.addWelcomeMessage();
  }

  private async sendMessage(text: string, attachments: ImageAttachment[], tools?: QuickToolSelection[]): Promise<void> {
    const activeTabId = this.tabManager.getActiveTabId();
    if (!activeTabId || this.streamingTabs.has(activeTabId)) return;
    console.log('[Opensidian] sendMessage called, text:', text.substring(0, 50));
    
    const lang = this.plugin.settings.language;
    
    if (this.messages.length >= 20) {
      const warningMsg = lang === 'zh'
        ? `当前对话历史已超�?20 条消息。长对话历史可能导致响应超时或失败。是否继续？`
        : `Current conversation has exceeded 20 messages. Long history may cause timeouts. Continue?`;
      
      if (!confirm(warningMsg)) return;
    }

    let messageContent = text;
    let displayContent = text;
    if (attachments.length > 0) {
      const attachmentList = attachments
        .map(att => `- ${att.fileName || 'file'}`)
        .join('\n');
      
      messageContent = lang === 'zh'
        ? `用户上传了以下附件：\n${attachmentList}\n\n用户的问题：\n${text}`
        : `User uploaded attachments:\n${attachmentList}\n\nUser's question:\n${text}`;
      displayContent = messageContent;
    }

    if (tools && tools.length > 0) {
      const mcpTools = tools.filter(t => t.type === 'mcp').map(t => t.name);
      const skillTools = tools.filter(t => t.type === 'skill').map(t => t.name);
      const toolHint = lang === 'zh'
        ? `\n\n[已选择工具]\n${mcpTools.length ? `MCP: ${mcpTools.join(', ')}\n` : ''}${skillTools.length ? `Skills: ${skillTools.join(', ')}` : ''}\n请优先使用这些工具。`
        : `\n\n[Selected tools]\n${mcpTools.length ? `MCP: ${mcpTools.join(', ')}\n` : ''}${skillTools.length ? `Skills: ${skillTools.join(', ')}` : ''}\nPlease prioritize using these tools.`;
      messageContent += toolHint;
    }

    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: messageContent,
      displayContent,
      timestamp: Date.now(),
      images: attachments.length > 0 ? attachments : undefined,
      toolSummary: tools && tools.length > 0 ? {
        mcp: tools.filter(t => t.type === 'mcp').map(t => t.name),
        skills: tools.filter(t => t.type === 'skill').map(t => t.name)
      } : undefined
    };

    this.messages.push(userMessage);
    this.messageList.addMessage(userMessage);

    this.streamingTabs.add(activeTabId);
    this.inputArea.setStreaming(true);
    this.header.setStreaming(true);

    const context = await this.prepareContext(text);
    const assistantMsgId = this.generateId();
    const assistantContainer = this.messageList.createStreamingMessage(assistantMsgId);
    const streamController = new StreamController(assistantContainer, this.plugin, () => this.messageList.scrollToBottom());

    const pendingMsg: ChatMessage = {
      id: assistantMsgId, role: 'assistant', content: '', timestamp: Date.now(),
    };
    this.messages.push(pendingMsg);

    let fullContent = '';
    let thinkingContent = '';
    let lastChunkType = '';

    try {
      let autoTurnCount = 0;
      const MAX_AUTO_TURNS = 3;
      let currentPrompt = messageContent;
      let currentHistory = this.messages.slice(0, -1);

      while (autoTurnCount <= MAX_AUTO_TURNS) {
        if (autoTurnCount > 0) {
          currentPrompt = lang === 'zh' ? '继续' : 'Continue';
          currentHistory = this.messages.slice(0, -1);
        }

        const systemPrompt = this.buildSystemPrompt(context, tools);
        const stream = this.plugin.openCodeService.query(currentPrompt, {
          conversationHistory: currentHistory, systemPrompt, stream: true,
          thinking: this.plugin.settings.showThinking,
          attachments: autoTurnCount === 0 && attachments.length > 0 ? attachments : undefined,
          sessionId: this.tabManager.getActiveTab()?.sessionId
        });

        lastChunkType = '';
        for await (const chunk of stream) {
          lastChunkType = chunk.type;
          await streamController.handleChunk(chunk);
          if (lastChunkType === 'error') break;
        }

        if (lastChunkType === 'error') break;
        if (lastChunkType !== 'tool_call' && lastChunkType !== 'tool_result') break;
        autoTurnCount++;
      }

      fullContent = streamController.getFullText();
      thinkingContent = streamController.getFullThinking();
      pendingMsg.content = fullContent;
      pendingMsg.thinking = thinkingContent || undefined;

      const assistantMessage: ChatMessage = {
        id: assistantMsgId, role: 'assistant',
        content: fullContent, timestamp: Date.now(),
        thinking: thinkingContent || undefined
      };
      this.messages.push(assistantMessage);
      
      const activeTab = this.tabManager.getActiveTab();
      if (activeTab && activeTab.title === 'New Chat' && fullContent) {
        this.tabManager.updateTab(activeTab.id, { title: fullContent.substring(0, 30) });
        this.tabBar.refresh();
      }
      
      await this.saveConversation();
    } catch (error) {
      console.error('Error sending message:', error);
      this.messageList.showErrorMessage(assistantContainer, t('connectionError', lang));
    } finally {
      const tid = this.tabManager.getActiveTabId();
      if (tid) this.streamingTabs.delete(tid);
      this.inputArea.setStreaming(false);
      this.header.setStreaming(false);
      this.inputArea.focus();
    }
  }

  private stopGeneration(): void {
    this.plugin.openCodeService.stopGeneration();
    const tid = this.tabManager.getActiveTabId();
    if (tid) this.streamingTabs.delete(tid);
    this.inputArea.setStreaming(false);
    this.header.setStreaming(false);
    this.inputArea.focus();
    new Notice(t('requestCancelled', this.plugin.settings.language));
  }

  private async appendMessage(text: string, attachments: ImageAttachment[], tools?: QuickToolSelection[]): Promise<void> {
    if (!this.isStreaming) return;
    
    const lang = this.plugin.settings.language;
    let messageContent = text;
    let displayContent = text;
    
    if (attachments.length > 0) {
      const attachmentList = attachments
        .map(att => `- ${att.fileName || 'file'}`)
        .join('\n');
      
      messageContent = lang === 'zh'
        ? `用户上传了以下附件：\n${attachmentList}\n\n用户的问题：\n${text}`
        : `User uploaded attachments:\n${attachmentList}\n\nUser's question:\n${text}`;
      displayContent = messageContent;
    }
    
    const userMessage: ChatMessage = {
      id: this.generateId(),
      role: 'user',
      content: messageContent,
      displayContent,
      timestamp: Date.now(),
      images: attachments.length > 0 ? attachments : undefined,
      toolSummary: tools && tools.length > 0 ? {
        mcp: tools.filter(t => t.type === 'mcp').map(t => t.name),
        skills: tools.filter(t => t.type === 'skill').map(t => t.name)
      } : undefined
    };
    
    this.messages.push(userMessage);
    this.messageList.addMessage(userMessage);
    
    const context = await this.prepareContext(text);
    const conversationHistory = this.messages.slice(0, -1);
    const systemPrompt = this.buildSystemPrompt(context, tools);
    
    try {
      const stream = this.plugin.openCodeService.query(messageContent, {
        conversationHistory,
        systemPrompt,
        stream: true,
        thinking: this.plugin.settings.showThinking,
        attachments: attachments.length > 0 ? attachments : undefined,
        sessionId: this.tabManager.getActiveTab()?.sessionId
      });
      
      const assistantContainer = this.messageList.createStreamingMessage(this.generateId());
      let fullContent = '';
      let thinkingContent = '';

      const streamBuffer = new StreamBuffer((content, thinking) => {
        if (content) fullContent += content;
        if (thinking) thinkingContent += thinking;
        this.messageList.updateStreamingMessage(assistantContainer, fullContent, thinkingContent, false);
        this.messageList.updateThinking(assistantContainer, thinkingContent);
      }, { flushInterval: 120, maxBufferSize: 2000 });
      
      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.content) {
          streamBuffer.appendText(chunk.content);
        } else if (chunk.type === 'thinking' && chunk.content) {
          streamBuffer.appendThinking(chunk.content);
        } else if (chunk.type === 'tool_call' && chunk.toolCall) {
          streamBuffer.flush(true);
          this.messageList.addToolCall(assistantContainer, chunk.toolCall);
        } else if (chunk.type === 'tool_result' && chunk.toolCall) {
          this.messageList.updateToolResult(assistantContainer, chunk.toolCall);
        } else if (chunk.type === 'error') {
          this.messageList.showErrorMessage(assistantContainer, chunk.error || t('error', lang));
          break;
        } else if (chunk.type === 'done') {
          streamBuffer.flush(true);
          break;
        }
      }

      streamBuffer.flush(true);
      this.messageList.updateStreamingMessage(assistantContainer, fullContent, thinkingContent, true);
      
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
        thinking: thinkingContent || undefined
      };
      
      this.messages.push(assistantMessage);
      await this.saveConversation();
    } catch (error) {
      console.error('Error appending message:', error);
    }
  }

  private async prepareContext(input: string): Promise<any> {
    const context: any = {
      files: [],
      activeFile: null,
      mode: this.currentMode,
      vaultPath: this.plugin.getVaultPath()
    };

    const mentions = input.match(/@(\S+)/g) || [];
    for (const mention of mentions) {
      const fileName = mention.slice(1);
      const file = this.plugin.app.metadataCache.getFirstLinkpathDest(fileName, '');
      if (file) {
        let content = await this.plugin.getFileContent(file);
        if (content.length > 4000) {
          content = content.substring(0, 4000) + '\n\n... (truncated)';
        }
        const fullPath = this.plugin.getVaultPath() 
          ? `${this.plugin.getVaultPath()}/${file.path}` 
          : file.path;
        context.files.push({ path: file.path, fullPath, content });
      }
    }

    const activeFile = this.plugin.getActiveFile();
    if (activeFile && !context.files.find((f: any) => f.path === activeFile.path)) {
      let content = await this.plugin.getFileContent(activeFile);
      if (content.length > 4000) {
        content = content.substring(0, 4000) + '\n\n... (truncated)';
      }
      const fullPath = this.plugin.getVaultPath() 
        ? `${this.plugin.getVaultPath()}/${activeFile.path}` 
        : activeFile.path;
      context.activeFile = { path: activeFile.path, fullPath, content };
    }

    return context;
  }

  private buildSystemPrompt(context: any, tools?: QuickToolSelection[]): string {
    const lang = this.plugin.settings.language;
    let prompt = lang === 'zh'
      ? '你是一个帮助管理 Obsidian 笔记库的 AI 助手。你可以访问笔记库内容，读取、写入和编辑笔记。请提供有帮助、简洁且准确的回答。\n\n'
      : 'You are an AI assistant helping with an Obsidian vault. You have access to vault contents and can read, write, and edit notes. Be helpful, concise, and accurate.\n\n';

    if (context.mode === 'plan') {
      prompt += lang === 'zh'
        ? '【计划模式】你只能提供建议和方案，不能直接执行任何操作。\n\n'
        : '[PLAN MODE] You can only provide suggestions and plans, cannot execute actions.\n\n';
    }

    if (context.vaultPath) {
      prompt += lang === 'zh' 
        ? `笔记库路径：${context.vaultPath}\n\n` 
        : `Vault path: ${context.vaultPath}\n\n`;
    }

    if (context.files.length > 0) {
      prompt += lang === 'zh' ? '引用的文件：\n' : 'Referenced files:\n';
      for (const file of context.files) {
        prompt += `File: ${file.path}\nContent:\n${file.content}\n\n`;
      }
    }

    if (context.activeFile) {
      prompt += lang === 'zh' 
        ? `当前文件：${context.activeFile.path}\n` 
        : `Active file: ${context.activeFile.path}\n`;
    }

    if (tools && tools.length > 0) {
      const mcpTools = tools.filter(t => t.type === 'mcp').map(t => t.name);
      const skillTools = tools.filter(t => t.type === 'skill').map(t => t.name);
      if (lang === 'zh') {
        prompt += `\n用户已选择工具，请优先使用这些工具来完成任务。\n`;
        if (mcpTools.length > 0) {
          prompt += `MCP：${mcpTools.join(', ')}\n`;
        }
        if (skillTools.length > 0) {
          prompt += `Skills：${skillTools.join(', ')}\n`;
        }
        prompt += `如果任务适合调用技能，请主动调用已选择的 skill。\n\n`;
      } else {
        prompt += `\nUser selected tools. Prefer using these tools to complete the task.\n`;
        if (mcpTools.length > 0) {
          prompt += `MCP: ${mcpTools.join(', ')}\n`;
        }
        if (skillTools.length > 0) {
          prompt += `Skills: ${skillTools.join(', ')}\n`;
        }
        prompt += `If a task fits a skill, proactively call the selected skill.\n\n`;
      }
    }

    if (this.plugin.settings.customSystemPrompt) {
      prompt += `\n${this.plugin.settings.customSystemPrompt}`;
    }

    return prompt;
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
    await this.sidebar.refresh();
  }

  private async loadSession(sessionId: string): Promise<void> {
    const session = await this.plugin.storage.loadSession(sessionId);
    if (!session) return;

    this.currentConversationId = sessionId;
    this.messages = session.messages || [];
    this.currentMode = session.mode || this.plugin.settings.agentMode;
    
    this.header.setMode(this.currentMode);
    this.messageList.setMessages(this.messages);
  }

  private startNewConversation(): void {
    this.currentConversationId = null;
    this.messages = [];
    this.messageList.clear();
    this.messageList.addWelcomeMessage();
    this.inputArea.focus();
  }

  private async deleteSessions(sessionIds: string[]): Promise<void> {
    for (const id of sessionIds) {
      await this.plugin.storage.deleteSession(id);
      if (id === this.currentConversationId) {
        this.startNewConversation();
      }
    }
    await this.sidebar.refresh();
  }

  private async refreshView(): Promise<void> {
    if (this.isStreaming) return;
    const savedMessages = [...this.messages];
    const savedConversationId = this.currentConversationId;

    this.container.empty();
    this.createSidebar();
    
    const mainContent = this.container.createDiv({ cls: 'opensidian-main-content' });
    this.headerContainer = mainContent.createDiv();
    this.createHeader();
    
    const tabBarContainer = mainContent.createDiv({ cls: 'opensidian-tab-bar-container' });
    this.createTabBar(tabBarContainer);
    
    this.messagesContainer = mainContent.createDiv({ cls: 'opensidian-messages' });
    this.createMessageList();
    
    this.inputContainer = mainContent.createDiv({ cls: 'opensidian-input-area' });
    this.createInputArea();
    
    this.currentConversationId = savedConversationId;
    this.messages = savedMessages;
    if (this.messages.length === 0) {
      this.messageList.addWelcomeMessage();
    } else {
      this.messageList.setMessages(this.messages);
    }
  }

  private registerEvents(): void {
    this.registerEvent(
      (this.app.workspace as any).on('opensidian:new-conversation', () => {
        this.startNewConversation();
      })
    );

    this.registerEvent(
      (this.app.workspace as any).on('opensidian:active-file-change', (_file: TFile) => {})
    );

    document.addEventListener('opensidian:welcome-prompt', ((e: CustomEvent) => {
      this.inputArea.setText(e.detail);
      this.inputArea.focus();
    }) as EventListener);

    document.addEventListener('opensidian:daily-send', ((e: CustomEvent) => {
      this.sendMessage(e.detail, [], []);
    }) as EventListener);
  }

  private openSettings(): void {
    // @ts-expect-error - Obsidian API internal method
    this.app.setting.open();
    // @ts-expect-error - Obsidian API internal method
    this.app.setting.openTabById('opensidian');
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 重连 OpenCode CLI
   */
  private async reconnect(): Promise<void> {
    const lang = this.plugin.settings.language;
    new Notice(lang === 'zh' ? '正在重连...' : 'Reconnecting...');
    
    try {
      // 重置并重新初始化 OpenCode 服务
      this.plugin.openCodeService.reset();
      await this.plugin.openCodeService.initialize();
      
      // 更新连接状态和模型列表
      this.header.updateConnectionStatus();
      this.header.populateModelSelect();
      
      new Notice(lang === 'zh' ? '重连成功！' : 'Reconnected!');
    } catch (error) {
      console.error('Reconnect failed:', error);
      new Notice(lang === 'zh' ? `重连失败: ${error}` : `Reconnect failed: ${error}`);
    }
  }
}
