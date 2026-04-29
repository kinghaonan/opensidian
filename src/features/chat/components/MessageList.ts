import { MarkdownRenderer, Component, TFile, Notice } from 'obsidian';
import OpensidianPlugin from '../../../main';
import { ChatMessage, ImageAttachment } from '../../../core/types/chat';
import { t, Language } from '../../../i18n';

interface StreamingRefs {
  contentEl: HTMLElement;
  thinkingEl: HTMLElement;
  thinkingContentEl: HTMLElement;
}

export class MessageList {
  private container: HTMLElement;
  private plugin: OpensidianPlugin;
  private component: Component;
  private messages: ChatMessage[] = [];
  private thinkingElements: Map<string, HTMLElement> = new Map();
  private thinkingTimers: Map<string, { startTime: number; interval: ReturnType<typeof setInterval> }> = new Map();
  private streamingRefs: Map<HTMLElement, StreamingRefs> = new Map();
  private onFileClick?: (file: TFile) => void;
  private scrollRafId: number | null = null;

  constructor(container: HTMLElement, plugin: OpensidianPlugin) {
    this.container = container;
    this.plugin = plugin;
    this.component = new Component();
  }

  setOnFileClick(callback: (file: TFile) => void): void {
    this.onFileClick = callback;
  }

  load(): void {
    this.component.load();
  }

  unload(): void {
    this.component.unload();
  }

  clear(): void {
    this.messages = [];
    this.thinkingElements.clear();
    this.streamingRefs.clear();
    this.container.empty();
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  setMessages(messages: ChatMessage[]): void {
    this.messages = messages;
    this.renderAll();
  }

  addMessage(message: ChatMessage): void {
    this.messages.push(message);
    this.renderMessage(message);
    this.scrollToBottom();
  }

  private renderAll(): void {
    this.container.empty();
    for (const message of this.messages) {
      this.renderMessage(message);
    }
    this.scrollToBottom();
  }

  private renderMessage(message: ChatMessage): void {
    const lang = this.plugin.settings.language as Language;

    if (message.role === 'user') {
      this.renderUserMessage(message, lang);
    } else if (message.role === 'assistant') {
      this.renderAssistantMessage(message, lang);
    }
  }

  private renderUserMessage(message: ChatMessage, lang: Language): void {
    const msgEl = this.container.createDiv({ 
      cls: 'opensidian-message opensidian-user',
      attr: { 'data-message-id': message.id }
    });

    const avatar = msgEl.createDiv({ cls: 'opensidian-avatar' });
    avatar.innerHTML = '👤';
    avatar.title = lang === 'zh' ? '用户' : 'User';

    const contentContainer = msgEl.createDiv({ cls: 'opensidian-message-container' });
    const contentEl = contentContainer.createDiv({ cls: 'opensidian-message-content' });
    contentEl.textContent = message.displayContent || message.content;

    if (message.toolSummary && ((message.toolSummary.mcp?.length || 0) > 0 || (message.toolSummary.skills?.length || 0) > 0)) {
      const summaryEl = contentContainer.createDiv({ cls: 'opensidian-message-tools' });
      const summaryTitle = lang === 'zh' ? '本次工具' : 'Tools for this message';
      summaryEl.createSpan({ cls: 'opensidian-message-tools-title', text: summaryTitle });
      if (message.toolSummary.mcp && message.toolSummary.mcp.length > 0) {
        summaryEl.createSpan({ cls: 'opensidian-message-tools-item', text: `MCP: ${message.toolSummary.mcp.join(', ')}` });
      }
      if (message.toolSummary.skills && message.toolSummary.skills.length > 0) {
        summaryEl.createSpan({ cls: 'opensidian-message-tools-item', text: `Skills: ${message.toolSummary.skills.join(', ')}` });
      }
    }

    this.renderCopyButton(contentContainer, message.content, lang);

    if (message.images && message.images.length > 0) {
      this.renderAttachments(contentEl, message.images);
    }

    const time = msgEl.createDiv({ cls: 'opensidian-message-time' });
    time.textContent = this.formatTime(message.timestamp);
  }

  private renderAssistantMessage(message: ChatMessage, lang: Language): void {
    const msgEl = this.container.createDiv({ 
      cls: 'opensidian-message opensidian-assistant',
      attr: { 'data-message-id': message.id }
    });

    const avatar = msgEl.createDiv({ cls: 'opensidian-avatar' });
    avatar.innerHTML = '🤖';
    avatar.title = lang === 'zh' ? 'AI 助手' : 'AI Assistant';

    const contentContainer = msgEl.createDiv({ cls: 'opensidian-message-container' });

    if (message.thinking) {
      this.renderThinkingSection(contentContainer, message.id, message.thinking, lang);
    }

    const contentEl = contentContainer.createDiv({ cls: 'opensidian-message-content' });
    
    if (message.error) {
      contentEl.addClass('opensidian-error');
      contentEl.textContent = `${t('error', lang)}: ${message.error}`;
    } else {
      this.renderMarkdown(contentEl, message.content);
    }

    const actionsEl = contentContainer.createDiv({ cls: 'opensidian-message-actions' });
    this.renderActionButton(actionsEl, '📋', t('copy', lang), () => {
      navigator.clipboard.writeText(message.content);
      new Notice(t('copied', lang));
    });
  }

  private renderThinkingSection(container: HTMLElement, id: string, thinking: string, lang: Language): void {
    const thinkingEl = container.createDiv({ 
      cls: `opensidian-thinking ${this.plugin.settings.thinkingCollapsed ? 'collapsed' : ''}`,
    });
    
    const header = thinkingEl.createDiv({ cls: 'opensidian-thinking-header' });
    header.innerHTML = `🤔 ${t('thinkingProcess', lang)}`;
    
    const content = thinkingEl.createDiv({ cls: 'opensidian-thinking-content' });
    content.textContent = thinking;

    header.onclick = () => {
      thinkingEl.toggleClass('collapsed', !thinkingEl.hasClass('collapsed'));
    };

    this.thinkingElements.set(id, content);
  }

  private renderAttachments(container: HTMLElement, images: ImageAttachment[]): void {
    const attachmentsEl = container.createDiv({ cls: 'opensidian-attachments-preview' });
    for (const img of images) {
      if (img.mimeType.startsWith('image/')) {
        attachmentsEl.createEl('img', {
          cls: 'opensidian-attachment',
          attr: { src: `data:${img.mimeType};base64,${img.base64Data}` }
        });
      } else {
        attachmentsEl.createEl('div', {
          cls: 'opensidian-attachment-file',
          text: '📄 ' + (img.fileName || 'file')
        });
      }
    }
  }

  private renderCopyButton(container: HTMLElement, content: string, lang: Language): void {
    const copyBtn = container.createEl('button', {
      cls: 'opensidian-copy-btn',
      attr: { 'aria-label': t('copy', lang) }
    });
    copyBtn.innerHTML = '📋';
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(content).then(() => {
        new Notice(t('copied', lang));
      });
    };
  }

