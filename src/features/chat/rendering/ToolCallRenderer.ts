import type { ToolCall } from '../../../core/types/chat';

export interface ToolCallState {
  wrapperEl: HTMLElement;
  headerEl: HTMLElement;
  iconEl: HTMLElement;
  nameEl: HTMLElement;
  summaryEl: HTMLElement;
  statusEl: HTMLElement;
  chevronEl: HTMLElement;
  contentEl: HTMLElement;
  toolCall: ToolCall;
  isExpanded: boolean;
}

const TOOL_ICONS: Record<string, string> = {
  read: '📄', edit: '✏️', write: '✏️', run: '▶️', bash: '▶️',
  delete: '🗑️', search: '🔍', grep: '🔍', glob: '🔍', ls: '📂',
  web_search: '🌐', web_fetch: '🌐', skill: '⚡', todo_write: '✅',
};

function classifyTool(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('read') || n.includes('get')) return 'read';
  if (n.includes('write') || n.includes('edit') || n.includes('create') || n.includes('save') || n.includes('file_change')) return 'edit';
  if (n.includes('run') || n.includes('bash') || n.includes('exec') || n.includes('shell') || n.includes('command')) return 'run';
  if (n.includes('delete') || n.includes('remove')) return 'delete';
  if (n.includes('search') || n.includes('grep') || n.includes('find') || n.includes('query')) return 'search';
  if (n.includes('glob')) return 'grep';
  if (n.includes('ls') || n.includes('list')) return 'ls';
  if (n.includes('web_search')) return 'web_search';
  if (n.includes('web_fetch')) return 'web_fetch';
  if (n.includes('skill')) return 'skill';
  if (n.includes('todo')) return 'todo_write';
  return 'run';
}

function getToolDisplayName(toolCall: ToolCall): string {
  const type = classifyTool(toolCall.name);
  const names: Record<string, string> = {
    read: 'Read', edit: 'Edit', write: 'Write', run: 'Run', bash: 'Bash',
    delete: 'Delete', search: 'Search', grep: 'Grep', glob: 'Glob',
    ls: 'List', web_search: 'WebSearch', web_fetch: 'WebFetch',
    skill: 'Skill', todo_write: 'Tasks',
  };
  return names[type] || toolCall.name;
}

