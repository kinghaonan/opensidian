# 🔮 Opensidian

> OpenCode AI × Obsidian — Real-time streaming · Tool visualization · Multi-tab · MCP

[![Stars](https://img.shields.io/github/stars/kinghaonan/opensidian?style=flat-square)](https://github.com/kinghaonan/opensidian/stargazers)
[![Issues](https://img.shields.io/github/issues/kinghaonan/opensidian?style=flat-square)](https://github.com/kinghaonan/opensidian/issues)
[![License](https://img.shields.io/github/license/kinghaonan/opensidian?style=flat-square)](LICENSE)

<p align="center">
  <kbd>🇬🇧 <a href="#english">English</a></kbd> ·
  <kbd>🇨🇳 <a href="#chinese">中文</a></kbd>
</p>

---

<h2 id="english">🇬🇧 English</h2>

## 🎨 Interface Overview

Opensidian features a clean, claudian-inspired interface with a left sidebar for conversation history, a multi-tab chat area, and a floating input bar at the bottom. The welcome screen displays interactive suggestion cards and customizable daily task prompts. During conversations, the AI's thinking process appears as an orange collapsible block with a live timer, while tool calls (read, write, edit, bash, search) render as color-coded cards interleaved with the response text. A model selector dropdown, MCP/Skill picker, and slash command palette provide quick access to all features. Dark mode uses the Catppuccin Mocha palette with glass-morphism popups.

## 📦 Install

**Release:** [Releases](https://github.com/kinghaonan/opensidian/releases) → `.obsidian/plugins/opensidian/` → Enable
**Source:** `git clone` → `npm install && npm run build` → copy `release/`
**Requires:** Obsidian v1.8.9+ · Desktop · [OpenCode CLI](https://opencode.ai/) · Node v18+

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔄 True Streaming | Token-by-token spawn pipe |
| 🧠 Thinking Timer | "Thinking Xs..." auto-collapse |
| 🚀 Auto-connect | Startup init |
| 🔁 Auto-trigger | Continue after tools (max 3) |

**Tools:** 📄Read · ✏️Write (+X/-Y diff) · ▶️Bash · 🔍Search — cards at true position, blue→green/red border
**Tabs:** ➕New · ✏️Right-click rename · 🤖Auto-name
**Input:** 📎`@` folder nav · ⚡`/` commands · 📅Daily one-click
**MCP:** Auto-discover · SSE/HTTP · 24 built-in skills
**UI:** Light/Dark/Auto · Glass popups · Free copy

## 🏗 Architecture · 🛠 Develop

```
core/runtime/ → providers/opencode/ → agent/ (facade)
features/chat/controllers/ → rendering/ → components/
```

`npm install && npm run dev && npm run build && npm test` — Fork → branch → code → PR

## 📝 Changelog

🚀 Phase 1 Performance → 🏗 Phase 2 Architecture → 🌊 Phase 3 Streaming → 🎨 Phase 4 UI

---

<h2 id="chinese">🇨🇳 中文</h2>

## 🎨 界面概览

Opensidian 采用 claudian 风格的简洁界面：左侧边栏展示对话历史（默认收起），中央多标签聊天区，底部浮动输入栏。欢迎界面展示交互式建议卡片和可自定义的每日任务。AI 思考过程以橙色可折叠块显示并带有实时计时器，工具调用（读、写、编辑、运行、搜索）以彩色卡片穿插在回复文本中。模型下拉选择器、MCP/Skill 选择器和斜杠命令面板提供快速操作入口。深色模式使用 Catppuccin Mocha 配色，弹窗采用液态玻璃效果。

## 📦 安装

**发行版：** [Releases](https://github.com/kinghaonan/opensidian/releases) → `.obsidian/plugins/opensidian/` → 启用
**源码：** `git clone` → `npm install && npm run build` → 复制 `release/`
**要求：** Obsidian v1.8.9+ · 桌面端 · [OpenCode CLI](https://opencode.ai/) · Node v18+

## ✨ 功能

| 功能 | 说明 |
|------|------|
| 🔄 真正流式 | spawn pipe 逐 token |
| 🧠 思考计时 | "Thinking Xs..." 自动折叠 |
| 🚀 自动连接 | 启动初始化 |
| 🔁 自动续轮 | 工具后继续（最多3轮） |

**工具：** 📄读 · ✏️写（+X/-Y）· ▶️运行 · 🔍搜索 — 卡片真实穿插，蓝→绿/红边框
**标签：** ➕新建 · ✏️右键重命名 · 🤖自动命名
**输入：** 📎`@` 文件夹 · ⚡`/` 命令 · 📅每日一键
**MCP：** 自动发现 · SSE/HTTP · 24内置技能
**界面：** 亮/暗/自动 · 玻璃弹窗 · 自由复制

## 🏗 架构 · 🛠 开发

```
core/runtime/ → providers/opencode/ → agent/（外观层）
features/chat/controllers/ → rendering/ → components/
```

`npm install && npm run dev && npm run build && npm test` — Fork → 分支 → 编码 → PR

## 📝 更新日志

🚀 阶段一性能 → 🏗 阶段二架构 → 🌊 阶段三流式 → 🎨 阶段四UI

---

<p align="center"><sub><a href="https://opencode.ai/">OpenCode</a> · <a href="https://obsidian.md/">Obsidian</a> · <a href="https://github.com/YishenTu/claudian">Claudian</a> · <a href="https://modelcontextprotocol.io/">MCP</a> &nbsp;|&nbsp; MIT</sub></p>