  private renderActionButton(container: HTMLElement, icon: string, label: string, onClick: () => void): void {
    const btn = container.createEl('button', { 
      cls: 'opensidian-action-btn',
      attr: { 'aria-label': label }
    });
    btn.innerHTML = icon;
    btn.onclick = onClick;
  }

  createStreamingMessage(id: string): HTMLElement {
    const lang = this.plugin.settings.language as Language;

    const msgEl = this.container.createDiv({ 
      cls: 'opensidian-message opensidian-assistant opensidian-streaming',
      attr: { 'data-message-id': id }
    });

    const avatar = msgEl.createDiv({ cls: 'opensidian-avatar' });
    avatar.innerHTML = '🤖';

    const contentContainer = msgEl.createDiv({ cls: 'opensidian-message-container' });

    const thinkingEl = contentContainer.createDiv({ 
      cls: `opensidian-thinking ${this.plugin.settings.thinkingCollapsed ? 'collapsed' : ''}`,
      attr: { style: 'display: none;' }
    });
    const thinkingHeader = thinkingEl.createDiv({ cls: 'opensidian-thinking-header' });
    const timerSpan = thinkingHeader.createSpan({ cls: 'opensidian-thinking-timer' });
    const labelSpan = thinkingHeader.createSpan();
    labelSpan.textContent = `🤔 ${t('thinkingProcess', lang)} `;
    thinkingHeader.appendChild(timerSpan);
    const thinkingContent = thinkingEl.createDiv({ cls: 'opensidian-thinking-content' });
    thinkingHeader.onclick = () => thinkingEl.toggleClass('collapsed', !thinkingEl.hasClass('collapsed'));
    this.thinkingElements.set(id, thinkingContent);
    this.thinkingTimers.set(id, { startTime: Date.now(), interval: setInterval(() => {
      const elapsed = ((Date.now() - this.thinkingTimers.get(id)!.startTime) / 1000).toFixed(1);
      timerSpan.textContent = `${elapsed}s`;
    }, 100) });

    const contentEl = contentContainer.createDiv({ cls: 'opensidian-message-content opensidian-streaming' });
    contentEl.textContent = t('generating', lang);

    this.streamingRefs.set(contentContainer, { contentEl, thinkingEl, thinkingContentEl: thinkingContent });
    this.scrollToBottom();
    return contentContainer;
  }

