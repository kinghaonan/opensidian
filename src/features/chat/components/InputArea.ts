import { Notice, TFile } from 'obsidian';
import OpensidianPlugin from '../../../main';
import { ImageAttachment } from '../../../core/types/chat';
import { t, Language } from '../../../i18n';
import { ToolQuickPicker, QuickToolSelection } from './ToolQuickPicker';
import { MentionSuggest } from './MentionSuggest';
import { SlashCommand, SlashCommandDef } from './SlashCommand';

export class InputArea {
  private container: HTMLElement;
  private plugin: OpensidianPlugin;
  private textarea!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private appendBtn!: HTMLButtonElement;
  private streamingButtons!: HTMLElement;
  private attachments: ImageAttachment[] = [];
  private attachmentsContainer!: HTMLElement;
  private selectedToolsContainer!: HTMLElement;
  private quickPicker!: ToolQuickPicker;
  private mcpBtn!: HTMLButtonElement;
  private skillBtn!: HTMLButtonElement;
  private quickSelectedTools: QuickToolSelection[] = [];
  private mentionSuggest!: MentionSuggest;
  private slashCommand!: SlashCommand;
  
  private onSend?: (message: string, attachments: ImageAttachment[], tools?: QuickToolSelection[]) => void;
  private onAppend?: (message: string, attachments: ImageAttachment[], tools?: QuickToolSelection[]) => void;

  constructor(container: HTMLElement, plugin: OpensidianPlugin) {
    this.container = container;
    this.plugin = plugin;
  }

  setCallbacks(callbacks: {
    onSend?: (message: string, attachments: ImageAttachment[], tools?: QuickToolSelection[]) => void;
    onAppend?: (message: string, attachments: ImageAttachment[], tools?: QuickToolSelection[]) => void;
  }): void {
    this.onSend = callbacks.onSend;
    this.onAppend = callbacks.onAppend;
  }

  render(): void {
    this.container.empty();
    const lang = this.plugin.settings.language as Language;

    this.attachmentsContainer = this.container.createDiv({ cls: 'opensidian-attachments' });
    this.selectedToolsContainer = this.container.createDiv({ cls: 'opensidian-selected-tools' });

    // 渲染快速选择按钮（删除固定选择器）
    this.renderQuickPickerButtons(lang);

    const inputWrapper = this.container.createDiv({ cls: 'opensidian-input-wrapper' });

    this.renderAttachButton(inputWrapper, lang);
    this.renderTextarea(inputWrapper, lang);
    this.renderButtons(inputWrapper, lang);

    this.setupDragAndDrop();
  }

  private renderAttachButton(container: HTMLElement, lang: Language): void {
    const attachBtn = container.createEl('button', {
      cls: 'opensidian-attach-btn',
      attr: { 'aria-label': t('addAttachment', lang) || 'Add attachment' }
    });
    attachBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
    attachBtn.title = lang === 'zh' ? '添加附件' : 'Add attachment';
    attachBtn.onclick = () => this.addAttachment();
  }

