export type Language = 'zh' | 'en';

interface Translation {
  // Common
  pluginName: string;
  loading: string;
  error: string;
  success: string;
  cancel: string;
  confirm: string;
  delete: string;
  edit: string;
  save: string;
  close: string;
  
  // Chat
  chatPlaceholder: string;
  send: string;
  append: string;
  thinking: string;
  newConversation: string;
  settings: string;
  stop: string;
  retry: string;
  copy: string;
  copied: string;
  
  // Modes
  planMode: string;
  buildMode: string;
  planModeDesc: string;
  buildModeDesc: string;
  modeSwitched: string;
  
  // Attachments
  addAttachment: string;
  attachmentLimit: string;
  removeAttachment: string;
  selectFile: string;
  dragDropFiles: string;
  
  // History
  conversationHistory: string;
  deleteConversation: string;
  deleteConfirm: string;
  noHistory: string;
  today: string;
  yesterday: string;
  clearHistory: string;
  clearHistoryConfirm: string;
  
  // Settings
  generalSettings: string;
  modelSettings: string;
  uiSettings: string;
  safetySettings: string;
  mcpSettings: string;
  historySettings: string;
  advancedSettings: string;
  
  // Model
  selectModel: string;
  useFreeModel: string;
  useLocalModel: string;
  localModelUrl: string;
  localModelName: string;
  currentModel: string;
  freeModels: string;
  configuredModels: string;
  localModels: string;
  loadingModels: string;
  refreshModels: string;
  
  // Language
  language: string;
  switchLanguage: string;
  chinese: string;
  english: string;
  
  // Provider
  provider: string;
  opencode: string;
  anthropic: string;
  openai: string;
  google: string;
  local: string;
  
  // Thinking
  thinkingProcess: string;
  showThinking: string;
  hideThinking: string;
  expandThinking: string;
  collapseThinking: string;
  
  // Actions
  generating: string;
  stopGenerating: string;
  regenerate: string;
  
  // Errors
  noModelConfigured: string;
  connectionError: string;
  timeoutError: string;
  invalidResponse: string;
  requestCancelled: string;
  apiKeyMissing: string;
  modelNotAvailable: string;
  
  // Status
  connected: string;
  disconnected: string;
  connecting: string;
  ready: string;
  
  // Session
  sessionSaved: string;
  sessionDeleted: string;
  sessionSyncedWithOpenCode: string;
  
  // Welcome
  welcomeTitle: string;
  welcomeMessage: string;
  welcomeTip1: string;
  welcomeTip2: string;
  welcomeTip3: string;
  welcomeTip4: string;
  welcomeTip5: string;
}

