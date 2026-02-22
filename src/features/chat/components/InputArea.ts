import { Notice } from 'obsidian';
import OpensidianPlugin from '../../../main';
import { ImageAttachment } from '../../../core/types/chat';
import { t, Language } from '../../../i18n';

export class InputArea {
  private container: HTMLElement;
  private plugin: OpensidianPlugin;
  private textarea!: HTMLTextAreaElement;
  private sendBtn!: HTMLButtonElement;
  private appendBtn!: HTMLButtonElement;
  private streamingButtons!: HTMLElement;
  private attachments: ImageAttachment[] = [];
  private attachmentsContainer!: HTMLElement;
  
  private onSend?: (message: string, attachments: ImageAttachment[]) => void;
  private onAppend?: (message: string, attachments: ImageAttachment[]) => void;

  constructor(container: HTMLElement, plugin: OpensidianPlugin) {
    this.container = container;
    this.plugin = plugin;
  }

  setCallbacks(callbacks: {
    onSend?: (message: string, attachments: ImageAttachment[]) => void;
    onAppend?: (message: string, attachments: ImageAttachment[]) => void;
  }): void {
    this.onSend = callbacks.onSend;
    this.onAppend = callbacks.onAppend;
  }

  render(): void {
    this.container.empty();
    const lang = this.plugin.settings.language as Language;

    this.attachmentsContainer = this.container.createDiv({ cls: 'opensidian-attachments' });

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

    this.textarea.addEventListener('input', () => {
      this.textarea.style.height = 'auto';
      this.textarea.style.height = Math.min(this.textarea.scrollHeight, 200) + 'px';
    });

    this.textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
  }

  private renderButtons(container: HTMLElement, _lang: Language): void {
    const buttonGroup = container.createDiv({ cls: 'opensidian-button-group' });
    
    this.sendBtn = buttonGroup.createEl('button', {
      cls: 'opensidian-send-btn',
      text: 'Send'
    });
    this.sendBtn.onclick = () => this.sendMessage();

    const streamingButtons = buttonGroup.createDiv({ cls: 'opensidian-streaming-buttons' });
    streamingButtons.style.display = 'none';
    
    this.appendBtn = streamingButtons.createEl('button', {
      cls: 'opensidian-append-btn',
      text: 'Add'
    });
    this.appendBtn.onclick = () => this.appendMessage();
    
    this.streamingButtons = streamingButtons;
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

    this.onSend?.(text, attachmentsToSend);
  }

  private appendMessage(): void {
    const text = this.textarea.value.trim();
    if (!text || !this.isStreaming()) return;

    const attachmentsToSend = [...this.attachments];
    this.textarea.value = '';
    this.textarea.style.height = 'auto';
    this.attachments = [];
    this.updateAttachmentsUI();

    this.onAppend?.(text, attachmentsToSend);
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
    this.textarea.focus();
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

  getAttachments(): ImageAttachment[] {
    return this.attachments;
  }
}