  private renderTextarea(container: HTMLElement, lang: Language): void {
    this.textarea = container.createEl('textarea', {
      cls: 'opensidian-input',
      attr: {
        placeholder: t('chatPlaceholder', lang),
        rows: '1'
      }
    });

    this.mentionSuggest = new MentionSuggest(container, this.plugin);
    this.mentionSuggest.setOnSelect((file: TFile) => {
      this.insertMention(file);
    });

    const slashCommands: SlashCommandDef[] = [
      { command: 'clear', label: '清空对话', description: '清除当前对话历史', action: () => this.clearMessages() },
      { command: 'new', label: '新对话', description: '开始新的对话', action: () => this.newConversation() },
      { command: 'plan', label: '计划模式', description: '切换到计划模式', action: () => this.switchMode('plan') },
      { command: 'build', label: '构建模式', description: '切换到构建模式', action: () => this.switchMode('build') },
      { command: 'model', label: '切换模型', description: '显示模型列表', action: () => this.showModels() },
      { command: 'help', label: '帮助', description: '显示可用命令', action: () => this.showHelp() },
    ];
    this.slashCommand = new SlashCommand(container, slashCommands);

    this.textarea.addEventListener('input', () => {
      this.textarea.style.height = 'auto';
      this.textarea.style.height = Math.min(this.textarea.scrollHeight, 200) + 'px';
      this.handleSuggestions();
    });

    this.textarea.addEventListener('keydown', (e) => {
      if (this.mentionSuggest.isVisible() || this.slashCommand.isVisible()) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.mentionSuggest.navigate('down');
          this.slashCommand.navigate('down');
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.mentionSuggest.navigate('up');
          this.slashCommand.navigate('up');
        } else if (e.key === 'Enter' || e.key === 'Tab') {
          if (this.mentionSuggest.isVisible()) {
            e.preventDefault();
            this.mentionSuggest.confirmSelection();
          } else if (this.slashCommand.isVisible()) {
            e.preventDefault();
            this.slashCommand.executeCurrent();
          }
        } else if (e.key === 'Escape') {
          this.mentionSuggest.hide();
          this.slashCommand.hide();
        }
        return;
      }

      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  private handleSuggestions(): void {
    const value = this.textarea.value;
    const cursorPos = this.textarea.selectionStart;
    const mentionResult = this.mentionSuggest.handleInput(value, cursorPos);
    const slashResult = this.slashCommand.handleInput(value, cursorPos);
    if (mentionResult || slashResult) {
      console.log('[InputArea] Suggestion shown:', mentionResult ? 'mention' : 'slash', 'value:', value.substring(0, 20));
    }
  }

  private insertMention(file: TFile): void {
    const cursorPos = this.textarea.selectionStart;
    const textBefore = this.textarea.value.slice(0, cursorPos);
    const textAfter = this.textarea.value.slice(cursorPos);
    const mentionMatch = textBefore.match(/@\S*$/);

    if (mentionMatch) {
      const before = textBefore.slice(0, mentionMatch.index);
      const mentionText = `@[[${file.path}]] `;
      this.textarea.value = before + mentionText + textAfter;
      const newCursor = before.length + mentionText.length;
      this.textarea.selectionStart = newCursor;
      this.textarea.selectionEnd = newCursor;
      this.textarea.focus();
    }
  }

  private clearMessages(): void {
    this.textarea.value = '';
    this.textarea.focus();
  }

  private newConversation(): void {
    this.textarea.value = '';
    this.textarea.focus();
    (this.plugin.app.workspace as any).trigger('opensidian:new-conversation');
  }

  private switchMode(mode: string): void {
    this.textarea.value = '';
    this.textarea.focus();
    new Notice(mode === 'plan' ? '切换到计划模式' : '切换到构建模式');
  }

  private showModels(): void {
    this.textarea.value = '';
    this.textarea.focus();
  }

  private showHelp(): void {
    this.textarea.value = '可用命令: /clear /new /plan /build /model /help';
  }

  private renderButtons(container: HTMLElement, _lang: Language): void {
    const buttonGroup = container.createDiv({ cls: 'opensidian-button-group' });
    
    this.sendBtn = buttonGroup.createEl('button', {
      cls: 'opensidian-send-btn',
      text: 'Send'
    });
    this.sendBtn.title = _lang === 'zh' ? '发送消息' : 'Send message';
    this.sendBtn.onclick = () => this.sendMessage();

    const streamingButtons = buttonGroup.createDiv({ cls: 'opensidian-streaming-buttons' });
    streamingButtons.style.display = 'none';
    
    this.appendBtn = streamingButtons.createEl('button', {
      cls: 'opensidian-append-btn',
      text: 'Add'
    });
    this.appendBtn.title = _lang === 'zh' ? '追加消息' : 'Append message';
    this.appendBtn.onclick = () => this.appendMessage();
    
    this.streamingButtons = streamingButtons;
  }

  private renderQuickPickerButtons(lang: Language): void {
    // 初始化快速选择器
    this.quickPicker = new ToolQuickPicker(this.plugin);
    this.quickPicker.setCallback((tools: QuickToolSelection[]) => {
      this.quickSelectedTools = tools;
      console.log('Quick selected tools:', this.quickSelectedTools);
      this.updateSelectedToolsUI();
    });

    // 创建按钮容器
    const buttonContainer = this.container.createDiv({ cls: 'opensidian-quick-picker-buttons' });

    // MCP 按钮
    this.mcpBtn = buttonContainer.createEl('button', {
      cls: 'opensidian-mcp-btn',
      text: lang === 'zh' ? '🔧 MCP' : '🔧 MCP'
    });
    this.mcpBtn.title = lang === 'zh' ? '选择 MCP 服务器' : 'Select MCP servers';
    this.mcpBtn.onclick = async (e: MouseEvent) => {
      e.stopPropagation();
      await this.quickPicker.show('mcp', this.mcpBtn);
    };

    // Skill 按钮
    this.skillBtn = buttonContainer.createEl('button', {
      cls: 'opensidian-skill-btn',
      text: lang === 'zh' ? '⚡ Skill' : '⚡ Skill'
    });
    this.skillBtn.title = lang === 'zh' ? '选择 Skills' : 'Select skills';
    this.skillBtn.onclick = async (e: MouseEvent) => {
      e.stopPropagation();
      await this.quickPicker.show('skill', this.skillBtn);
    };
  }

  private setupDragAndDrop(): void {
    this.container.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.container.addClass('opensidian-drag-over');
    });

