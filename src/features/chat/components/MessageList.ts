import { MarkdownRenderer, Component, TFile, Notice } from 'obsidian';
import OpensidianPlugin from '../../../main';
import { ChatMessage, ImageAttachment } from '../../../core/types/chat';
import { t, Language } from '../../../i18n';

export class MessageList {
  private container: HTMLElement;
  private plugin: OpensidianPlugin;
  private component: Component;
  private messages: ChatMessage[] = [];
  private thinkingElements: Map<string, HTMLElement> = new Map();
  private onFileClick?: (file: TFile) => void;

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

    const contentContainer = msgEl.createDiv({ cls: 'opensidian-message-container' });
    const contentEl = contentContainer.createDiv({ cls: 'opensidian-message-content' });
    contentEl.textContent = message.content;

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
    thinkingHeader.innerHTML = `🤔 ${t('thinkingProcess', lang)}`;
    const thinkingContent = thinkingEl.createDiv({ cls: 'opensidian-thinking-content' });
    thinkingHeader.onclick = () => thinkingEl.toggleClass('collapsed', !thinkingEl.hasClass('collapsed'));
    this.thinkingElements.set(id, thinkingContent);

    const contentEl = contentContainer.createDiv({ cls: 'opensidian-message-content opensidian-streaming' });
    contentEl.textContent = t('generating', lang);

    const actionsEl = contentContainer.createDiv({ cls: 'opensidian-message-actions' });
    this.renderActionButton(actionsEl, '📋', t('copy', lang), () => {
      navigator.clipboard.writeText(contentEl.textContent || '');
      new Notice(t('copied', lang));
    });