const translations: Record<Language, Translation> = {
  zh: {
    pluginName: 'Opensidian',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    save: '保存',
    close: '关闭',
    
    chatPlaceholder: '输入消息... (@引用文件, /命令)',
    send: '发送',
    append: '追加',
    thinking: '思考中...',
    newConversation: '新对话',
    settings: '设置',
    stop: '停止',
    retry: '重试',
    copy: '复制',
    copied: '已复制',
    
    planMode: '计划模式',
    buildMode: '构建模式',
    planModeDesc: 'AI 只提供建议，不执行操作',
    buildModeDesc: 'AI 可以直接执行操作',
    modeSwitched: '已切换模式',
    
    addAttachment: '添加附件',
    attachmentLimit: '最多支持 5 个附件',
    removeAttachment: '移除附件',
    selectFile: '选择文件',
    dragDropFiles: '拖拽文件到此处',
    
    conversationHistory: '对话历史',
    deleteConversation: '删除对话',
    deleteConfirm: '确定要删除这个对话吗？',
    noHistory: '暂无历史记录',
    today: '今天',
    yesterday: '昨天',
    clearHistory: '清空历史',
    clearHistoryConfirm: '确定要清空所有历史记录吗？',
    
    generalSettings: '通用设置',
    modelSettings: '模型设置',
    uiSettings: '界面设置',
    safetySettings: '安全设置',
    mcpSettings: 'MCP 设置',
    historySettings: '历史设置',
    advancedSettings: '高级设置',
    
    selectModel: '选择模型',
    useFreeModel: '使用免费模型',
    useLocalModel: '使用本地模型',
    localModelUrl: '本地模型地址',
    localModelName: '模型名称',
    currentModel: '当前模型',
    freeModels: '免费模型',
    configuredModels: '已配置模型',
    localModels: '本地模型',
    loadingModels: '加载模型列表...',
    refreshModels: '刷新模型列表',
    
    language: '语言',
    switchLanguage: '切换语言',
    chinese: '中文',
    english: 'English',
    
    provider: '提供商',
    opencode: 'OpenCode',
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    local: '本地',
    
    thinkingProcess: '思考过程',
    showThinking: '显示思考过程',
    hideThinking: '隐藏思考过程',
    expandThinking: '展开思考',
    collapseThinking: '折叠思考',
    
    generating: '生成中...',
    stopGenerating: '停止生成',
    regenerate: '重新生成',
    
    noModelConfigured: '未配置模型，请在设置中选择',
    connectionError: '连接失败，请检查网络',
    timeoutError: '请求超时，请重试',
    invalidResponse: '收到无效响应',
    requestCancelled: '请求已取消',
    apiKeyMissing: 'API 密钥缺失',
    modelNotAvailable: '模型不可用',
    
    connected: '已连接',
    disconnected: '未连接',
    connecting: '连接中...',
    ready: '就绪',
    
    sessionSaved: '会话已保存',
    sessionDeleted: '会话已删除',
    sessionSyncedWithOpenCode: '会话已与 OpenCode 同步',
    
    welcomeTitle: '欢迎使用 Opensidian',
    welcomeMessage: '你好！我是你的 AI 助手。',
    welcomeTip1: '询问关于你的笔记库的任何问题',
    welcomeTip2: '使用 @文件名 引用文件',
    welcomeTip3: '使用 /命令 快速操作',
    welcomeTip4: '选中文本并使用行内编辑',
    welcomeTip5: '点击 📎 添加附件',
  },
  
  en: {
    pluginName: 'Opensidian',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    save: 'Save',
    close: 'Close',
    
    chatPlaceholder: 'Type a message... (@ for files, / for commands)',
    send: 'Send',
    append: 'Append',
    thinking: 'Thinking...',
    newConversation: 'New Chat',
    settings: 'Settings',
    stop: 'Stop',
    retry: 'Retry',
    copy: 'Copy',
    copied: 'Copied',
    
    planMode: 'Plan Mode',
    buildMode: 'Build Mode',
    planModeDesc: 'AI only provides suggestions, no actions',
    buildModeDesc: 'AI can execute actions directly',
    modeSwitched: 'Mode switched',
    
    addAttachment: 'Add Attachment',
    attachmentLimit: 'Maximum 5 attachments supported',
    removeAttachment: 'Remove Attachment',
    selectFile: 'Select File',
    dragDropFiles: 'Drag & drop files here',
    
    conversationHistory: 'Conversation History',
    deleteConversation: 'Delete Conversation',
    deleteConfirm: 'Are you sure you want to delete this conversation?',
    noHistory: 'No history yet',
    today: 'Today',
    yesterday: 'Yesterday',
    clearHistory: 'Clear History',
    clearHistoryConfirm: 'Are you sure you want to clear all history?',
    
    generalSettings: 'General Settings',
    modelSettings: 'Model Settings',
    uiSettings: 'UI Settings',
    safetySettings: 'Safety Settings',
    mcpSettings: 'MCP Settings',
    historySettings: 'History Settings',
    advancedSettings: 'Advanced Settings',
    
    selectModel: 'Select Model',
    useFreeModel: 'Use Free Model',
    useLocalModel: 'Use Local Model',
    localModelUrl: 'Local Model URL',
    localModelName: 'Model Name',
    currentModel: 'Current Model',
    freeModels: 'Free Models',
    configuredModels: 'Configured Models',
    localModels: 'Local Models',
    loadingModels: 'Loading models...',
    refreshModels: 'Refresh Models',
    
    language: 'Language',
    switchLanguage: 'Switch Language',
    chinese: '中文',
    english: 'English',
    
    provider: 'Provider',
    opencode: 'OpenCode',
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
    local: 'Local',
    
    thinkingProcess: 'Thinking Process',
    showThinking: 'Show Thinking',
    hideThinking: 'Hide Thinking',
    expandThinking: 'Expand Thinking',
    collapseThinking: 'Collapse Thinking',
    
    generating: 'Generating...',
    stopGenerating: 'Stop Generating',
    regenerate: 'Regenerate',
    
    noModelConfigured: 'No model configured, please select in settings',
    connectionError: 'Connection failed, please check network',
    timeoutError: 'Request timeout, please retry',
    invalidResponse: 'Received invalid response',
    requestCancelled: 'Request cancelled',
    apiKeyMissing: 'API key missing',
    modelNotAvailable: 'Model not available',
    
    connected: 'Connected',
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    ready: 'Ready',
    
    sessionSaved: 'Session saved',
    sessionDeleted: 'Session deleted',
    sessionSyncedWithOpenCode: 'Session synced with OpenCode',
    
    welcomeTitle: 'Welcome to Opensidian',
    welcomeMessage: 'Hello! I\'m your AI assistant.',
    welcomeTip1: 'Ask me anything about your vault',
    welcomeTip2: 'Use @filename to reference files',
    welcomeTip3: 'Use /command for quick actions',
    welcomeTip4: 'Select text and use inline edit',
    welcomeTip5: 'Click 📎 to add attachments',
  }
};

export function t(key: keyof Translation, lang: Language = 'zh'): string {
  return translations[lang][key] || key;
}

export function getTranslation(lang: Language): Translation {
  return translations[lang];
}
