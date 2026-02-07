# Opensidian

[English](#english) | [中文](#中文)

---

<a href="https://github.com/yourusername/opensidian/stargazers">
  <img alt="GitHub Stars" src="https://img.shields.io/github/stars/yourusername/opensidian?style=flat-square">
</a>
<a href="https://github.com/yourusername/opensidian/issues">
  <img alt="GitHub Issues" src="https://img.shields.io/github/issues/yourusername/opensidian?style=flat-square">
</a>
<a href="https://github.com/yourusername/opensidian/blob/main/LICENSE">
  <img alt="License" src="https://img.shields.io/github/license/yourusername/opensidian?style=flat-square">
</a>

## English

### Description

Opensidian is a powerful Obsidian plugin that integrates **OpenCode AI** as an intelligent collaborator directly within your vault. Leveraging the **Model Context Protocol (MCP)**, it provides AI assistants with secure, controlled access to your notes and files, enabling intelligent content creation, editing, and management.

### Key Features

- **🤖 AI-Powered Chat Interface**: Chat with multiple AI models (OpenCode Zen, Ollama, custom providers)
- **🎯 Context-Aware Intelligence**: Automatically includes active file context and supports @-mentions for files
- **✏️ Inline Text Editing**: Select any text, describe your edit, and preview changes with diff view
- **🔧 Built-in MCP Tools**: Comprehensive tools for reading, writing, searching, and managing your vault
- **🛡️ Safety Controls**: Three permission modes (YOLO/Safe/Plan) with command blocklists
- **🌍 Multi-Language Support**: Available in English, Chinese, Japanese, Korean, and more
- **💬 Conversation History**: Persist and manage your AI conversations with search and batch operations
- **📎 File Attachments**: Upload files for AI analysis (saved to temporary vault location)

### Installation

**Note**: Please update the `authorUrl` in `manifest.json` with your actual GitHub repository URL before releasing.

1. Download the latest release from [GitHub Releases](https://github.com/kinghaonan/opensidian/releases)
2. Extract to your vault's `.obsidian/plugins/opensidian/` folder
3. Enable the plugin in **Settings → Community Plugins → Opensidian**

### Requirements

- Obsidian v1.8.9 or higher
- Desktop only (Windows, macOS, Linux)
- [OpenCode CLI](https://opencode.ai/) or OpenCode Zen API key

### Quick Start

1. **Configure OpenCode**: The plugin automatically reads your OpenCode configuration from:
   - Vault root: `opencode.json`
   - Global config: `~/.config/opencode/opencode.json`

2. **Open Chat Interface**: Click the 🤖 icon in the sidebar or use command palette

3. **Start Chatting**: Type your message, reference files with `@filename`, and attach files if needed

### Main Features

#### Chat Interface

- **Real-time Streaming**: Watch AI responses appear character by character
- **Thinking Process**: Toggle visibility of AI's reasoning
- **Model Selection**: Switch between free, paid, or local models
- **Message History**: Browse and load past conversations
- **File References**: Use `@filename` to include specific notes in context

#### Inline Edit

- **Select Text**: Highlight any text in a note
- **Press Hotkey**: Default `Ctrl+Shift+E` (Cmd+Shift+E on Mac)
- **Describe Changes**: Tell AI how you want to edit the text
- **Preview Diff**: See exactly what will change before applying
- **Accept/Reject**: Choose whether to apply the changes

#### MCP Tools

The AI can use these tools to interact with your vault:

| Tool              | Description                       | Example                           |
| ----------------- | --------------------------------- | --------------------------------- |
| `read_note`       | Read note content and frontmatter | "Read my meeting notes"           |
| `write_note`      | Create or update notes            | "Create a new journal entry"      |
| `search_notes`    | Search vault contents             | "Find all notes about Python"     |
| `manage_tags`     | Add/remove tags                   | "Tag all TODO notes with #urgent" |
| `get_vault_stats` | Get vault statistics              | "How many notes do I have?"       |

#### Safety & Permissions

Three permission modes to balance convenience and security:

- **🟢 YOLO Mode**: Auto-execute all tool calls (fastest, least safe)
- **🟡 Safe Mode** (Recommended): Ask permission for dangerous operations only
- **🔴 Plan Mode**: Always ask for permission before any operation (maximum control)

### Settings Overview

#### Model Settings

- **Use Free Models**: Enable OpenCode free models (default)
- **OpenCode Zen API Key**: Add your API key for paid models
- **OpenCode CLI Path**: Specify path to opencode executable
- **Local Models**: Configure Ollama or LM Studio integration
- **CLI Timeout**: Configure request timeout (default: 5 minutes)

#### UI Settings

- **Theme**: Auto/Light/Dark mode
- **Font Size**: Adjust chat font size
- **Show Thinking Process**: Display AI reasoning
- **Auto Scroll**: Auto-scroll to new messages
- **Language**: Choose from supported languages

#### Safety Settings

- **Permission Mode**: Select YOLO/Safe/Plan
- **Command Blocklist**: Block dangerous bash commands
- **Excluded Tags**: Prevent AI from accessing sensitive notes

#### Session Management

- **Auto-Generate Titles**: Generate conversation titles
- **Max History**: Set maximum conversation history
- **Retention Days**: Auto-delete old conversations
- **Sync with OpenCode**: Keep sessions in sync

### Troubleshooting

**"OpenCode CLI not found"**

- Verify OpenCode is installed: `opencode --version`
- Check CLI path in settings
- Try "Auto-detect" button

**"Connection timeout"**

- Increase CLI timeout in settings (Advanced)
- Clear current conversation history
- Check network connection for API models

**"Plugin not loading"**

- Restart Obsidian
- Disable and re-enable plugin
- Check console (Ctrl+Shift+I) for errors

### Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### License

MIT License - see [LICENSE](LICENSE) file for details.

### Acknowledgments

- [OpenCode](https://opencode.ai/) - AI infrastructure and tool calling
- [Obsidian](https://obsidian.md/) - The note-taking platform
- [MCP Protocol](https://modelcontextprotocol.io/) - Tool calling standardization
- [Claudian](https://github.com/YishenTu/claudian) - Inspiration for AI integration

---

## 中文

### 简介

Opensidian 是一个强大的 Obsidian 插件，将 **OpenCode AI** 集成为您的笔记库智能助手。利用 **模型上下文协议（MCP）**，它为 AI 助手提供安全、可控的笔记访问能力，实现智能内容创建、编辑和管理。

### 主要特性

- **🤖 AI 驱动的聊天界面**：支持多种 AI 模型（OpenCode Zen、Ollama、自定义提供商）
- **🎯 上下文感知智能**：自动包含当前文件内容，支持 `@` 文件引用
- **✏️ 内联文本编辑**：选择任意文本，描述编辑需求，预览差异视图
- **🔧 内置 MCP 工具**：完整的笔记库读写、搜索和管理工具集
- **🛡️ 安全控制**：三种权限模式（YOLO/安全/计划）配合命令黑名单
- **🌍 多语言支持**：支持中文、英文、日文、韩文等多种语言
- **💬 对话历史**：持久化和管理 AI 对话，支持搜索和批量操作
- **📎 文件附件**：上传文件供 AI 分析（保存到笔记库临时位置）

### 安装

**注意**：发布前请更新 `manifest.json` 中的 `authorUrl` 为实际的 GitHub 仓库地址。

1. 从 [GitHub Releases](https://github.com/kinghaonan/opensidian/releases) 下载最新版本
2. 解压到笔记库的 `.obsidian/plugins/opensidian/` 目录
3. 在 **设置 → 社区插件 → Opensidian** 中启用插件

### 系统要求

- Obsidian v1.8.9 或更高版本
- 仅限桌面端（Windows、macOS、Linux）
- [OpenCode CLI](https://opencode.ai/) 或 OpenCode Zen API 密钥

### 快速开始

1. **配置 OpenCode**：插件自动读取以下位置的配置：
   - 笔记库根目录：`opencode.json`
   - 全局配置：`~/.config/opencode/opencode.json`

2. **打开聊天界面**：点击侧边栏的 🤖 图标或使用命令面板

3. **开始对话**：输入消息，使用 `@文件名` 引用文件，按需上传附件

### 核心功能

#### 聊天界面

- **实时流式响应**：观看 AI 逐字符生成回复
- **思考过程**：切换显示 AI 的推理过程
- **模型选择**：在免费、付费或本地模型间切换
- **消息历史**：浏览和加载历史对话
- **文件引用**：使用 `@文件名` 将特定笔记纳入上下文

#### 内联编辑

- **选择文本**：在任意笔记中高亮文本
- **按快捷键**：默认 `Ctrl+Shift+E`（Mac 上为 Cmd+Shift+E）
- **描述修改**：告诉 AI 如何编辑文本
- **预览差异**：在应用前查看具体变化
- **接受/拒绝**：选择是否应用更改

#### MCP 工具

AI 可以使用以下工具与您的笔记库交互：

| 工具              | 描述                       | 示例                              |
| ----------------- | -------------------------- | --------------------------------- |
| `read_note`       | 读取笔记内容和 frontmatter | "读取我的会议笔记"                |
| `write_note`      | 创建或更新笔记             | "创建新的日记条目"                |
| `search_notes`    | 搜索笔记库内容             | "查找所有关于 Python 的笔记"      |
| `manage_tags`     | 添加/移除标签              | "为所有待办笔记添加 #urgent 标签" |
| `get_vault_stats` | 获取笔记库统计信息         | "我有多少条笔记？"                |

#### 安全与权限

三种权限模式平衡便利性和安全性：

- **🟢 YOLO 模式**：自动执行所有工具调用（最快，安全性最低）
- **🟡 安全模式**（推荐）：仅对危险操作请求权限
- **🔴 计划模式**：任何操作前都请求权限（最大控制）

### 设置概述

#### 模型设置

- **使用免费模型**：启用 OpenCode 免费模型（默认）
- **OpenCode Zen API 密钥**：添加付费模型的 API 密钥
- **OpenCode CLI 路径**：指定 opencode 可执行文件路径
- **本地模型**：配置 Ollama 或 LM Studio 集成
- **CLI 超时**：配置请求超时时间（默认：5 分钟）

#### 界面设置

- **主题**：自动/浅色/深色模式
- **字体大小**：调整聊天字体大小
- **显示思考过程**：显示 AI 推理
- **自动滚动**：自动滚动到新消息
- **语言**：选择支持的语言

#### 安全设置

- **权限模式**：选择 YOLO/安全/计划
- **命令黑名单**：阻止危险 bash 命令
- **排除标签**：防止 AI 访问敏感笔记

#### 会话管理

- **自动生成标题**：生成对话标题
- **最大历史**：设置最大对话历史数量
- **保留天数**：自动删除旧对话
- **与 OpenCode 同步**：保持会话同步

### 故障排除

**"找不到 OpenCode CLI"**

- 验证 OpenCode 已安装：`opencode --version`
- 在设置中检查 CLI 路径
- 尝试"自动检测"按钮

**"连接超时"**

- 在设置中增加 CLI 超时时间（高级设置）
- 清空当前对话历史
- 检查 API 模型的网络连接

**"插件未加载"**

- 重启 Obsidian
- 禁用并重新启用插件
- 检查控制台（Ctrl+Shift+I）查看错误

### 开发

```bash
# 安装依赖
npm install

# 开发模式（监视）
npm run dev

# 生产构建
npm run build

# 运行测试
npm test

# 代码检查
npm run lint
```

### 许可证

MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

### 致谢

- [OpenCode](https://opencode.ai/) - AI 基础设施和工具调用
- [Obsidian](https://obsidian.md/) - 笔记平台
- [MCP 协议](https://modelcontextprotocol.io/) - 工具调用标准化
- [Claudian](https://github.com/YishenTu/claudian) - AI 集成灵感

---

<p align="center">
  <sub>如果觉得 Opensidian 有用，请在 GitHub 上给它一个 ⭐</sub>
</p>