  updateStreamingMessage(container: HTMLElement, content: string, thinking?: string, finalize = false): void {
    const refs = this.streamingRefs.get(container);
    const contentEl = refs?.contentEl ?? container.querySelector('.opensidian-message-content') as HTMLElement | null;
    if (contentEl) {
      if (finalize) {
        contentEl.removeClass('opensidian-streaming');
        this.renderMarkdown(contentEl, content);
        this.stopThinkingTimers(container);
      } else {
        contentEl.addClass('opensidian-streaming');
        contentEl.textContent = content;
      }
    }

    if (thinking && this.plugin.settings.showThinking) {
      const thinkingEl = refs?.thinkingEl ?? container.querySelector('.opensidian-thinking') as HTMLElement;
      if (thinkingEl) thinkingEl.style.display = 'block';
    }

    this.scrollToBottom();
  }

  updateThinking(container: HTMLElement, thinking: string): void {
    const refs = this.streamingRefs.get(container);
    const thinkingContentEl = refs?.thinkingContentEl ?? container.querySelector('.opensidian-thinking-content');
    if (thinkingContentEl) thinkingContentEl.textContent = thinking;

    const thinkingEl = refs?.thinkingEl ?? container.querySelector('.opensidian-thinking') as HTMLElement;
    if (thinkingEl && this.plugin.settings.showThinking) thinkingEl.style.display = 'block';
  }

  private stopThinkingTimers(container: HTMLElement): void {
    const refs = this.streamingRefs.get(container);
    if (!refs) return;
    const msgEl = (refs.contentEl.closest('[data-message-id]') as HTMLElement);
    if (!msgEl) return;
    const id = msgEl.getAttribute('data-message-id') || '';
    const timer = this.thinkingTimers.get(id);
    if (timer) { clearInterval(timer.interval); this.thinkingTimers.delete(id); }
  }

  showErrorMessage(container: HTMLElement, error: string): void {
    const lang = this.plugin.settings.language as Language;
    const refs = this.streamingRefs.get(container);
    const contentEl = refs?.contentEl ?? container.querySelector('.opensidian-message-content');
    this.streamingRefs.delete(container);
    
    const errorStr = typeof error === 'string' ? error : JSON.stringify(error);
    
    if (contentEl) {
      contentEl.removeClass('opensidian-streaming');
      contentEl.addClass('opensidian-error');
      
      let userError = errorStr;
      if (errorStr.includes('timeout') || errorStr.includes('terminated') || errorStr.includes('SIGTERM')) {
        userError = lang === 'zh' 
          ? '请求超时。对话历史可能过长，建议开始新对话。' 
          : 'Request timeout. Conversation history may be too long.';
      }
      contentEl.textContent = `${t('error', lang)}: ${userError}`;
    }
  }

  private async renderMarkdown(container: HTMLElement, content: string): Promise<void> {
    container.empty();
    await MarkdownRenderer.render(
      this.plugin.app,
      content,
      container,
      '',
      this.component
    );
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString(
      this.plugin.settings.language === 'zh' ? 'zh-CN' : 'en-US'
    );
  }

  scrollToBottom(): void {
    if (!this.plugin.settings.enableAutoScroll) return;
    if (this.scrollRafId !== null) return;
    this.scrollRafId = requestAnimationFrame(() => {
      this.scrollRafId = null;
      this.container.scrollTop = this.container.scrollHeight;
    });
  }

