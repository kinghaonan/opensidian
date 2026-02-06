export type Language = 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'ru';

// Simple translation function - returns the key as fallback
// In a real implementation, this would load translation files
export function t(key: string, lang?: Language, params?: Record<string, string>): string {
  // Simple translation mapping for common keys
  const translations: Record<string, Record<string, string>> = {
    'newChat': {
      'en': 'New chat',
      'zh': '新聊天',
    },
    'settings': {
      'en': 'Settings',
      'zh': '设置',
    },
    'conversations': {
      'en': 'Conversations',
      'zh': '对话',
    },
    'send': {
      'en': 'Send',
      'zh': '发送',
    },
    'stop': {
      'en': 'Stop',
      'zh': '停止',
    },
    'addAttachment': {
      'en': 'Add attachment',
      'zh': '添加附件',
    },
    'clearConversation': {
      'en': 'Clear conversation',
      'zh': '清空对话',
    },
    'deleteConversation': {
      'en': 'Delete conversation',
      'zh': '删除对话',
    },
    'renameConversation': {
      'en': 'Rename conversation',
      'zh': '重命名对话',
    },
    'exportConversation': {
      'en': 'Export conversation',
      'zh': '导出对话',
    },
    'importConversation': {
      'en': 'Import conversation',
      'zh': '导入对话',
    },
    'model': {
      'en': 'Model',
      'zh': '模型',
    },
    'temperature': {
      'en': 'Temperature',
      'zh': '温度',
    },
    'maxTokens': {
      'en': 'Max tokens',
      'zh': '最大令牌数',
    },
    'systemPrompt': {
      'en': 'System prompt',
      'zh': '系统提示',
    },
    'thinking': {
      'en': 'Thinking',
      'zh': '思考中',
    },
    'error': {
      'en': 'Error',
      'zh': '错误',
    },
    'retry': {
      'en': 'Retry',
      'zh': '重试',
    },
    'copy': {
      'en': 'Copy',
      'zh': '复制',
    },
    'regenerate': {
      'en': 'Regenerate',
      'zh': '重新生成',
    },
    'edit': {
      'en': 'Edit',
      'zh': '编辑',
    },
    'save': {
      'en': 'Save',
      'zh': '保存',
    },
    'cancel': {
      'en': 'Cancel',
      'zh': '取消',
    },
    'confirm': {
      'en': 'Confirm',
      'zh': '确认',
    },
    'loading': {
      'en': 'Loading...',
      'zh': '加载中...',
    },
    'noConversations': {
      'en': 'No conversations yet',
      'zh': '暂无对话',
    },
    'startNewConversation': {
      'en': 'Start a new conversation',
      'zh': '开始新对话',
    },
    'noModelSelected': {
      'en': 'No model selected',
      'zh': '未选择模型',
    },
    'selectModel': {
      'en': 'Select a model',
      'zh': '选择模型',
    },
    'apiKeyRequired': {
      'en': 'API key required',
      'zh': '需要API密钥',
    },
    'configureAPIKey': {
      'en': 'Configure API key in settings',
      'zh': '在设置中配置API密钥',
    },
    'connectionError': {
      'en': 'Connection error',
      'zh': '连接错误',
    },
    'checkConnection': {
      'en': 'Please check your connection',
      'zh': '请检查您的连接',
    },
    'serverError': {
      'en': 'Server error',
      'zh': '服务器错误',
    },
    'unknownError': {
      'en': 'Unknown error',
      'zh': '未知错误',
    },
    'fileTooLarge': {
      'en': 'File too large',
      'zh': '文件过大',
    },
    'unsupportedFileType': {
      'en': 'Unsupported file type',
      'zh': '不支持的文件类型',
    },
    'uploadFailed': {
      'en': 'Upload failed',
      'zh': '上传失败',
    },
    'processing': {
      'en': 'Processing...',
      'zh': '处理中...',
    },
    'done': {
      'en': 'Done',
      'zh': '完成',
    },
    'success': {
      'en': 'Success',
      'zh': '成功',
    },
    'warning': {
      'en': 'Warning',
      'zh': '警告',
    },
    'info': {
      'en': 'Info',
      'zh': '信息',
    },
    'debug': {
      'en': 'Debug',
      'zh': '调试',
    },
    'search': {
      'en': 'Search',
      'zh': '搜索',
    },
    'filter': {
      'en': 'Filter',
      'zh': '筛选',
    },
    'sort': {
      'en': 'Sort',
      'zh': '排序',
    },
    'refresh': {
      'en': 'Refresh',
      'zh': '刷新',
    },
    'close': {
      'en': 'Close',
      'zh': '关闭',
    },
    'open': {
      'en': 'Open',
      'zh': '打开',
    },
    'view': {
      'en': 'View',
      'zh': '查看',
    },
    'help': {
      'en': 'Help',
      'zh': '帮助',
    },
    'about': {
      'en': 'About',
      'zh': '关于',
    },
    'feedback': {
      'en': 'Feedback',
      'zh': '反馈',
    },
    'documentation': {
      'en': 'Documentation',
      'zh': '文档',
    },
    'privacy': {
      'en': 'Privacy',
      'zh': '隐私',
    },
    'terms': {
      'en': 'Terms',
      'zh': '条款',
    },
    'language': {
      'en': 'Language',
      'zh': '语言',
    },
    'theme': {
      'en': 'Theme',
      'zh': '主题',
    },
    'dark': {
      'en': 'Dark',
      'zh': '深色',
    },
    'light': {
      'en': 'Light',
      'zh': '浅色',
    },
    'auto': {
      'en': 'Auto',
      'zh': '自动',
    },
    'toggleSidebar': {
      'en': 'Toggle sidebar',
      'zh': '切换侧边栏',
    },
    'chatPlaceholder': {
      'en': 'Type your message here...',
      'zh': '在此输入消息...',
    },
    'switchLanguage': {
      'en': 'Switch language',
      'zh': '切换语言',
    },
    'planMode': {
      'en': 'Plan',
      'zh': '计划',
    },
    'buildMode': {
      'en': 'Build',
      'zh': '构建',
    },
    'conversationHistory': {
      'en': 'Conversation History',
      'zh': '对话历史',
    },
    'newConversation': {
      'en': 'New conversation',
      'zh': '新对话',
    },
    'welcomeTitle': {
      'en': 'Welcome to Opensidian!',
      'zh': '欢迎使用 Opensidian！',
    },
    'welcomeMessage': {
      'en': 'I\'m your AI assistant for managing your Obsidian vault. Here\'s what I can help you with:',
      'zh': '我是您的 Obsidian 笔记库 AI 助手。我可以帮助您：',
    },
    'welcomeTip1': {
      'en': 'Read and analyze notes in your vault',
      'zh': '读取和分析笔记库中的笔记',
    },
    'welcomeTip2': {
      'en': 'Edit and organize your notes',
      'zh': '编辑和组织您的笔记',
    },
    'welcomeTip3': {
      'en': 'Generate new content based on your notes',
      'zh': '基于您的笔记生成新内容',
    },
    'welcomeTip4': {
      'en': 'Help with note linking and structure',
      'zh': '帮助笔记链接和结构组织',
    },
    'welcomeTip5': {
      'en': 'Answer questions about your knowledge base',
      'zh': '回答关于您知识库的问题',
    },
    'pluginName': {
      'en': 'Opensidian',
      'zh': 'Opensidian',
    },
    'currentModel': {
      'en': 'Current model',
      'zh': '当前模型',
    },
    'refreshModels': {
      'en': 'Refresh models',
      'zh': '刷新模型',
    },
    'copied': {
      'en': 'Copied to clipboard',
      'zh': '已复制到剪贴板',
    },
    'thinkingProcess': {
      'en': 'Thinking process',
      'zh': '思考过程',
    },
    'generating': {
      'en': 'Generating...',
      'zh': '生成中...',
    },
  };

  const language = lang || 'en';
  const translation = translations[key]?.[language] || translations[key]?.['en'] || key;

  // Simple parameter substitution: {param} -> value
  if (params) {
    return translation.replace(/{(\w+)}/g, (match, param) => params[param] || match);
  }

  return translation;
}