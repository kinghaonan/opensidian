import { Notice } from 'obsidian';
import OpensidianPlugin from '../../../main';
import { Language } from '../../../core/types/settings';
import { t } from '../../../i18n';

export interface QuickToolSelection {
  type: 'mcp' | 'skill';
  name: string;
  description?: string;
}

/**
 * 快速工具选择器 - 弹出式选择 MCP 或 Skills
 */
export class ToolQuickPicker {
  private plugin: OpensidianPlugin;
  private popupContainer: HTMLElement | null = null;
  private boundKeydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private selectedMCPServers: Set<string> = new Set();
  private selectedSkills: Set<string> = new Set();
  
  private onConfirm?: (tools: QuickToolSelection[]) => void;

  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
  }

  /**
   * 显示快速选择弹窗
   */
  async show(type: 'mcp' | 'skill', currentTarget: HTMLElement): Promise<void> {
    // 关闭已打开的弹窗
    this.close();

    if (!this.plugin.openCodeService?.isReady()) {
      try {
        await this.plugin.ensureServicesInitialized();
      } catch (error) {
        console.warn('[ToolQuickPicker] Failed to initialize OpenCodeService:', error);
      }
    }

    const lang = this.plugin.settings.language as Language;
    
    // 创建弹窗容器
    this.popupContainer = document.body.createDiv({ 
      cls: 'opensidian-tool-picker-popup' 
    });

    // 计算弹窗位置 - 改为向上展开避免被遮挡
    const rect = currentTarget.getBoundingClientRect();
    const popupHeight = 300; // 预估弹窗高度
    
    // 默认在按钮上方显示
    let top = rect.top + window.scrollY - popupHeight;
    let left = rect.left + window.scrollX;
    
    // 如果上方空间不足，则在按钮下方显示
    if (top < window.scrollY + 50) {
      top = rect.bottom + window.scrollY + 5;
    }
    
    // 确保不超出视口右边界
    const maxLeft = window.innerWidth - 320; // 320px 是弹窗最大宽度
    if (left > maxLeft) {
      left = maxLeft;
    }
    
    this.popupContainer.style.position = 'absolute';
    this.popupContainer.style.top = `${top}px`;
    this.popupContainer.style.left = `${left}px`;
    this.popupContainer.style.zIndex = '1000';
    this.applyThemeVariables();
    const closeBtn = this.popupContainer.createEl('button', {
      cls: 'opensidian-tool-picker-close',
      attr: { 'aria-label': lang === 'zh' ? '关闭' : 'Close' }
    });
    closeBtn.textContent = '×';
    closeBtn.onclick = (e) => { e.stopPropagation(); e.preventDefault(); this.close(); };

    // 渲染内容
    if (type === 'mcp') {
      this.renderMCPList(lang);
    } else {
      this.renderSkillsList(lang);
    }

    // 点击空白处关闭
    const clickHandler = (e: MouseEvent) => {
      if (this.popupContainer && !this.popupContainer.contains(e.target as Node)) {
        this.close();
        document.removeEventListener('click', clickHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', clickHandler), 10);

    this.boundKeydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.boundKeydownHandler);
  }

  /**
   * 关闭弹窗
   */
  close(): void {
    if (this.popupContainer) {
      this.popupContainer.remove();
      this.popupContainer = null;
    }
  }

  /**
   * 渲染 MCP 服务器列表
   */
  private renderMCPList(lang: Language): void {
    if (!this.popupContainer) return;

    this.popupContainer.createDiv({ 
      cls: 'opensidian-tool-picker-title',
      text: t('selectMCP', lang) || '选择 MCP 服务器'
    });

    const search = this.popupContainer.createEl('input', {
      cls: 'opensidian-tool-picker-search',
      attr: { 
        type: 'search',
        placeholder: lang === 'zh' ? '搜索 MCP' : 'Search MCP'
      }
    });

    const filterRow = this.popupContainer.createDiv({ cls: 'opensidian-tool-picker-filters' });
    const enabledOnlyToggle = filterRow.createEl('label', { cls: 'opensidian-tool-picker-toggle' });
    const enabledOnlyInput = enabledOnlyToggle.createEl('input', { type: 'checkbox' });
    enabledOnlyToggle.createSpan({ text: lang === 'zh' ? '只显示已启用' : 'Enabled only' });

    const listContainer = this.popupContainer.createDiv({ 
      cls: 'opensidian-tool-picker-list' 
    });

    // 获取可用的 MCP 服务器
    const mcpServers = this.getAvailableMCPServers();
    const renderList = (query: string) => {
      listContainer.empty();
      let filtered = this.filterTools(mcpServers, query);
      if (enabledOnlyInput.checked) {
        filtered = filtered.filter(s => s.enabled !== false);
      }
      const enabled = filtered.filter(s => s.enabled !== false);
      const disabled = filtered.filter(s => s.enabled === false);

      if (filtered.length === 0) {
        listContainer.createDiv({ 
          cls: 'opensidian-tool-picker-empty',
          text: lang === 'zh' ? '未找到 MCP 服务器' : 'No MCP servers found'
        });
        return;
      }

      if (enabled.length > 0) {
        this.renderGroupHeader(listContainer, lang === 'zh' ? '已启用' : 'Enabled');
        enabled.forEach(server => this.renderMcpItem(listContainer, server));
      }
      if (disabled.length > 0) {
        this.renderGroupHeader(listContainer, lang === 'zh' ? '未启用' : 'Disabled');
        disabled.forEach(server => this.renderMcpItem(listContainer, server));
      }
    };
    search.oninput = () => renderList(search.value || '');
    enabledOnlyInput.onchange = () => renderList(search.value || '');
    renderList('');

    // 确认按钮
    const confirmBtn = this.popupContainer.createEl('button', {
      cls: 'opensidian-tool-picker-confirm',
      text: lang === 'zh' ? '确认' : 'Confirm'
    });

    confirmBtn.onclick = () => this.confirmSelection();
  }

  /**
   * 渲染 Skills 列表
   */
  private renderSkillsList(lang: Language): void {
    if (!this.popupContainer) return;

    this.popupContainer.createDiv({ 
      cls: 'opensidian-tool-picker-title',
      text: t('selectSkill', lang) || '选择 Skill'
    });

    const search = this.popupContainer.createEl('input', {
      cls: 'opensidian-tool-picker-search',
      attr: { 
        type: 'search',
        placeholder: lang === 'zh' ? '搜索技能' : 'Search skills'
      }
    });

    const filterRow = this.popupContainer.createDiv({ cls: 'opensidian-tool-picker-filters' });
    const enabledOnlyToggle = filterRow.createEl('label', { cls: 'opensidian-tool-picker-toggle' });
    const enabledOnlyInput = enabledOnlyToggle.createEl('input', { type: 'checkbox' });
    enabledOnlyToggle.createSpan({ text: lang === 'zh' ? '只显示已启用' : 'Enabled only' });

    const listContainer = this.popupContainer.createDiv({ 
      cls: 'opensidian-tool-picker-list' 
    });

    // 获取可用的 Skills
    const skills = this.getAvailableSkills();
    const renderList = (query: string) => {
      listContainer.empty();
      let filtered = this.filterTools(skills, query);
      if (enabledOnlyInput.checked) {
        filtered = filtered.filter(s => s.enabled !== false);
      }
      if (filtered.length === 0) {
        listContainer.createDiv({ 
          cls: 'opensidian-tool-picker-empty',
          text: lang === 'zh' ? '未找到 Skills' : 'No skills found'
        });
        return;
      }
      this.renderGroupHeader(listContainer, lang === 'zh' ? '可用技能' : 'Available');
      filtered.forEach(skill => this.renderSkillItem(listContainer, skill));
    };
    search.oninput = () => renderList(search.value || '');
    enabledOnlyInput.onchange = () => renderList(search.value || '');
    renderList('');

    // 确认按钮
    const confirmBtn = this.popupContainer.createEl('button', {
      cls: 'opensidian-tool-picker-confirm',
      text: lang === 'zh' ? '确认' : 'Confirm'
    });

    confirmBtn.onclick = () => this.confirmSelection();
  }

  /**
   * 确认选择
   */
  private confirmSelection(): void {
    const tools: QuickToolSelection[] = [];

    this.selectedMCPServers.forEach(name => {
      tools.push({
        type: 'mcp',
        name
      });
    });

    this.selectedSkills.forEach(name => {
      tools.push({
        type: 'skill',
        name
      });
    });

    if (this.onConfirm) {
      this.onConfirm(tools);
    }

    // 显示提示
    const lang = this.plugin.settings.language as Language;
    const toolNames = tools.map(t => t.name).join(', ');
    new Notice(
      lang === 'zh' 
        ? `已选择：${toolNames}\n发送消息时将使用这些工具`
        : `Selected: ${toolNames}\nWill use these tools when sending message`
    );

    this.close();
  }

  private applyThemeVariables(): void {
    if (!this.popupContainer) return;
    const source = document.querySelector('.opensidian-container') as HTMLElement | null;
    const styles = getComputedStyle(source ?? document.body);
    const vars = [
      '--os-primary-color',
      '--os-primary-hover',
      '--os-primary-light',
      '--os-bg-color',
      '--os-bg-secondary',
      '--os-bg-tertiary',
      '--os-bg-hover',
      '--os-text-primary',
      '--os-text-secondary',
      '--os-text-muted',
      '--os-user-message-bg',
      '--os-assistant-message-bg',
      '--os-thinking-bg',
      '--os-thinking-border',
      '--os-tool-bg',
      '--os-error-color',
      '--os-success-color',
      '--os-border-color',
      '--os-border-radius-sm',
      '--os-border-radius-md',
      '--os-border-radius-lg',
      '--os-shadow-sm',
      '--os-shadow-md',
      '--os-transition'
    ];

    for (const key of vars) {
      const value = styles.getPropertyValue(key);
      if (value) {
        this.popupContainer.style.setProperty(key, value.trim());
      }
    }
  }

  private emitSelection(): void {
    if (!this.onConfirm) return;
    const tools: QuickToolSelection[] = [];
    this.selectedMCPServers.forEach(name => tools.push({ type: 'mcp', name }));
    this.selectedSkills.forEach(name => tools.push({ type: 'skill', name }));
    this.onConfirm(tools);
  }

  private renderGroupHeader(container: HTMLElement, text: string): void {
    container.createDiv({ cls: 'opensidian-tool-picker-group', text });
  }

  private filterTools<T extends {name: string; description?: string}>(items: T[], query: string): T[] {
    if (!query) return items;
    const q = query.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(q) || 
      (item.description || '').toLowerCase().includes(q)
    );
  }

  private renderMcpItem(container: HTMLElement, server: {name: string; description?: string; enabled?: boolean}): void {
    const item = container.createDiv({ 
      cls: 'opensidian-tool-picker-item',
      attr: {
        'data-name': server.name,
        'data-type': 'mcp'
      }
    });

    const checkbox = item.createEl('input', {
      type: 'checkbox',
      cls: 'opensidian-tool-picker-checkbox',
      attr: {
        id: `picker-mcp-${server.name}`,
      }
    });
    
    if (this.selectedMCPServers.has(server.name)) {
      checkbox.setAttribute('checked', 'checked');
    }

    checkbox.onchange = () => {
      if (checkbox.checked) {
        this.selectedMCPServers.add(server.name);
      } else {
        this.selectedMCPServers.delete(server.name);
      }
      this.emitSelection();
    };

    const label = item.createDiv({ cls: 'opensidian-tool-picker-label' });
    
    const nameSpan = label.createDiv({ cls: 'opensidian-tool-picker-name' });
    nameSpan.setText(server.name);

    if (server.description) {
      const descSpan = label.createDiv({ cls: 'opensidian-tool-picker-desc' });
      descSpan.setText(server.description);
    }

    const status = item.createDiv({ cls: 'opensidian-tool-picker-status' });
    const enabled = server.enabled !== false;
    status.setText(enabled ? 'Enabled' : 'Disabled');
    status.addClass(enabled ? 'enabled' : 'disabled');

    item.onclick = (e: MouseEvent) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        const event = new Event('change');
        checkbox.dispatchEvent(event);
      }
    };
  }

  private renderSkillItem(container: HTMLElement, skill: {name: string; description?: string}): void {
    const item = container.createDiv({ 
      cls: 'opensidian-tool-picker-item',
      attr: {
        'data-name': skill.name,
        'data-type': 'skill'
      }
    });

    const checkbox = item.createEl('input', {
      type: 'checkbox',
      cls: 'opensidian-tool-picker-checkbox',
      attr: {
        id: `picker-skill-${skill.name}`,
      }
    });
    
    if (this.selectedSkills.has(skill.name)) {
      checkbox.setAttribute('checked', 'checked');
    }

    checkbox.onchange = () => {
      if (checkbox.checked) {
        this.selectedSkills.add(skill.name);
      } else {
        this.selectedSkills.delete(skill.name);
      }
      this.emitSelection();
    };

    const label = item.createDiv({ cls: 'opensidian-tool-picker-label' });
    
    const nameSpan = label.createDiv({ cls: 'opensidian-tool-picker-name' });
    nameSpan.setText(skill.name);

    if (skill.description) {
      const descSpan = label.createDiv({ cls: 'opensidian-tool-picker-desc' });
      descSpan.setText(skill.description);
    }

    item.onclick = (e) => {
      if (e.target !== checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.onchange?.();
      }
    };
  }

  /**
   * 设置确认回调
   */
  setCallback(onConfirm: (tools: QuickToolSelection[]) => void): void {
    this.onConfirm = onConfirm;
  }

  /**
   * 获取可用的 MCP 服务器
   */
  private getAvailableMCPServers(): Array<{name: string; description?: string; enabled?: boolean}> {
    const servers: Array<{name: string; description?: string; enabled?: boolean}> = [];
  
    console.log('[ToolQuickPicker] Getting MCP servers...');
    console.log('[ToolQuickPicker] openCodeService exists:', !!this.plugin.openCodeService);
    console.log('[ToolQuickPicker] openCodeService.isReady():', this.plugin.openCodeService?.isReady());
        
    // 从 OpenCodeService 获取
    if (this.plugin.openCodeService && this.plugin.openCodeService.isReady()) {
      const opencodeServers = this.plugin.openCodeService.getAvailableMCPServers();
      console.log('[ToolQuickPicker] Got', opencodeServers.length, 'MCP servers from OpenCode');
      console.log('[ToolQuickPicker] Raw servers data:', opencodeServers);
      console.log('[ToolQuickPicker] Server names:', opencodeServers.map(s => s.name).join(', '));
      if (opencodeServers && opencodeServers.length > 0) {
        servers.push(...opencodeServers);
      }
    } else {
      console.warn('[ToolQuickPicker] OpenCodeService not ready');
      console.warn('[ToolQuickPicker] Will use default MCP servers');
    }

    // 如果没有检测到，使用默认列表
    if (servers.length === 0) {
      console.log('[ToolQuickPicker] Using default MCP servers');
      servers.push({
        name: 'obsidian-vault',
        description: 'Obsidian Vault Operations (read/write notes)',
        enabled: true
      });
  
      if (this.plugin.obsidianCLI?.isAvailable()) {
        servers.push({
          name: 'obsidian-cli',
          description: 'Obsidian CLI Tools (create/open/search notes)',
          enabled: false
        });
      }
    }
      
    console.log('[ToolQuickPicker] Total MCP servers:', servers.length);
    console.log('[ToolQuickPicker] Available:', servers.map(s => s.name).join(', '));
    return servers;
  }

  /**
   * 获取可用的 Skills
   */
  private getAvailableSkills(): Array<{name: string; description?: string; enabled?: boolean}> {
    console.log('[ToolQuickPicker] Getting skills...');
    
    // 从 OpenCodeService 获取
    if (this.plugin.openCodeService && this.plugin.openCodeService.isReady()) {
      const opencodeSkills = this.plugin.openCodeService.getAvailableSkills();
      console.log('[ToolQuickPicker] Got', opencodeSkills.length, 'skills from OpenCode');
      console.log('[ToolQuickPicker] Raw skills data:', opencodeSkills);
      console.log('[ToolQuickPicker] Skill names:', opencodeSkills.map(s => s.name).join(', '));
      if (opencodeSkills && opencodeSkills.length > 0) {
        return opencodeSkills;
      }
    } else {
      console.warn('[ToolQuickPicker] OpenCodeService not ready for skills');
    }

    // 如果没有检测到，返回空列表（不显示 Skills 部分）
    console.log('[ToolQuickPicker] No skills available');
    return [];
  }

  /**
   * 处理外部点击（关闭弹窗）
   */
  private handleOutsideClick = (e: MouseEvent): void => {
    if (this.popupContainer && !this.popupContainer.contains(e.target as Node)) {
      this.close();
    }
  };

  /**
   * 清除所有选择
   */
  clearSelection(): void {
    this.selectedMCPServers.clear();
    this.selectedSkills.clear();
  }

  /**
   * 获取当前选择的工具
   */
  getSelectedTools(): QuickToolSelection[] {
    const tools: QuickToolSelection[] = [];

    this.selectedMCPServers.forEach(name => {
      tools.push({ type: 'mcp', name });
    });

    this.selectedSkills.forEach(name => {
      tools.push({ type: 'skill', name });
    });

    return tools;
  }
}
