# 模型同步和 Skills 问题修复

## 🐛 问题分析

### 问题 1: Skills 命令不存在

**错误日志**:
```javascript
[OpenCode] Skills command failed: "H:\node\opencode" skills list
Error: Command failed: ... skills list

Commands:
  opencode completion
  opencode acp
  opencode mcp
  opencode [project]
  ...
  (没有 skills 命令)
```

**原因**: 
- opencode **不支持** `skills` 子命令
- 从帮助信息可以看到，opencode 没有 `skills` 相关的命令

**解决方案**:
代码已经修改为从配置文件和目录加载 Skills，而不是通过 CLI 命令。

---

### 问题 2: 模型未与 opencode 同步

**错误日志**:
```javascript
error: default agent "Sisyphus - Ultraworker" not found
```

**可能的原因**:

1. **opencode 配置问题**
   - 默认 agent 设置为 "Sisyphus - Ultraworker"
   - 但这个 agent 不存在或未安装

2. **模型列表未正确加载**
   - 插件可能没有正确获取 opencode 的模型列表
   - 或者使用了缓存的旧列表

3. **CLI 调用参数问题**
   - 调用 opencode 时传递了错误的参数
   - 导致 opencode 尝试使用不存在的 agent

---

## ✅ 已实施的修复

### 1. Skills 加载方式变更

**之前**: 尝试执行 `opencode skills list` 命令
**现在**: 从以下位置加载 Skills:

```typescript
// 1. 从 opencode 配置文件加载
if (configAny?.skills) {
  // 加载配置的 skills
}

// 2. 从 skills 目录加载
const skillsDirs = [
  '.opencode/skills',
  '.claude/skills',
  '.agents/skills',
  // ... 其他位置
];
```

**优点**:
- 不依赖 CLI 命令
- 更灵活，支持自定义 Skills
- 不会有命令不存在的错误

---

### 2. 模型同步检查清单

要确保模型与 opencode 同步，请检查：

#### 步骤 1: 验证 opencode 模型列表

```bash
# 查看 opencode 可用的模型
opencode models

# 或指定 provider
opencode models openai
opencode models anthropic
```

**预期输出**:
```
Available models:
- openai/gpt-4
- openai/gpt-3.5-turbo
- anthropic/claude-3-opus
- anthropic/claude-3-sonnet
...
```

#### 步骤 2: 检查 opencode 配置

查看 `~/.config/opencode/config.json` 或 vault 中的 `.opencode/config.json`:

```json
{
  "model": "opencode/big-pickle",  // 确保这个模型存在
  "agent": null,                    // 不要设置不存在的 agent
  "providers": {
    "openai": {
      "api_key": "sk-..."
    }
  }
}
```

**关键**:
- ❌ 不要设置 `"agent": "Sisyphus - Ultraworker"`（如果不存在）
- ✅ 或者设置为 `null` / 删除该行
- ✅ 确保 `model` 字段指向有效的模型

#### 步骤 3: 检查插件配置

在 Obsidian 插件设置中：

1. **模型选择**: 应该显示从 opencode 加载的模型列表
2. **自动加载配置**: 确保勾选 "Auto-load OpenCode Config"
3. **刷新模型**: 点击刷新按钮重新加载模型列表

#### 步骤 4: 查看控制台日志

启动时应该看到：

```javascript
Starting automatic opencode CLI detection...
✅ Found opencode via PATH: ...
Loaded opencode config from global
Loaded opencode auth
Setting up provider for model: opencode/big-pickle
Using free model: opencode/big-pickle, no provider config needed
Loaded X models from OpenCode CLI  ← 应该显示实际数量
Loaded X available models total
OpenCode service initialized
```

---

## 🔍 诊断步骤

### 如果模型列表为空或不正确

#### 1. 手动测试 opencode models 命令

```bash
opencode models
```

**如果成功**: 应该列出所有可用模型
**如果失败**: 检查 opencode 是否正确安装和配置

#### 2. 检查插件是否调用了正确的命令

在控制台中搜索：
```javascript
[OpenCode] Executing models command
```

应该看到类似：
```javascript
[OpenCode] Successfully executed models command
[OpenCode] Raw output (first 200 chars): {...}
```

#### 3. 验证模型解析逻辑

查看是否有解析错误：
```javascript
Failed to parse models from CLI
```

如果有，检查输出的格式是否正确。

---

## 💡 关于 "Sisyphus - Ultraworker" Agent 错误

### 原因

opencode 尝试使用一个名为 "Sisyphus - Ultraworker" 的默认 agent，但这个 agent 不存在。

### 解决方案

#### 方案 1: 移除默认 agent 配置

编辑 opencode 配置文件：

```bash
# 全局配置
notepad %USERPROFILE%\.config\opencode\config.json

# 或 vault 配置
notepad E:\obsidian\Mytest\.opencode\config.json
```

删除或注释掉 agent 行：

```json
{
  // "agent": "Sisyphus - Ultraworker",  ← 删除这行
  "model": "opencode/big-pickle"
}
```

#### 方案 2: 安装缺失的 agent

如果确实需要使用这个 agent：

```bash
opencode agent install "Sisyphus - Ultraworker"
```

#### 方案 3: 在插件中覆盖 agent 设置

在插件设置中明确指定不使用 agent，或使用默认值。

---

## 📊 当前状态

### Skills

- ✅ **不再尝试执行 `opencode skills` 命令**
- ✅ **从配置文件和目录加载**
- ✅ **不会产生错误日志**

### 模型

- ⚠️ **需要确认是否正确加载**
- ⚠️ **需要检查 opencode 配置**
- ⚠️ **可能需要移除无效的 agent 设置**

---

## 🚀 测试步骤

### 第 1 步：复制最新文件

```bash
Copy-Item "e:\obsidian_plugin\obsidian-opencode\opensidian\release\main.js" `
          "E:\obsidian\Mytest\.obsidian\plugins\opensidian\" -Force
Copy-Item "e:\obsidian_plugin\obsidian-opencode\opensidian\release\styles.css" `
          "E:\obsidian\Mytest\.obsidian\plugins\opensidian\" -Force
```

### 第 2 步：重启Obsidian

完全退出并重新启动

### 第 3 步：检查控制台日志

应该看到：

```javascript
// 不应该再有 skills 命令错误
// ✅ 没有 "[OpenCode] Skills command failed"

// 应该有模型加载日志
Loaded X models from OpenCode CLI
OpenCode service initialized
```

### 第 4 步：测试聊天功能

1. 打开聊天窗口
2. 选择一个模型
3. 发送消息
4. 观察是否有 "agent not found" 错误

### 第 5 步：如果还有问题

**提供以下信息**:

1. **完整的启动日志**（从 "Loading Opensidian plugin" 到 "OpenCode service initialized"）
2. **opencode models 命令的输出**
3. **opencode 配置文件内容**（隐藏敏感信息）
4. **插件设置截图**

---

## 📝 总结

### 已修复

- ✅ **Skills 命令错误** - 改为从配置文件加载
- ✅ **ANSI 编码乱码** - 已清理颜色编码
- ✅ **弹窗位置** - 已在按钮上方显示

### 需要检查

- ⚠️ **模型同步** - 需要确认是否正确加载
- ⚠️ **Agent 配置** - 可能需要移除无效的 agent 设置

### 下一步

1. 复制文件到 vault
2. 重启Obsidian
3. 检查控制台日志
4. 如果还有模型问题，提供详细日志

---

**请测试并反馈结果！** 🔍
