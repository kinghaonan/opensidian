import { Plugin, WorkspaceLeaf, TFile, MarkdownView, MarkdownFileInfo } from 'obsidian';
import { OpensidianSettings, DEFAULT_SETTINGS } from './core/types/settings';
import { StorageService } from './core/storage/StorageService';
import { OpenCodeService } from './core/agent/OpenCodeService';
import { McpServerManager } from './core/mcp/McpServerManager';
import { PermissionManager } from './core/security/PermissionManager';
import { OpensidianView, VIEW_TYPE_OPENCODE } from './features/chat/OpensidianView';
import { InlineEditService } from './features/inline-edit/InlineEditService';
import { OpensidianSettingTab } from './features/settings/OpensidianSettingTab';

export default class OpensidianPlugin extends Plugin {
  settings!: OpensidianSettings;
  storage!: StorageService;
  openCodeService!: OpenCodeService;
  mcpManager!: McpServerManager;
  permissionManager!: PermissionManager;
  inlineEditService!: InlineEditService;
  
  private conversations: Map<string, any> = new Map();
  private activeConversationId: string | null = null;

  async onload() {
    console.log('Loading Opensidian plugin');
    
    try {
      // Load settings
      await this.loadSettings();
      
      // Initialize core services (with error handling)
      try {
        await this.initializeServices();
      } catch (serviceError) {
        console.error('Failed to initialize some services:', serviceError);
        // Continue loading even if services fail
      }
      
      // Register view
      this.registerView(
        VIEW_TYPE_OPENCODE,
        (leaf) => new OpensidianView(leaf, this)
      );
      
    // Add ribbon icon
    this.addRibbonIcon('message-circle', 'Open Opensidian', () => {
      this.activateView();
    });
      
      // Add commands
      this.addCommand({
        id: 'open-chat',
        name: 'Open chat view',
        callback: () => this.activateView(),
      });
      
      this.addCommand({
        id: 'inline-edit',
        name: 'Inline edit selection',
        editorCallback: (editor, view: MarkdownView | MarkdownFileInfo) => {
          if (view instanceof MarkdownView) {
            this.inlineEditService.editSelection(editor, view);
          }
        },
      });
      
      this.addCommand({
        id: 'new-conversation',
        name: 'Start new conversation',
        callback: () => this.startNewConversation(),
      });
      
      // Add settings tab
      this.addSettingTab(new OpensidianSettingTab(this.app, this));
      
      // Register events
      this.registerActiveFileListener();
      
      console.log('Opensidian plugin loaded successfully');
    } catch (error) {
      console.error('Failed to load Opensidian plugin:', error);
      throw error;
    }
  }

  onunload() {
    console.log('Unloading Opensidian plugin');
    this.saveData(this.settings);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private async initializeServices() {
    try {
      // Initialize storage
      this.storage = new StorageService(this);
      await this.storage.initialize();
    } catch (error) {
      console.warn('Storage service initialization failed:', error);
    }
    
    // Initialize permission manager
    this.permissionManager = new PermissionManager(this.settings);
    
    // Initialize OpenCode service first (MCP manager depends on it)
    try {
      this.openCodeService = new OpenCodeService(this);
      await this.openCodeService.initialize();
    } catch (error) {
      console.warn('OpenCode service initialization failed:', error);
      // Create a placeholder service
      this.openCodeService = new OpenCodeService(this);
    }
    
    // Initialize MCP manager (after OpenCode service)
    try {
      this.mcpManager = new McpServerManager(this);
      await this.mcpManager.initialize();
    } catch (error) {
      console.warn('MCP manager initialization failed:', error);
      // Create empty instance
      this.mcpManager = new McpServerManager(this);
    }
    
    // Initialize inline edit service
    this.inlineEditService = new InlineEditService(this);
  }

  async activateView() {
    const { workspace } = this.app;
    
    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_TYPE_OPENCODE);
    
    if (leaves.length > 0) {
      // View already exists, show it
      leaf = leaves[0];
    } else {
      // Create new view
      if (this.settings.openInMainTab) {
        leaf = workspace.getLeaf('tab');
      } else {
        leaf = workspace.getRightLeaf(false);
      }
      
      if (leaf) {
        await leaf.setViewState({
          type: VIEW_TYPE_OPENCODE,
          active: true,
        });
      }
    }
    
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private registerActiveFileListener() {
    // Listen for active file changes to provide context
    this.registerEvent(
      this.app.workspace.on('file-open', (file: TFile | null) => {
        if (file && file.extension === 'md') {
          // Active file changed, could update context here
          this.emitActiveFileChange(file);
        }
      })
    );
  }

  private emitActiveFileChange(file: TFile) {
    // Emit event for views to handle
    (this.app.workspace as any).trigger('opensidian:active-file-change', file);
  }

  async startNewConversation() {
    this.activeConversationId = null;
    await this.activateView();
    
    // Trigger new conversation in view
    (this.app.workspace as any).trigger('opensidian:new-conversation');
  }

  getActiveFile(): TFile | null {
    const activeFile = this.app.workspace.getActiveFile();
    return activeFile;
  }

  async getFileContent(file: TFile): Promise<string> {
    return await this.app.vault.cachedRead(file);
  }

  getVaultPath(): string {
    return (this.app.vault.adapter as any).basePath || '';
  }

  // Conversation management
  getConversation(id: string): any | undefined {
    return this.conversations.get(id);
  }

  saveConversation(id: string, conversation: any) {
    this.conversations.set(id, conversation);
  }

  getActiveConversationId(): string | null {
    return this.activeConversationId;
  }

  setActiveConversationId(id: string | null) {
    this.activeConversationId = id;
  }
}
