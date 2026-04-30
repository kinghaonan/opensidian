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

## 📸 Screenshots

<p align="center"><img src="screenshots/main.png" width="45%"/>&nbsp;<img src="screenshots/streaming.png" width="45%"/><br><sup>Main &nbsp;|&nbsp; Streaming + Thinking</sup></p>
<p align="center"><img src="screenshots/tool-calls.png" width="45%"/>&nbsp;<img src="screenshots/mention.png" width="45%"/><br><sup>Tool Calls &nbsp;|&nbsp; @mention</sup></p>
<p align="center"><img src="screenshots/slash.png" width="30%"/>&nbsp;<img src="screenshots/tabs.png" width="30%"/>&nbsp;<img src="screenshots/mcp-picker.png" width="30%"/><br><sup>Slash &nbsp;|&nbsp; Multi-Tab &nbsp;|&nbsp; MCP Picker</sup></p>
<p align="center"><img src="screenshots/dark-mode.png" width="45%"/>&nbsp;<img src="screenshots/settings.png" width="45%"/><br><sup>Dark Mode &nbsp;|&nbsp; Settings</sup></p>
<p align="center"><img src="screenshots/daily.png" width="60%"/><br><sup>Daily Tasks</sup></p>

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

## 📸 截图

<p align="center"><img src="screenshots/main.png" width="45%"/>&nbsp;<img src="screenshots/streaming.png" width="45%"/><br><sup>主界面 &nbsp;|&nbsp; 流式输出</sup></p>
<p align="center"><img src="screenshots/tool-calls.png" width="45%"/>&nbsp;<img src="screenshots/mention.png" width="45%"/><br><sup>工具调用 &nbsp;|&nbsp; @mention</sup></p>
<p align="center"><img src="screenshots/slash.png" width="30%"/>&nbsp;<img src="screenshots/tabs.png" width="30%"/>&nbsp;<img src="screenshots/mcp-picker.png" width="30%"/><br><sup>Slash &nbsp;|&nbsp; 多标签 &nbsp;|&nbsp; MCP</sup></p>
<p align="center"><img src="screenshots/dark-mode.png" width="45%"/>&nbsp;<img src="screenshots/settings.png" width="45%"/><br><sup>深色模式 &nbsp;|&nbsp; 设置</sup></p>
<p align="center"><img src="screenshots/daily.png" width="60%"/><br><sup>每日任务</sup></p>

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