function getSummary(toolCall: ToolCall): string {
  const args = toolCall.arguments || {};
  const fp = args.file_path || args.filePath || args.path || '';
  if (fp) return extractFilename(fp);
  if (args.command) return String(args.command).substring(0, 60);
  if (args.pattern) return String(args.pattern).substring(0, 60);
  if (args.query) return String(args.query).substring(0, 60);
  if (args.url) return String(args.url).substring(0, 60);
  if (args.content) {
    const match = String(args.content).match(/^#\s*(.+)/m);
    if (match) return extractFilename(match[1].trim());
  }
  return '';
}

function extractFilename(filePath: string): string {
  const name = filePath.replace(/\\/g, '/').split('/').pop() || filePath;
  if (name.length > 30) return name.substring(0, 28) + '…';
  return name;
}

function extractDiffStats(result: any): { added: number; removed: number } | null {
  if (!result) return null;
  const text = typeof result === 'string' ? result : (result.output || result.text || JSON.stringify(result));
  if (typeof text !== 'string') return null;
  const added = (text.match(/^\+/gm) || []).length;
  const removed = (text.match(/^-/gm) || []).length;
  if (added > 0 || removed > 0) return { added, removed };
  return null;
}

function renderResult(contentEl: HTMLElement, result: any, toolCall: ToolCall): void {
  contentEl.empty();
  const type = classifyTool(toolCall.name);
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

  if (type === 'edit' || toolCall.name.includes('write') || toolCall.name.includes('file_change')) {
    const stats = extractDiffStats(result);
    if (stats) {
      const statsEl = contentEl.createDiv({ cls: 'claudian-diff-stats' });
      statsEl.innerHTML = `<span class="claudian-diff-added">+${stats.added}</span> <span class="claudian-diff-removed">-${stats.removed}</span>`;
    }
    const lines = text.split('\n');
    if (lines.length > 1 || stats) {
      const diffEl = contentEl.createDiv({ cls: 'claudian-diff-lines' });
      for (const line of lines.slice(0, 30)) {
        const l = diffEl.createDiv({ cls: 'claudian-diff-line' });
        if (line.startsWith('+')) l.addClass('claudian-diff-added');
        else if (line.startsWith('-')) l.addClass('claudian-diff-removed');
        else l.addClass('claudian-diff-context');
        l.setText(line);
      }
      if (lines.length > 30) diffEl.createDiv({ cls: 'claudian-diff-more', text: `... ${lines.length - 30} more lines` });
    }
  } else {
    const pre = contentEl.createEl('pre', { cls: 'claudian-result-pre' });
    pre.setText(text.length > 500 ? text.substring(0, 500) + '\n...' : text);
  }
}

export function createToolCallBlock(parentEl: HTMLElement, toolCall: ToolCall): ToolCallState {
  const type = classifyTool(toolCall.name);
  const isSimple = type === 'read' || type === 'edit' || type === 'write' || type === 'delete' || type === 'ls';
  const wrapperEl = parentEl.createDiv({ cls: `claudian-tool-call claudian-tool-${type} claudian-tool-running ${isSimple ? 'claudian-tool-simple' : ''}` });
  wrapperEl.dataset.toolId = toolCall.id;

  const headerEl = wrapperEl.createDiv({ cls: 'claudian-tool-header' });

  const iconEl = headerEl.createSpan({ cls: 'claudian-tool-icon' });
  iconEl.setText(TOOL_ICONS[type] || '🔧');

  const nameEl = headerEl.createSpan({ cls: 'claudian-tool-name' });
  if (isSimple) {
    nameEl.style.display = 'none';
  } else {
    nameEl.setText(getToolDisplayName(toolCall));
  }

  const summaryEl = headerEl.createSpan({ cls: 'claudian-tool-summary' });
  const summary = getSummary(toolCall);
  if (summary) summaryEl.setText(summary);

  const statsEl = headerEl.createSpan({ cls: 'claudian-tool-stats' });

  const statusEl = headerEl.createSpan({ cls: 'claudian-tool-status' });
  statusEl.innerHTML = `<span class="claudian-spinner"></span>`;

  let chevronEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;

  if (!isSimple) {
    chevronEl = headerEl.createSpan({ cls: 'claudian-tool-chevron' });
    chevronEl.setText('▶');
    contentEl = wrapperEl.createDiv({ cls: 'claudian-tool-content' });
    contentEl.style.display = 'none';
  }

  const state: ToolCallState = { wrapperEl, headerEl, iconEl, nameEl, summaryEl, statusEl, chevronEl: chevronEl!, contentEl: contentEl!, toolCall, isExpanded: false };
  (wrapperEl as any).__toolState = state;
  (wrapperEl as any).__statsEl = statsEl;

  if (chevronEl && contentEl) {
    headerEl.onclick = () => {
      state.isExpanded = !state.isExpanded;
      contentEl!.style.display = state.isExpanded ? 'block' : 'none';
      chevronEl!.style.transform = state.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
      wrapperEl.toggleClass('claudian-tool-expanded', state.isExpanded);
    };
    headerEl.setAttribute('tabindex', '0');
    headerEl.setAttribute('role', 'button');
  }

  return state;
}

export function updateToolCallStatus(state: ToolCallState, status: ToolCall['status']): void {
  state.toolCall.status = status;
  const wrapperEl = state.wrapperEl;
  wrapperEl.removeClass('claudian-tool-running', 'claudian-tool-pending');
  wrapperEl.addClass(`claudian-tool-${status}`);
  const statusEl = state.statusEl;
  statusEl.empty();
  if (status === 'completed') statusEl.innerHTML = `<span class="claudian-status-check">✓</span>`;
  else if (status === 'error') statusEl.innerHTML = `<span class="claudian-status-error-icon">✗</span>`;
}

export function updateToolCallResult(state: ToolCallState, result: any): void {
  state.toolCall.result = result;
  const type = classifyTool(state.toolCall.name);
  const isSimple = type === 'read' || type === 'edit' || type === 'write' || type === 'delete' || type === 'ls';

  if (isSimple) {
    const stats = extractDiffStats(result);
    const statsEl = (state.wrapperEl as any).__statsEl as HTMLElement;
    if (statsEl && stats && (stats.added > 0 || stats.removed > 0)) {
      statsEl.empty();
      if (stats.added > 0) { const s = statsEl.createSpan({ cls: 'claudian-diff-added' }); s.setText(`+${stats.added}`); }
      if (stats.removed > 0) { const s = statsEl.createSpan({ cls: 'claudian-diff-removed' }); s.setText(`-${stats.removed}`); }
    }
    return;
  }

  if (state.contentEl) renderResult(state.contentEl, result, state.toolCall);
}
