# Opensidian

[English](#english) | [中文](#中文)

---

<a href="https://github.com/kinghaonan/opensidian/stargazers">
  <img alt="GitHub Stars" src="https://img.shields.io/github/stars/kinghaonan/opensidian?style=flat-square">
</a>
<a href="https://github.com/kinghaonan/opensidian/issues">
  <img alt="GitHub Issues" src="https://img.shields.io/github/issues/kinghaonan/opensidian?style=flat-square">
</a>
<a href="https://github.com/kinghaonan/opensidian/blob/main/LICENSE">
  <img alt="License" src="https://img.shields.io/github/license/kinghaonan/opensidian?style=flat-square">
</a>

## English

### Overview

Opensidian is a modern Obsidian plugin that embeds **OpenCode AI** directly inside your vault. It combines a fast chat UI with **Model Context Protocol (MCP)** tools, enabling safe, controlled reading and editing of your notes.

### Highlights

- **AI Chat in Obsidian**: Work with free, paid, or local models
- **Context Awareness**: Automatic active-file context and `@filename` references
- **Inline Editing**: Select text, describe changes, preview diffs, then apply
- **MCP + Skills**: Tooling to read/write/search the vault plus OpenCode skills
- **MCP/Skill Picker**: Search, filter, and group tools with instant selection
- **Tool Call Collapsing**: Long tool sequences can be folded for clarity
- **Streaming Optimizations**: Smooth long responses with throttled updates
- **Safety Modes**: YOLO / Safe / Plan permission controls
- **Multi-language UI**: English, Chinese, Japanese, Korean, and more

### Installation

1. Download the latest release from [GitHub Releases](https://github.com/kinghaonan/opensidian/releases)
2. Extract to `.obsidian/plugins/opensidian/` in your vault
3. Enable the plugin in **Settings → Community Plugins → Opensidian**

### Requirements

- Obsidian v1.8.9 or higher
- Desktop only (Windows, macOS, Linux)
- [OpenCode CLI](https://opencode.ai/) or OpenCode Zen API key

### Quick Start

1. **Configure OpenCode**
   - Vault config: `opencode.json`
   - Global config: `~/.config/opencode/opencode.json`
2. **Open the Chat**
   - Click the 🤖 icon in the left ribbon, or open via Command Palette
3. **Start Chatting**
   - Type your request, use `@filename`, attach files if needed

### Features

#### Chat Experience

- Real-time streaming responses
- Optimized long-task streaming (throttled updates, final Markdown render)
- Thinking display toggle
- Model selection and refresh
- Tool summary shown with each message

#### MCP Tools

The assistant can call tools such as:

| Tool              | Description                       | Example                           |
| ----------------- | --------------------------------- | --------------------------------- |
| `read_note`       | Read note content and frontmatter | "Read my meeting notes"           |
| `write_note`      | Create or update notes            | "Create a new journal entry"      |
| `search_notes`    | Search vault contents             | "Find all notes about Python"     |
| `manage_tags`     | Add/remove tags                   | "Tag all TODO notes with #urgent" |
| `get_vault_stats` | Get vault statistics              | "How many notes do I have?"       |

#### MCP/Skill Picker

- Search and filter tools
- Grouped list with enabled/disabled status
- Selected tools are shown above the input and in message history
- Selection acts as a strong hint to the model to use those tools/skills

#### Inline Editing

- Highlight text in a note
- Press `Ctrl+Shift+E` (Mac: `Cmd+Shift+E`)
- Describe edits, preview diffs, apply or discard

#### Safety Modes

- **YOLO**: Execute without confirmation
- **Safe** (Recommended): Confirm risky actions only
- **Plan**: Confirm everything, never auto-run

### Settings

- Models: Free/paid/local, CLI path, timeout
- UI: Language, font size, theme, auto-scroll
- Safety: Permission mode, blocklist, excluded tags
- History: Retention, max history, title generation

### Troubleshooting

**OpenCode CLI not found**

- Verify `opencode --version`
- Check CLI path in settings
- Use auto-detect

**Timeouts**

- Increase CLI timeout
- Reduce conversation history

**Plugin not loading**

- Restart Obsidian
- Disable/enable the plugin
- Check console for errors

### Development

```bash
npm install
npm run dev
npm run build
npm test
npm run lint
```

### Release

1. Run `npm run build`
2. Upload `release/main.js`, `release/styles.css`, and `manifest.json` to GitHub Releases

### License

MIT License - see [LICENSE](LICENSE).

### Acknowledgments

- [OpenCode](https://opencode.ai/)
- [Obsidian](https://obsidian.md/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [Claudian](https://github.com/YishenTu/claudian)

---

## 中文

### 简介

Opensidian 是一款现代化 Obsidian 插件，把 **OpenCode AI** 直接集成到你的笔记库中。通过 **MCP（模型上下文协议）** 与技能系统，实现安全、可控的读写与智能协作。

### 核心亮点

- **Obsidian 内置 AI 聊天**
- **上下文感知**：自动包含当前文件，支持 `@文件名`
- **内联编辑**：选中文本，描述修改，预览差异后应用
- **MCP 与 Skills**：读取、写入、搜索、管理笔记库
- **MCP/Skill 选择器**：搜索、分组、即时选择与提示
- **工具调用折叠**：长工具链自动折叠
- **流式优化**：长任务更稳定，结尾再渲染 Markdown
- **安全模式**：YOLO / 安全 / 计划
- **多语言界面**

### 安装

1. 从 [GitHub Releases](https://github.com/kinghaonan/opensidian/releases) 下载最新版本
2. 解压到 `.obsidian/plugins/opensidian/`
3. 在 **设置 → 社区插件 → Opensidian** 启用

### 运行要求

- Obsidian v1.8.9+
- 仅桌面端（Windows/macOS/Linux）
- [OpenCode CLI](https://opencode.ai/) 或 OpenCode Zen API Key

### 快速开始

1. **配置 OpenCode**
   - Vault：`opencode.json`
   - 全局：`~/.config/opencode/opencode.json`
2. **打开聊天**
   - 左侧工具栏 🤖 图标或命令面板
3. **开始使用**
   - 输入问题，使用 `@文件名`，可上传附件

### 功能说明

#### 聊天体验

- 实时流式输出
- 长任务流式优化
- 思考过程显示
- 模型切换
- 工具摘要显示

#### MCP 工具

| 工具              | 说明                         | 示例                      |
| ----------------- | ---------------------------- | ------------------------- |
| `read_note`       | 读取笔记与 frontmatter       | "读取会议记录"            |
| `write_note`      | 创建或更新笔记               | "创建一条日记"            |
| `search_notes`    | 搜索笔记库                   | "查找 Python 相关笔记"    |
| `manage_tags`     | 管理标签                     | "给 TODO 加 #urgent"      |
| `get_vault_stats` | 获取笔记库统计               | "我有多少条笔记？"        |

#### MCP/Skill 选择器

- 搜索与筛选
- 分组展示启用状态
- 选择后立即显示在输入区与聊天记录
- 选择即提示模型优先调用

#### 内联编辑

- 选中文本
- 快捷键 `Ctrl+Shift+E`（Mac：`Cmd+Shift+E`）
- 预览差异并确认

#### 安全模式

- **YOLO**：无确认自动执行
- **安全**（推荐）：危险操作确认
- **计划**：所有操作需确认

### 设置

- 模型：免费/付费/本地，CLI 路径，超时
- UI：语言、字号、主题、自动滚动
- 安全：权限模式、命令黑名单、排除标签
- 历史：保留天数、最大条数、标题生成

### 常见问题

**找不到 OpenCode CLI**

- 执行 `opencode --version`
- 检查设置中的 CLI 路径
- 使用自动检测

**超时**

- 提高 CLI 超时时间
- 减少对话历史

**插件未加载**

- 重启 Obsidian
- 禁用后再启用
- 查看控制台错误

### 开发

```bash
npm install
npm run dev
npm run build
npm test
npm run lint
```

### 发布

1. 运行 `npm run build`
2. 将 `release/main.js`、`release/styles.css`、`manifest.json` 上传到 GitHub Releases

### 许可证

MIT License - 详见 [LICENSE](LICENSE)。

### 致谢

- [OpenCode](https://opencode.ai/)
- [Obsidian](https://obsidian.md/)
- [MCP 协议](https://modelcontextprotocol.io/)
- [Claudian](https://github.com/YishenTu/claudian)