    this.container.addEventListener('dragleave', () => {
      this.container.removeClass('opensidian-drag-over');
    });

    this.container.addEventListener('drop', async (e) => {
      e.preventDefault();
      this.container.removeClass('opensidian-drag-over');
      await this.handleFileDrop(e);
    });
  }

  private sendMessage(): void {
    const text = this.textarea.value.trim();
    if (!text || this.isStreaming()) return;

    const attachmentsToSend = [...this.attachments];
    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    this.attachments = [];
    this.updateAttachmentsUI();

    // 只使用快速选择的工具
    this.onSend?.(text, attachmentsToSend, this.quickSelectedTools);
  }

  private appendMessage(): void {
    const text = this.textarea.value.trim();
    if (!text || !this.isStreaming()) return;

    const attachmentsToSend = [...this.attachments];
    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    this.attachments = [];
    this.updateAttachmentsUI();

    // 只使用快速选择的工具
    this.onAppend?.(text, attachmentsToSend, this.quickSelectedTools);
  }

  setStreaming(streaming: boolean): void {
    if (streaming) {
      this.sendBtn.style.display = 'none';
      this.streamingButtons.style.display = 'flex';
      this.textarea.placeholder = this.plugin.settings.language === 'zh' 
        ? '正在生成... 可以输入新命令追加' 
        : 'Generating... You can type new commands';
    } else {
      this.sendBtn.style.display = 'inline-block';
      this.streamingButtons.style.display = 'none';
      this.textarea.placeholder = t('chatPlaceholder', this.plugin.settings.language as Language);
    }
  }

  isStreaming(): boolean {
    return this.streamingButtons.style.display === 'flex';
  }


  focus(): void {
    this.textarea?.focus();
  }

  setText(text: string): void {
    if (this.textarea) {
      this.textarea.value = text;
      this.textarea.focus();
    }
  }

  private async addAttachment(): Promise<void> {
    const lang = this.plugin.settings.language as Language;

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
          this.attachments.push({
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            mimeType: file.type || 'application/octet-stream',
            base64Data: base64,
            fileName: file.name
          });
          new Notice(lang === 'zh' ? `已添加附件: ${file.name}` : `Added: ${file.name}`);
        } catch (error) {
          new Notice(lang === 'zh' ? `添加失败: ${file.name}` : `Failed: ${file.name}`);
        }
      }

      this.updateAttachmentsUI();
    };

    input.click();
  }

  private async handleFileDrop(e: DragEvent): Promise<void> {
    const lang = this.plugin.settings.language as Language;
    const files = e.dataTransfer?.files;

    if (!files) return;

    for (const file of Array.from(files)) {
      if (this.attachments.length >= 5) {
        new Notice(t('attachmentLimit', lang));
        break;
      }

      try {
        const base64 = await this.fileToBase64(file);
        this.attachments.push({
          id: Date.now().toString(36) + Math.random().toString(36).substr(2),
          mimeType: file.type || 'application/octet-stream',
          base64Data: base64,
          fileName: file.name
        });
        new Notice(lang === 'zh' ? `已添加附件: ${file.name}` : `Added: ${file.name}`);
      } catch (error) {
        new Notice(lang === 'zh' ? `添加失败: ${file.name}` : `Failed: ${file.name}`);
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

  private updateAttachmentsUI(): void {
    this.attachmentsContainer.empty();

    for (const attachment of this.attachments) {
      const item = this.attachmentsContainer.createDiv({ cls: 'opensidian-attachment-item' });

      if (attachment.mimeType.startsWith('image/')) {
        item.createEl('img', {
          attr: { src: `data:${attachment.mimeType};base64,${attachment.base64Data}` }
        });
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

  private updateSelectedToolsUI(): void {
    if (!this.selectedToolsContainer) return;
    this.selectedToolsContainer.empty();
    if (this.quickSelectedTools.length === 0) return;

    const label = this.selectedToolsContainer.createSpan({ 
      cls: 'opensidian-selected-tools-label',
      text: this.plugin.settings.language === 'zh' ? '已选择工具' : 'Selected tools'
    });
    label.setAttr('aria-hidden', 'true');

    for (const tool of this.quickSelectedTools) {
      const chip = this.selectedToolsContainer.createSpan({ cls: 'opensidian-selected-tool' });
      chip.setText(`${tool.type.toUpperCase()}: ${tool.name}`);
    }
  }

  getAttachments(): ImageAttachment[] {
    return this.attachments;
  }
}
