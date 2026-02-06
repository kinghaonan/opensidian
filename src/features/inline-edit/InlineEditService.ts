import OpensidianPlugin from '../../main';
import { Editor, MarkdownView, Notice } from 'obsidian';
import { diffWords } from 'diff';

export class InlineEditService {
  private plugin: OpensidianPlugin;

  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
  }

  async editSelection(editor: Editor, _view: MarkdownView): Promise<void> {
    const selectedText = editor.getSelection();
    
    if (!selectedText) {
      new Notice('Please select some text to edit');
      return;
    }

    // Show edit modal
    const modal = new InlineEditModal(this.plugin, editor, selectedText);
    modal.open();
  }
}

class InlineEditModal {
  private plugin: OpensidianPlugin;
  private editor: Editor;
  private originalText: string;
  private modalEl!: HTMLElement;
  private overlay!: HTMLElement;

  constructor(plugin: OpensidianPlugin, editor: Editor, selectedText: string) {
    this.plugin = plugin;
    this.editor = editor;
    this.originalText = selectedText;
  }

  open(): void {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'opensidian-inline-edit-overlay';
    document.body.appendChild(this.overlay);

    // Create modal
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'opensidian-inline-edit-modal';
    
    // Header
    const header = this.modalEl.createDiv({ cls: 'opensidian-inline-edit-header' });
    header.createEl('h4', { text: 'Edit Selection' });
    
    const closeBtn = header.createEl('button', { cls: 'opensidian-close-btn' });
    closeBtn.innerHTML = '✕';
    closeBtn.onclick = () => this.close();

    // Prompt input
    const promptContainer = this.modalEl.createDiv({ cls: 'opensidian-prompt-container' });
    const promptInput = promptContainer.createEl('textarea', {
      cls: 'opensidian-prompt-input',
      attr: { placeholder: 'How would you like to edit this text?' }
    });
    promptInput.focus();

    // Original text preview
    const preview = this.modalEl.createDiv({ cls: 'opensidian-original-preview' });
    preview.createEl('label', { text: 'Original:' });
    const originalEl = preview.createEl('div', { cls: 'opensidian-preview-text' });
    originalEl.textContent = this.originalText.substring(0, 200) + 
      (this.originalText.length > 200 ? '...' : '');

    // Buttons
    const buttons = this.modalEl.createDiv({ cls: 'opensidian-modal-buttons' });
    
    const cancelBtn = buttons.createEl('button', { text: 'Cancel' });
    cancelBtn.onclick = () => this.close();
    
    const submitBtn = buttons.createEl('button', { 
      cls: 'mod-cta',
      text: 'Edit' 
    });
    submitBtn.onclick = async () => {
      const prompt = promptInput.value.trim();
      if (!prompt) return;
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Editing...';
      
      await this.performEdit(prompt);
      
      this.close();
    };

    document.body.appendChild(this.modalEl);
    
    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  close(): void {
    this.modalEl.remove();
    this.overlay.remove();
  }

  private async performEdit(prompt: string): Promise<void> {
    try {
      const fullPrompt = `Edit the following text according to this instruction: "${prompt}"\n\nText:\n${this.originalText}\n\nProvide only the edited text without any explanation or formatting.`;

      let editedText = '';
      
      const stream = this.plugin.openCodeService.query(fullPrompt, {
        stream: true,
        maxTokens: this.originalText.length + 500
      });

      for await (const chunk of stream) {
        if (chunk.type === 'text' && chunk.content) {
          editedText += chunk.content;
        }
      }

      // Clean up the response
      editedText = editedText.trim();
      
      // Show diff preview if enabled
      if (this.plugin.settings.showDiffPreview) {
        await this.showDiffAndApply(this.originalText, editedText);
      } else {
        this.applyEdit(editedText);
      }

    } catch (error) {
      console.error('Inline edit error:', error);
      new Notice('Error during edit. Please try again.');
    }
  }

  private async showDiffAndApply(original: string, edited: string): Promise<void> {
    const diff = diffWords(original, edited);
    
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'opensidian-diff-overlay';
      document.body.appendChild(overlay);

      const modal = document.createElement('div');
      modal.className = 'opensidian-diff-modal';

      // Header
      const header = modal.createDiv({ cls: 'opensidian-diff-header' });
      header.createEl('h4', { text: 'Review Changes' });

      // Diff display
      const diffContainer = modal.createDiv({ cls: 'opensidian-diff-content' });
      
      for (const part of diff) {
        const span = document.createElement('span');
        if (part.added) {
          span.className = 'opensidian-diff-added';
        } else if (part.removed) {
          span.className = 'opensidian-diff-removed';
        }
        span.textContent = part.value;
        diffContainer.appendChild(span);
      }

      // Buttons
      const buttons = modal.createDiv({ cls: 'opensidian-diff-buttons' });
      
      const rejectBtn = buttons.createEl('button', { text: 'Reject' });
      rejectBtn.onclick = () => {
        modal.remove();
        overlay.remove();
        resolve(undefined);
      };
      
      const acceptBtn = buttons.createEl('button', { 
        cls: 'mod-cta',
        text: 'Accept' 
      });
      acceptBtn.onclick = () => {
        this.applyEdit(edited);
        modal.remove();
        overlay.remove();
        resolve(undefined);
      };

      document.body.appendChild(modal);
    });
  }

  private applyEdit(newText: string): void {
    const cursor = this.editor.getCursor('from');
    const to = this.editor.getCursor('to');
    
    this.editor.replaceRange(newText, cursor, to);
    new Notice('Text updated successfully');
  }
}