    this.scrollToBottom();
    return contentContainer;
  }

  updateStreamingMessage(container: HTMLElement, content: string, thinking?: string): void {
    const contentEl = container.querySelector('.opensidian-message-content');
    if (contentEl) {
      contentEl.removeClass('opensidian-streaming');
      this.renderMarkdown(contentEl as HTMLElement, content);
    }

    if (thinking && this.plugin.settings.showThinking) {
      const thinkingEl = container.querySelector('.opensidian-thinking') as HTMLElement;
      if (thinkingEl) {
        thinkingEl.style.display = 'block';
      }
    }

    this.scrollToBottom();
  }

  updateThinking(container: HTMLElement, thinking: string): void {
    const thinkingContent = container.querySelector('.opensidian-thinking-content');
    if (thinkingContent) {
      thinkingContent.textContent = thinking;
    }

    const thinkingEl = container.querySelector('.opensidian-thinking') as HTMLElement;
    if (thinkingEl && this.plugin.settings.showThinking) {
      thinkingEl.style.display = 'block';
    }
  }

  showErrorMessage(container: HTMLElement, error: string): void {
    const lang = this.plugin.settings.language as Language;
    const contentEl = container.querySelector('.opensidian-message-content');
    if (contentEl) {
      contentEl.removeClass('opensidian-streaming');
      contentEl.addClass('opensidian-error');
      
      let userError = error;
      if (error.includes('timeout') || error.includes('terminated') || error.includes('SIGTERM')) {
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
    if (this.plugin.settings.enableAutoScroll) {
      this.container.scrollTop = this.container.scrollHeight;
    }
  }

  addWelcomeMessage(): void {
    const lang = this.plugin.settings.language as Language;
    const welcome = this.container.createDiv({ cls: 'opensidian-message opensidian-welcome' });

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
      <p>${lang === 'zh' ? '当前模式' : 'Current mode'}: <strong>${this.plugin.settings.agentMode === 'plan' ? t('planMode', lang) : t('buildMode', lang)}</strong></p>
    `;
  }

  addModeIndicator(mode: 'plan' | 'build'): void {
    const lang = this.plugin.settings.language as Language;
    const indicator = this.container.createDiv({ cls: 'opensidian-mode-indicator' });
    indicator.textContent = mode === 'plan'
      ? (lang === 'zh' ? '🔄 已切换到计划模式' : '🔄 Switched to Plan Mode')
      : (lang === 'zh' ? '🔄 已切换到构建模式' : '🔄 Switched to Build Mode');
    this.scrollToBottom();
  }

  /**
   * 添加工具调用显示（可折叠）
   */
  addToolCall(container: HTMLElement, toolCall: any): void {
    const lang = this.plugin.settings.language as Language;
    
    // 查找或创建工具调用容器
    let toolCallsEl = container.querySelector('.opensidian-tool-calls') as HTMLElement;
    if (!toolCallsEl) {
      toolCallsEl = container.createDiv({ cls: 'opensidian-tool-calls' });
    }
    
    // 创建单个工具调用元素（添加可折叠支持）
    const toolEl = toolCallsEl.createDiv({ 
      cls: 'opensidian-tool-call collapsed',  // 默认折叠
      attr: { 'data-tool-id': toolCall.id }
    });
    
    // 工具名称和状态（点击可展开/折叠）
    const header = toolEl.createDiv({ cls: 'opensidian-tool-header' });
    header.style.cursor = 'pointer';
    
    // 状态图标
    const statusIcon = header.createSpan({ cls: 'opensidian-tool-status' });
    if (toolCall.status === 'executing') {
      statusIcon.innerHTML = '⏳';
      statusIcon.title = lang === 'zh' ? '执行中...' : 'Executing...';
    } else {
      statusIcon.innerHTML = '🔧';
      statusIcon.title = lang === 'zh' ? '工具调用' : 'Tool Call';
    }
    
    // 工具名称
    const nameEl = header.createSpan({ cls: 'opensidian-tool-name' });
    nameEl.textContent = this.formatToolName(toolCall.name);
    
    // 展开/折叠指示器
    const toggleEl = header.createSpan({ cls: 'opensidian-tool-toggle' });
    toggleEl.innerHTML = '▶';
    toggleEl.style.marginLeft = 'auto';
    toggleEl.style.fontSize = '10px';
    toggleEl.style.transition = 'transform 0.2s';
    
    // 内容容器（参数和结果）
    const contentEl = toolEl.createDiv({ cls: 'opensidian-tool-content' });
    
    // 点击 header 切换折叠状态
    header.onclick = () => {
      toolEl.toggleClass('collapsed', !toolEl.hasClass('collapsed'));
      toggleEl.style.transform = toolEl.hasClass('collapsed') ? 'rotate(0deg)' : 'rotate(90deg)';
    };
    
    // 参数显示
    if (toolCall.arguments && Object.keys(toolCall.arguments).length > 0) {
      const argsEl = contentEl.createDiv({ cls: 'opensidian-tool-arguments' });
      this.renderToolArguments(argsEl, toolCall.name, toolCall.arguments);
    }
    
    this.scrollToBottom();
  }

  /**
   * 更新工具调用结果
   */
  updateToolResult(container: HTMLElement, toolCall: any): void {
    const lang = this.plugin.settings.language as Language;
    
    // 查找对应的工具调用元素
    const toolEl = container.querySelector(`[data-tool-id="${toolCall.id}"]`) as HTMLElement;
    if (!toolEl) {
      // 如果没找到，创建新的
      this.addToolCall(container, toolCall);
      return;
    }
    
    // 更新状态图标
    const statusIcon = toolEl.querySelector('.opensidian-tool-status') as HTMLElement;
    if (statusIcon) {
      if (toolCall.status === 'completed') {
        statusIcon.innerHTML = '✅';
        statusIcon.title = lang === 'zh' ? '已完成' : 'Completed';
      } else if (toolCall.status === 'failed') {
        statusIcon.innerHTML = '❌';
        statusIcon.title = lang === 'zh' ? '失败' : 'Failed';
      }
    }
    
    // 查找内容容器
    let contentEl = toolEl.querySelector('.opensidian-tool-content') as HTMLElement;
    if (!contentEl) {
      contentEl = toolEl.createDiv({ cls: 'opensidian-tool-content' });
    }
    
    // 显示结果
    if (toolCall.result) {
      let resultEl = contentEl.querySelector('.opensidian-tool-result') as HTMLElement;
      if (!resultEl) {
        resultEl = contentEl.createDiv({ cls: 'opensidian-tool-result' });
      }
      
      this.renderToolResult(resultEl, toolCall.name, toolCall.result);
    }
    
    // 显示错误
    if (toolCall.error) {
      const errorEl = contentEl.createDiv({ cls: 'opensidian-tool-error' });
      errorEl.textContent = toolCall.error;
    }
    
    this.scrollToBottom();
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