  addWelcomeMessage(): void {
    const lang = this.plugin.settings.language as Language;
    const welcome = this.container.createDiv({ cls: 'opensidian-message opensidian-welcome' });

    const icon = welcome.createDiv({ cls: 'opensidian-welcome-icon' });
    icon.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z"/><path d="M8 9h8"/><path d="M8 13h5"/></svg>`;

    const title = welcome.createEl('h2');
    title.textContent = lang === 'zh' ? '有什么我可以帮助你的？' : 'How can I help you?';

    const desc = welcome.createEl('p');
    desc.textContent = lang === 'zh'
      ? '我可以读取和编辑你的笔记，搜索知识库，帮你整理思路。'
      : 'I can read and edit your notes, search your vault, and help organize your thoughts.';

    const cards = welcome.createDiv({ cls: 'opensidian-welcome-cards' });

    const suggestions = lang === 'zh' ? [
      { icon: '📝', title: '整理笔记', desc: '帮我整理今天的笔记' },
      { icon: '🔍', title: '搜索知识', desc: '搜索关于项目的所有笔记' },
      { icon: '✏️', title: '创作内容', desc: '根据最近笔记写一篇总结' },
      { icon: '💡', title: '头脑风暴', desc: '帮我理清思路和想法' },
    ] : [
      { icon: '📝', title: 'Organize Notes', desc: 'Help me organize today\'s notes' },
      { icon: '🔍', title: 'Search Knowledge', desc: 'Search all notes about the project' },
      { icon: '✏️', title: 'Create Content', desc: 'Write a summary from recent notes' },
      { icon: '💡', title: 'Brainstorm', desc: 'Help me clarify my thoughts' },
    ];

    for (const s of suggestions) {
      const card = cards.createDiv({ cls: 'opensidian-welcome-card' });
      const cardIcon = card.createDiv({ cls: 'opensidian-welcome-card-icon' });
      cardIcon.textContent = s.icon;
      const cardTitle = card.createDiv({ cls: 'opensidian-welcome-card-title' });
      cardTitle.textContent = s.title;
      const cardDesc = card.createDiv();
      cardDesc.textContent = s.desc;
      card.onclick = () => document.dispatchEvent(new CustomEvent('opensidian:welcome-prompt', { detail: s.desc }));
    }

    const dailyPrompts = this.plugin.settings.dailyPrompts || [];
    if (dailyPrompts.length > 0) {
      const dailySection = welcome.createDiv({ cls: 'opensidian-welcome-daily' });
      dailySection.createDiv({ cls: 'opensidian-welcome-daily-title', text: lang === 'zh' ? '📅 每日任务' : '📅 Daily' });
      const dailyCards = welcome.createDiv({ cls: 'opensidian-welcome-cards' });
      for (const dp of dailyPrompts) {
        const label = (dp.prompt || '').substring(0, 40) + ((dp.prompt || '').length > 40 ? '…' : '');
        const skillTag = dp.skill ? ` ⚡/${dp.skill}` : '';
        const pathTag = dp.folder ? ` 📁${dp.folder}${dp.fileName ? '/' + dp.fileName : ''}` : '';
        const card = dailyCards.createDiv({ cls: 'opensidian-welcome-card opensidian-welcome-card-daily' });
        card.createDiv({ cls: 'opensidian-welcome-card-title', text: label + skillTag });
        if (pathTag) card.createDiv({ style: 'font-size:10px;color:var(--os-text-muted);margin-top:2px;', text: pathTag });
        card.onclick = () => {
          let fullPrompt = dp.prompt || '';
          if (dp.skill) fullPrompt = `/${dp.skill} ` + fullPrompt;
          if (dp.folder) {
            const vaultPath = (this.plugin.app.vault.adapter as any).basePath || '';
            const filePath = dp.fileName ? `${dp.folder}/${dp.fileName}` : dp.folder;
            fullPrompt = `在 ${filePath} ${dp.fileName ? '创建/更新' : '整理'}笔记。` + fullPrompt;
          }
          document.dispatchEvent(new CustomEvent('opensidian:daily-send', { detail: fullPrompt }));
        };
      }
    }

    const hint = welcome.createDiv({ cls: 'opensidian-welcome-hint' });
    hint.textContent = lang === 'zh'
      ? `当前模式：${this.plugin.settings.agentMode === 'plan' ? '计划' : '构建'} · 输入 @ 引用文件 · 输入 / 使用命令`
      : `Mode: ${this.plugin.settings.agentMode} · Type @ to reference files · Type / for commands`;
  }

  addModeIndicator(mode: 'plan' | 'build'): void {
    const lang = this.plugin.settings.language as Language;
    const indicator = this.container.createDiv({ cls: 'opensidian-mode-indicator' });
    indicator.textContent = mode === 'plan'
      ? (lang === 'zh' ? '🔄 已切换到计划模式' : '🔄 Switched to Plan Mode')
      : (lang === 'zh' ? '🔄 已切换到构建模式' : '🔄 Switched to Build Mode');
    this.scrollToBottom();
  }

