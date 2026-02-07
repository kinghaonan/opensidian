import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import OpensidianPlugin from '../../main';
import { PermissionMode, AgentMode, Language, FREE_MODELS, POPULAR_MODELS } from '../../core/types/settings';
import { t } from '../../i18n';

export class OpensidianSettingTab extends PluginSettingTab {
  plugin: OpensidianPlugin;

  constructor(app: App, plugin: OpensidianPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    const lang = this.plugin.settings.language;
    containerEl.empty();

    containerEl.createEl('h2', { text: t('generalSettings', lang) });

    // Theme
    new Setting(containerEl)
      .setName('Theme / 主题')
      .setDesc('Choose light or dark theme')
      .addDropdown(dropdown => dropdown
        .addOption('auto', t('auto', lang))
        .addOption('light', t('light', lang))
        .addOption('dark', t('dark', lang))
        .setValue(this.plugin.settings.theme)
        .onChange(async (value: string) => {
          this.plugin.settings.theme = value as 'auto' | 'light' | 'dark';
          await this.plugin.saveSettings();
          // Apply theme immediately
          this.applyTheme();
        }));

    // Language
    new Setting(containerEl)
      .setName('Language / 语言')
      .setDesc('Interface language')
      .addDropdown(dropdown => dropdown
        .addOption('zh', '中文')
        .addOption('en', 'English')
        .setValue(this.plugin.settings.language)
        .onChange(async (value: string) => {
          this.plugin.settings.language = value as Language;
          await this.plugin.saveSettings();
          this.display();
        }));

    // Model Settings
    containerEl.createEl('h3', { text: t('modelSettings', lang) });

    // Default Mode
    new Setting(containerEl)
      .setName('Default Mode / 默认模式')
      .setDesc(`${t('planModeDesc', lang)} / ${t('buildModeDesc', lang)}`)
      .addDropdown(dropdown => dropdown
        .addOption('plan', t('planMode', lang))
        .addOption('build', t('buildMode', lang))
        .setValue(this.plugin.settings.agentMode)
        .onChange(async (value: string) => {
          this.plugin.settings.agentMode = value as AgentMode;
          await this.plugin.saveSettings();
        }));

    // Model Settings
    containerEl.createEl('h3', { text: t('modelSettings', lang) });

    // Default Mode
    new Setting(containerEl)
      .setName('Default Mode / 默认模式')
      .setDesc(`${t('planModeDesc', lang)} / ${t('buildModeDesc', lang)}`)
      .addDropdown(dropdown => dropdown
        .addOption('plan', t('planMode', lang))
        .addOption('build', t('buildMode', lang))
        .setValue(this.plugin.settings.agentMode)
        .onChange(async (value: string) => {
          this.plugin.settings.agentMode = value as AgentMode;
          await this.plugin.saveSettings();
        }));

    // Use Free Models
    new Setting(containerEl)
      .setName('Use Free Models / 使用免费模型')
      .setDesc('Enable free models (opencode)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useFreeModels)
        .onChange(async (value) => {
          this.plugin.settings.useFreeModels = value;
          await this.plugin.saveSettings();
        }));

    // OpenCode Zen API Key
    new Setting(containerEl)
      .setName('OpenCode Zen API Key / OpenCode Zen API 密钥')
      .setDesc('API key for OpenCode Zen (optional)')
      .addText(text => text
        .setPlaceholder('Enter your API key')
        .setValue(this.plugin.settings.opencodeZenApiKey || '')
        .onChange(async (value) => {
          this.plugin.settings.opencodeZenApiKey = value;
          await this.plugin.saveSettings();
        }));

    // OpenCode CLI Path
    new Setting(containerEl)
      .setName('OpenCode CLI Path / OpenCode CLI 路径')
      .setDesc('Path to OpenCode CLI executable (e.g., H:\\node-v22.20.0-win-x64\\opencode.cmd). Leave empty for auto-detection.')
      .addText(text => text
        .setPlaceholder('Auto-detect from PATH')
        .setValue(this.plugin.settings.opencodePath || '')
        .onChange(async (value) => {
          this.plugin.settings.opencodePath = value.trim() || undefined;
          await this.plugin.saveSettings();
        }))
      .addButton(button => button
        .setButtonText('Auto-detect / 自动检测')
        .setCta()
        .onClick(async () => {
          // Call the findOpenCodePath method
          await this.plugin.openCodeService.findOpenCodePath();
          const detectedPath = this.plugin.openCodeService.getOpenCodePath();
          if (detectedPath) {
            this.plugin.settings.opencodePath = detectedPath;
            await this.plugin.saveSettings();
            this.display(); // Refresh to show the detected path
            new Notice(`Detected OpenCode CLI at: ${detectedPath}`);
          } else {
            new Notice('OpenCode CLI not found. Please specify the path manually.');
          }
        }));

    // Temporary Directory (避免特殊字符路径问题)
    new Setting(containerEl)
      .setName('Temporary Directory / 临时目录')
      .setDesc('Directory for temporary files (e.g., D:\\Temp). Leave empty for system default.')
      .addText(text => text
        .setPlaceholder('System temporary directory')
        .setValue(this.plugin.settings.tempDir || '')
        .onChange(async (value) => {
          this.plugin.settings.tempDir = value.trim() || '';
          await this.plugin.saveSettings();
        }));

    // Disable API Fallback (避免CORS错误)
    new Setting(containerEl)
      .setName('Disable API Fallback / 禁用API回退')
      .setDesc('If enabled, only CLI will be used. No API fallback on CLI failure.')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.disableApiFallback)
        .onChange(async (value) => {
          this.plugin.settings.disableApiFallback = value;
          await this.plugin.saveSettings();
        }));

    // Local Model Settings
    containerEl.createEl('h3', { text: t('localModelSettings', lang) });

    // Enable Local Model
    new Setting(containerEl)
      .setName('Enable Local Model / 启用本地模型')
      .setDesc('Use local LLM (Ollama, LM Studio, etc.)')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.localModel.enabled)
        .onChange(async (value) => {
          this.plugin.settings.localModel.enabled = value;
          await this.plugin.saveSettings();
        }));

    // Local Model Provider
    new Setting(containerEl)
      .setName('Local Model Provider / 本地模型提供商')
      .setDesc('Choose local model provider')
      .addDropdown(dropdown => dropdown
        .addOption('ollama', 'Ollama')
        .addOption('lmstudio', 'LM Studio')
        .addOption('custom', 'Custom')
        .setValue(this.plugin.settings.localModel.provider)
        .onChange(async (value: string) => {
          this.plugin.settings.localModel.provider = value as 'ollama' | 'lmstudio' | 'custom';
          await this.plugin.saveSettings();
        }));

    // Local Model Base URL
    new Setting(containerEl)
      .setName('Local Model Base URL / 本地模型基础URL')
      .setDesc('Base URL for local model (e.g., http://localhost:11434)')
      .addText(text => text
        .setPlaceholder('http://localhost:11434')
        .setValue(this.plugin.settings.localModel.baseUrl)
        .onChange(async (value) => {
          this.plugin.settings.localModel.baseUrl = value;
          await this.plugin.saveSettings();
        }))
      .addButton(button => button
        .setButtonText('Test Connection / 测试连接')
        .setCta()
        .onClick(async () => {
          const baseUrl = this.plugin.settings.localModel.baseUrl;
          if (!baseUrl) {
            new Notice('Please enter a base URL first.');
            return;
          }
          
          try {
            // Simple connectivity test
            const testUrl = baseUrl.replace(/\/$/, '') + '/v1/models';
            const response = await fetch(testUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            if (response.ok) {
              new Notice(`Connection successful to ${baseUrl}`);
            } else {
              new Notice(`Connection failed: ${response.status} ${response.statusText}`);
            }
          } catch (error) {
            new Notice(`Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }));
        
    // UI Settings
    containerEl.createEl('h3', { text: t('uiSettings', lang) });

    // Font Size
    new Setting(containerEl)
      .setName('Font Size / 字体大小')
      .setDesc('Chat font size in pixels')
      .addSlider(slider => slider
        .setLimits(10, 24, 1)
        .setValue(this.plugin.settings.fontSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.fontSize = value;
          await this.plugin.saveSettings();
        }));

    // Auto Scroll
    new Setting(containerEl)
      .setName('Auto Scroll / 自动滚动')
      .setDesc('Automatically scroll to bottom when new messages arrive')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableAutoScroll)
        .onChange(async (value) => {
          this.plugin.settings.enableAutoScroll = value;
          await this.plugin.saveSettings();
        }));

    // Show Thinking Process
    new Setting(containerEl)
      .setName('Show Thinking Process / 显示思考过程')
      .setDesc('Show AI thinking process during generation')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showThinking)
        .onChange(async (value) => {
          this.plugin.settings.showThinking = value;
          await this.plugin.saveSettings();
        }));

    // Collapse Thinking Process by Default
    new Setting(containerEl)
      .setName('Collapse Thinking Process / 默认折叠思考过程')
      .setDesc('Hide thinking process by default')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.thinkingCollapsed)
        .onChange(async (value) => {
          this.plugin.settings.thinkingCollapsed = value;
          await this.plugin.saveSettings();
        }));

    // Context Settings
    containerEl.createEl('h3', { text: t('contextSettings', lang) });

    // Max Context Files
    new Setting(containerEl)
      .setName('Max Context Files / 最大上下文文件数')
      .setDesc('Maximum number of files to include in context')
      .addSlider(slider => slider
        .setLimits(1, 20, 1)
        .setValue(this.plugin.settings.maxContextFiles)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxContextFiles = value;
          await this.plugin.saveSettings();
        }));

    // Excluded Tags
    new Setting(containerEl)
      .setName('Excluded Tags / 排除标签')
      .setDesc('Comma-separated list of tags to exclude from context')
      .addText(text => text
        .setPlaceholder('private, sensitive')
        .setValue(this.plugin.settings.excludedTags.join(', '))
        .onChange(async (value) => {
          this.plugin.settings.excludedTags = value.split(',').map(tag => tag.trim()).filter(tag => tag);
          await this.plugin.saveSettings();
        }));

    // Media Folder
    new Setting(containerEl)
      .setName('Media Folder / 媒体文件夹')
      .setDesc('Folder name for media attachments')
      .addText(text => text
        .setPlaceholder('attachments')
        .setValue(this.plugin.settings.mediaFolder)
        .onChange(async (value) => {
          this.plugin.settings.mediaFolder = value;
          await this.plugin.saveSettings();
        }));

    // Inline Edit Settings
    containerEl.createEl('h3', { text: t('inlineEditSettings', lang) });

    // Inline Edit Hotkey
    new Setting(containerEl)
      .setName('Inline Edit Hotkey / 内联编辑快捷键')
      .setDesc('Keyboard shortcut for inline editing')
      .addText(text => text
        .setPlaceholder('Mod+Shift+E')
        .setValue(this.plugin.settings.inlineEditHotkey)
        .onChange(async (value) => {
          this.plugin.settings.inlineEditHotkey = value;
          await this.plugin.saveSettings();
        }));

    // Show Diff Preview
    new Setting(containerEl)
      .setName('Show Diff Preview / 显示差异预览')
      .setDesc('Show diff preview in inline edit mode')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showDiffPreview)
        .onChange(async (value) => {
          this.plugin.settings.showDiffPreview = value;
          await this.plugin.saveSettings();
        }));

    // Safety Settings
    containerEl.createEl('h3', { text: t('safetySettings', lang) });

    // Permission Mode
    new Setting(containerEl)
      .setName('Permission Mode / 权限模式')
      .setDesc('Select permission mode for operations')
      .addDropdown(dropdown => dropdown
        .addOption('yolo', 'YOLO (unsafe)')
        .addOption('safe', 'Safe')
        .addOption('plan', 'Plan')
        .setValue(this.plugin.settings.permissionMode)
        .onChange(async (value: string) => {
          this.plugin.settings.permissionMode = value as PermissionMode;
          await this.plugin.saveSettings();
        }));

    // Command Blocklist
    new Setting(containerEl)
      .setName('Enable Command Blocklist / 启用命令黑名单')
      .setDesc('Block dangerous system commands')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableCommandBlocklist)
        .onChange(async (value) => {
          this.plugin.settings.enableCommandBlocklist = value;
          await this.plugin.saveSettings();
        }));

    // Advanced Settings
    containerEl.createEl('h3', { text: t('advancedSettings', lang) });

    // Custom System Prompt
    new Setting(containerEl)
      .setName('Custom System Prompt / 自定义系统提示')
      .setDesc('Custom system prompt for all conversations')
      .addTextArea(text => text
        .setPlaceholder('Enter custom instructions...')
        .setValue(this.plugin.settings.customSystemPrompt)
        .onChange(async (value) => {
          this.plugin.settings.customSystemPrompt = value;
          await this.plugin.saveSettings();
        }));

    // Debug Mode
    new Setting(containerEl)
      .setName('Debug mode')
      .setDesc('Enable debug logging')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableDebugMode)
        .onChange(async (value) => {
          this.plugin.settings.enableDebugMode = value;
          await this.plugin.saveSettings();
        }));

    // Status
    containerEl.createEl('h3', { text: 'Status' });
    
    const status = this.plugin.openCodeService.isReady() 
      ? `✅ Connected (${this.plugin.openCodeService.getActiveModel()})`
      : '❌ Not connected';
    
    containerEl.createEl('p', { 
      text: status,
      cls: 'opensidian-status'
    });
  }

  private applyTheme(): void {
    const theme = this.plugin.settings.theme;
    const body = document.body;
    
    // Remove existing theme classes
    body.removeClass('opensidian-theme-light');
    body.removeClass('opensidian-theme-dark');
    
    // Apply new theme
    if (theme === 'light') {
      body.addClass('opensidian-theme-light');
      body.removeClass('opensidian-theme-dark');
    } else if (theme === 'dark') {
      body.addClass('opensidian-theme-dark');
      body.removeClass('opensidian-theme-light');
    } else {
      // auto mode - use system preference
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) {
        body.addClass('opensidian-theme-dark');
        body.removeClass('opensidian-theme-light');
      } else {
        body.addClass('opensidian-theme-light');
        body.removeClass('opensidian-theme-dark');
      }
    }
  }
}