  addToolCall(container: HTMLElement, toolCall: any): void {
    const lang = this.plugin.settings.language as Language;
    const toolCallsEl = this.ensureToolCallsContainer(container, lang);
    const toolCallsList = toolCallsEl.querySelector('.opensidian-tool-calls-list') as HTMLElement;

    const toolType = this.classifyToolType(toolCall.name);
    const toolEl = toolCallsList.createDiv({
      cls: `opensidian-tool-call collapsed opensidian-tool-status-${toolCall.status === 'executing' ? 'running' : 'pending'}`,
      attr: { 'data-tool-id': toolCall.id }
    });

    const iconEl = toolEl.createDiv({ cls: `opensidian-tool-icon opensidian-tool-icon-${toolType}` });
    iconEl.innerHTML = this.getToolIconSvg(toolType);

    const bodyEl = toolEl.createDiv({ cls: 'opensidian-tool-body' });
    const header = bodyEl.createDiv({ cls: 'opensidian-tool-header' });

    const statusSpan = header.createSpan({ cls: 'opensidian-tool-status-icon' });
    statusSpan.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;

    const nameEl = header.createSpan({ cls: 'opensidian-tool-name' });
    nameEl.textContent = this.formatToolName(toolCall.name);

    this.renderToolTarget(header, toolCall);

    const chevron = header.createSpan({ cls: 'opensidian-tool-chevron' });
    chevron.innerHTML = '▶';

    const contentEl = toolEl.createDiv({ cls: 'opensidian-tool-content' });
    if (toolCall.arguments && Object.keys(toolCall.arguments).length > 0) {
      this.renderToolArgumentsV2(contentEl, toolCall);
    }

    header.onclick = (e) => {
      e.stopPropagation();
      const willBeCollapsed = !toolEl.hasClass('collapsed');
      toolEl.toggleClass('collapsed', willBeCollapsed);
      chevron.toggleClass('opensidian-tool-chevron-open', !willBeCollapsed);
      if (!willBeCollapsed) {
        window.setTimeout(() => toolEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50);
      }
    };

    this.updateToolCallsHeader(toolCallsEl, lang);
    this.scrollToBottom();
  }

  updateToolResult(container: HTMLElement, toolCall: any): void {
    const lang = this.plugin.settings.language as Language;
    const toolEl = container.querySelector(`[data-tool-id="${toolCall.id}"]`) as HTMLElement;
    if (!toolEl) { this.addToolCall(container, toolCall); return; }

    const isSuccess = toolCall.status === 'completed';
    const isFailed = toolCall.status === 'failed';
    toolEl.removeClass('opensidian-tool-status-pending', 'opensidian-tool-status-running');
    toolEl.addClass(isFailed ? 'opensidian-tool-status-error' : 'opensidian-tool-status-success');

    const statusIcon = toolEl.querySelector('.opensidian-tool-status-icon') as HTMLElement;
    if (statusIcon) {
      if (isSuccess) {
        statusIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/></svg>`;
      } else if (isFailed) {
        statusIcon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
      }
    }

    let contentEl = toolEl.querySelector('.opensidian-tool-content') as HTMLElement;
    if (!contentEl) { contentEl = toolEl.createDiv({ cls: 'opensidian-tool-content' }); }

    if (toolCall.result) {
      this.renderToolResultV2(contentEl, toolCall);
    }
    if (toolCall.error) {
      const errEl = contentEl.createDiv({ cls: 'opensidian-tool-error' });
      errEl.textContent = toolCall.error;
    }

    const chevron = toolEl.querySelector('.opensidian-tool-chevron');
    if (chevron) { chevron.innerHTML = '▶'; }

    this.scrollToBottom();
  }

  private classifyToolType(name: string): string {
    const n = name.toLowerCase();
    if (n.includes('read') || n.includes('get') || n.includes('open')) return 'read';
    if (n.includes('write') || n.includes('edit') || n.includes('update') || n.includes('create') || n.includes('save')) return 'edit';
    if (n.includes('run') || n.includes('exec') || n.includes('bash') || n.includes('shell') || n.includes('command')) return 'run';
    if (n.includes('delete') || n.includes('remove') || n.includes('trash')) return 'delete';
    if (n.includes('search') || n.includes('find') || n.includes('query') || n.includes('grep')) return 'search';
    return 'run';
  }

  private getToolIconSvg(type: string): string {
    const icons: Record<string, string> = {
      read: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
      edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
      run: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
      delete: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
      search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    };
    return icons[type] || icons.run;
  }

  private renderToolTarget(header: HTMLElement, toolCall: any): void {
    const path = toolCall.arguments?.path || toolCall.arguments?.file || toolCall.arguments?.target || '';
    if (path) {
      const fileEl = header.createSpan({ cls: 'opensidian-tool-file' });
      const codeEl = fileEl.createEl('code');
      codeEl.textContent = typeof path === 'string' ? path : JSON.stringify(path);
    }
    if (toolCall.arguments?.pattern || toolCall.arguments?.query) {
      const q = toolCall.arguments?.pattern || toolCall.arguments?.query;
      const fileEl = header.createSpan({ cls: 'opensidian-tool-file' });
      fileEl.textContent = typeof q === 'string' ? q : JSON.stringify(q);
    }
  }

  private renderToolArgumentsV2(container: HTMLElement, toolCall: any): void {
    const args = toolCall.arguments || {};
    if (toolCall.name === 'file_change' || toolCall.name === 'write_note' || toolCall.name === 'read_note') {
      if (args.path) {
        const div = container.createDiv({ cls: 'opensidian-tool-diff-header' });
        div.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ${args.path}`;
        container.createDiv({ cls: 'opensidian-tool-arguments' }).textContent = JSON.stringify(args, null, 2);
      }
    } else {
      const argsEl = container.createDiv({ cls: 'opensidian-tool-arguments' });
      for (const [key, value] of Object.entries(args)) {
        const line = argsEl.createDiv();
        line.innerHTML = `<span class="opensidian-tool-arg-label">${key}:</span> ${typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}`;
      }
    }
  }

  private renderToolResultV2(container: HTMLElement, toolCall: any): void {
    if (toolCall.name === 'file_change') {
      if (toolCall.result?.diff) {
        const header = container.createDiv({ cls: 'opensidian-tool-diff-header' });
        header.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Diff`;
        const linesEl = container.createDiv({ cls: 'opensidian-tool-diff-lines' });
        const diffText = toolCall.result.diff;
        if (typeof diffText === 'string') {
          diffText.split('\n').forEach(line => {
            const l = linesEl.createDiv({ cls: 'opensidian-tool-diff-line' });
            if (line.startsWith('+')) { l.addClass('opensidian-tool-diff-added'); l.textContent = line; }
            else if (line.startsWith('-')) { l.addClass('opensidian-tool-diff-removed'); l.textContent = line; }
            else { l.addClass('opensidian-tool-diff-context'); l.textContent = line; }
          });
        }
        return;
      }
      if (toolCall.result?.path) {
        const div = container.createDiv({ cls: 'opensidian-tool-arguments' });
        div.textContent = `File: ${toolCall.result.path}`;
        return;
      }
    }
    const resultEl = container.createDiv({ cls: 'opensidian-tool-result' });
    const str = typeof toolCall.result === 'object' ? JSON.stringify(toolCall.result, null, 2) : String(toolCall.result);
    if (str.length > 300) {
      const summary = str.substring(0, 300) + '...';
      resultEl.innerHTML = `<details><summary>Result</summary><pre>${str}</pre></details>`;
    } else {
      resultEl.textContent = str;
    }
  }

  private ensureToolCallsContainer(container: HTMLElement, lang: Language): HTMLElement {
    let toolCallsEl = container.querySelector('.opensidian-tool-calls') as HTMLElement | null;
    if (!toolCallsEl) {
      toolCallsEl = container.createDiv({ cls: 'opensidian-tool-calls' });
      toolCallsEl.dataset.collapsed = 'false';
      toolCallsEl.dataset.userToggled = 'false';
      const header = toolCallsEl.createDiv({ cls: 'opensidian-tool-calls-header' });
      header.createSpan({ cls: 'opensidian-tool-calls-title' });
      const toggleBtn = header.createEl('button', { cls: 'opensidian-tool-calls-toggle', text: lang === 'zh' ? '收起' : 'Collapse' });
      toggleBtn.onclick = () => {
        toolCallsEl!.dataset.userToggled = 'true';
        this.toggleToolCalls(toolCallsEl as HTMLElement, toolCallsEl!.dataset.collapsed !== 'true', lang);
      };
      toolCallsEl.createDiv({ cls: 'opensidian-tool-calls-list' });
    }
    this.updateToolCallsHeader(toolCallsEl, lang);
    return toolCallsEl;
  }

  private updateToolCallsHeader(toolCallsEl: HTMLElement, lang: Language): void {
    const listEl = toolCallsEl.querySelector('.opensidian-tool-calls-list') as HTMLElement | null;
    const titleEl = toolCallsEl.querySelector('.opensidian-tool-calls-title') as HTMLElement | null;
    const toggleBtn = toolCallsEl.querySelector('.opensidian-tool-calls-toggle') as HTMLButtonElement | null;
    const count = listEl ? listEl.children.length : 0;

    if (titleEl) {
      titleEl.textContent = lang === 'zh' ? `工具调用 (${count})` : `Tool calls (${count})`;
    }

    if (toolCallsEl.dataset.userToggled !== 'true' && count > 3) {
      this.toggleToolCalls(toolCallsEl, true, lang);
    }

    if (toggleBtn) {
      toggleBtn.textContent = toolCallsEl.dataset.collapsed === 'true'
        ? (lang === 'zh' ? '展开' : 'Expand')
        : (lang === 'zh' ? '收起' : 'Collapse');
    }
  }

  private toggleToolCalls(toolCallsEl: HTMLElement, collapse: boolean, lang: Language): void {
    toolCallsEl.dataset.collapsed = collapse ? 'true' : 'false';
    toolCallsEl.toggleClass('collapsed', collapse);
    const toggleBtn = toolCallsEl.querySelector('.opensidian-tool-calls-toggle') as HTMLButtonElement | null;
    if (toggleBtn) {
      toggleBtn.textContent = collapse ? (lang === 'zh' ? '展开' : 'Expand') : (lang === 'zh' ? '收起' : 'Collapse');
    }
  }

  /**
   * 格式化工具名称
   */
  private formatToolName(name: string): string {
    // 将下划线或连字符转换为空格，首字母大写
    return name
      .replace(/[_-]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  /**
   * 渲染工具参数
   */
  private renderToolArguments(container: HTMLElement, toolName: string, args: Record<string, any>): void {
    const lang = this.plugin.settings.language as Language;
    
    // 特殊处理文件修改工具
    if (toolName === 'file_change' || toolName === 'write_note' || toolName === 'read_note') {
      if (args.path) {
        const pathEl = container.createDiv({ cls: 'opensidian-tool-arg' });
        pathEl.innerHTML = `<span class="opensidian-tool-arg-label">${lang === 'zh' ? '文件' : 'File'}:</span> <code>${args.path}</code>`;
      }
      return;
    }
    
    // 通用参数显示
    for (const [key, value] of Object.entries(args)) {
      const argEl = container.createDiv({ cls: 'opensidian-tool-arg' });
      const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      const displayValue = valueStr.length > 100 ? valueStr.substring(0, 100) + '...' : valueStr;
      argEl.innerHTML = `<span class="opensidian-tool-arg-label">${key}:</span> <code>${displayValue}</code>`;
    }
  }

  /**
   * 渲染工具结果
   */
  private renderToolResult(container: HTMLElement, toolName: string, result: any): void {
    const lang = this.plugin.settings.language as Language;
    
    // 特殊处理文件修改结果
    if (toolName === 'file_change') {
      if (result.path) {
        const action = result.action || 'modified';
        const actionText = action === 'created' 
          ? (lang === 'zh' ? '创建' : 'Created')
          : action === 'deleted'
          ? (lang === 'zh' ? '删除' : 'Deleted')
          : (lang === 'zh' ? '修改' : 'Modified');
        container.innerHTML = `<span class="opensidian-tool-result-icon">📄</span> ${actionText}: <code>${result.path}</code>`;
      }
      return;
    }
    
    // 通用结果显示
    if (typeof result === 'object') {
      const resultStr = JSON.stringify(result, null, 2);
      if (resultStr.length > 200) {
        container.innerHTML = `<details><summary>${lang === 'zh' ? '查看结果' : 'View Result'}</summary><pre>${resultStr}</pre></details>`;
      } else {
        container.innerHTML = `<pre>${resultStr}</pre>`;
      }
    } else {
      container.textContent = String(result);
    }
  }
}
