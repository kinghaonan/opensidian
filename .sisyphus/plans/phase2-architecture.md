# 第二阶段：多提供者架构重构

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 opensidian 从单体 OpenCodeService(2600+行) 重构为类 claudian 的多提供者架构，支持 ChatRuntime 接口、ProviderRegistry、持久查询和多标签对话。

**Architecture:** 引入 `core/runtime/` 和 `core/providers/` 两层抽象。ChatRuntime 定义统一运行时契约，ProviderRegistry 管理注册与发现。OpenCodeService 拆分为 `OpenCodeRuntime`（运行时实现）+ 向外兼容的 facade。新增 `features/chat/TabManager` 支持多标签。

**Tech Stack:** TypeScript, Obsidian Plugin API, OpenCode CLI/API, AsyncGenerator

---

## 目标架构

```
src/
├── main.ts
├── core/
│   ├── runtime/                          # 新增：运行时抽象层
│   │   ├── ChatRuntime.ts               # 统一运行时接口
│   │   ├── types.ts                      # PreparedChatTurn, StreamChunk 等
│   │   └── PersistentQuery.ts            # 持久查询管理器
│   ├── providers/                        # 新增：提供者实现层
│   │   ├── ProviderRegistry.ts           # 提供者注册中心
│   │   ├── opencode/                     # OpenCode 提供者
│   │   │   ├── OpenCodeRuntime.ts        # 运行时实现
│   │   │   ├── OpenCodeCapabilities.ts   # 能力定义
│   │   │   └── OpenCodeMessageChannel.ts # 消息通道（从 agent/ 迁移）
│   │   └── types.ts                      # ProviderCapabilities, ProviderId
│   ├── agent/                            # 保留：兼容层
│   │   ├── OpenCodeService.ts            # 简化为 facade，委托给 OpenCodeRuntime
│   │   └── ConnectionManager.ts          # 保留
│   ├── mcp/                              # 保留并增强
│   ├── storage/
│   ├── security/
│   └── types/
├── features/
│   ├── chat/
│   │   ├── OpensidianView.ts             # 集成 TabManager + ProviderRegistry
│   │   ├── TabManager.ts                 # 新增：多标签管理
│   │   └── components/
│   └── settings/
```

## 关键接口定义

### ChatRuntime 接口

```typescript
export interface ChatRuntime {
  readonly providerId: string;
  getCapabilities(): ProviderCapabilities;
  
  ensureReady(): Promise<boolean>;
  prepareTurn(request: ChatTurnRequest): PreparedChatTurn;
  
  query(turn: PreparedChatTurn, options?: ChatRuntimeQueryOptions): AsyncGenerator<StreamChunk>;
  cancel(): void;
  
  getAvailableModels(): Promise<ModelInfo[]>;
  getAvailableTools(): Promise<ToolInfo[]>;
  
  onStateChange(listener: (state: 'ready' | 'busy' | 'error') => void): () => void;
}
```

### ProviderCapabilities

```typescript
export interface ProviderCapabilities {
  supportsStreaming: boolean;
  supportsThinking: boolean;
  supportsToolCall: boolean;
  supportsPersistentQuery: boolean;
  supportsImageAttachments: boolean;
  supportsPlanMode: boolean;
}
```

### ProviderRegistry

```typescript
export class ProviderRegistry {
  static register(runtime: ChatRuntime): void;
  static get(providerId: string): ChatRuntime | undefined;
  static getRegisteredIds(): string[];
  static getActive(): ChatRuntime | null;
  static setActive(providerId: string): void;
}
```

---

## 分步实施

### Task 1: 创建运行时类型定义

**Files:**
- Create: `src/core/runtime/types.ts`

**Step 1: 写入类型文件**

定义 `StreamChunk`, `ChatTurnRequest`, `PreparedChatTurn`, `ChatRuntimeQueryOptions` 等共享类型。
从 `src/core/types/chat.ts` 提取现有类型，添加新类型。

**Step 2: 构建验证**

Run: `node esbuild.config.mjs production`
Expected: Build succeeds

---

### Task 2: 创建 ChatRuntime 接口

**Files:**
- Create: `src/core/runtime/ChatRuntime.ts`
- Create: `src/core/providers/types.ts`

**Step 1: 写入接口文件**

定义 `ChatRuntime` 接口、`ProviderCapabilities` 类型。
ProviderId 类型定义为 `'opencode' | string`。

**Step 2: 构建验证**

Run: `node esbuild.config.mjs production`
Expected: Build succeeds

---

### Task 3: 创建 ProviderRegistry

**Files:**
- Create: `src/core/providers/ProviderRegistry.ts`

**Step 1: 实现注册中心**

```typescript
export class ProviderRegistry {
  private static providers = new Map<string, ChatRuntime>();
  private static activeId: string | null = null;
  
  static register(runtime: ChatRuntime): void {
    this.providers.set(runtime.providerId, runtime);
    if (!this.activeId) this.activeId = runtime.providerId;
  }
  
  static get(providerId: string): ChatRuntime | undefined {
    return this.providers.get(providerId);
  }
  
  static getRegisteredIds(): string[] { ... }
  static getActive(): ChatRuntime | null { ... }
  static setActive(providerId: string): void { ... }
}
```

**Step 2: 构建验证**

---

### Task 4: 迁移 MessageChannel 到 providers/opencode/

**Files:**
- Move: `src/core/agent/MessageChannel.ts` → `src/core/providers/opencode/OpenCodeMessageChannel.ts`
- Modify: `src/core/agent/MessageChannel.ts` → 改为 re-export（向后兼容）

**Step 1: 复制文件到新位置**

**Step 2: 更新原文件为 re-export**

**Step 3: 构建验证**

---

### Task 5: 实现 OpenCodeRuntime (核心)

**Files:**
- Create: `src/core/providers/opencode/OpenCodeRuntime.ts`
- Create: `src/core/providers/opencode/OpenCodeCapabilities.ts`

**Step 1: 定义 OpenCodeCapabilities**

```typescript
export const OPENCODE_CAPABILITIES: ProviderCapabilities = {
  supportsStreaming: true,
  supportsThinking: true,
  supportsToolCall: true,
  supportsPersistentQuery: false, // 初始不支持，后续添加
  supportsImageAttachments: true,
  supportsPlanMode: true,
};
```

**Step 2: 实现 OpenCodeRuntime**

关键方法：
- `ensureReady()` → 调用 initialize 逻辑（CLI 路径发现、配置加载）
- `prepareTurn()` → 构建 query 需要的参数
- `query()` → 从 OpenCodeService 迁移主查询逻辑
- `cancel()` → AbortController
- `getAvailableModels()` → 模型加载
- `getAvailableTools()` → MCP/Skills 加载

将 OpenCodeService 中的以下方法提取到 OpenCodeRuntime：
- `queryViaCLI` / `queryViaCLISpawn` / `queryViaCLIPipe` / `queryViaCLIRedirect`
- `queryViaAPI`
- `handleStreamingResponse`
- `processCLIStream`
- `buildMessages` / `buildRequestBody`
- `findOpenCodePath`
- `loadOpencodeConfig` / `loadAuthConfig`
- `setupProvider`
- `loadAvailableModels` / `getModelsFromCLI` / `getModelsFromConfig`
- `loadAvailableMCPServers` / `loadAvailableSkills`

**Step 3: 构建验证**

---

### Task 6: 简化 OpenCodeService 为 Facade

**Files:**
- Modify: `src/core/agent/OpenCodeService.ts`

将 OpenCodeService 改为薄包装层，委托给 ProviderRegistry.get('opencode')：

```typescript
export class OpenCodeService {
  private get runtime(): ChatRuntime {
    return ProviderRegistry.get('opencode')!;
  }

  initialize() { return this.runtime.ensureReady(); }
  isReady() { return /* check state */ }
  query(...) { return this.runtime.query(...); }
  getAvailableModels() { return this.runtime.getAvailableModels(); }
  // ... 其他方法委托
}
```

保持所有 public API 签名不变，确保向后兼容。

**Step 2: 构建验证**

---

### Task 7: 修改 main.ts 注册 Provider

**Files:**
- Modify: `src/main.ts`

在 `initializeServices()` 中：
```typescript
// 创建并注册 OpenCode 运行时
const opencodeRuntime = new OpenCodeRuntime(this);
ProviderRegistry.register(opencodeRuntime);
await opencodeRuntime.ensureReady();

// 保留 facade 用于向后兼容
this.openCodeService = new OpenCodeService(this);
```

---

### Task 8: 创建 TabManager

**Files:**
- Create: `src/features/chat/TabManager.ts`

参考 claudian 的标签管理：
```typescript
export interface Tab {
  id: string;
  title: string;
  messages: ChatMessage[];
  runtimeState: any;
}

export class TabManager {
  private tabs: Tab[] = [];
  private activeTabId: string | null = null;
  
  createTab(title?: string): Tab;
  closeTab(id: string): void;
  switchTab(id: string): void;
  getActiveTab(): Tab | null;
  getTabs(): Tab[];
  
  onTabCreated: (tab: Tab) => void;
  onTabClosed: (id: string) => void;
  onTabSwitched: (id: string) => void;
}
```

---

### Task 9: 集成 TabManager 到 OpensidianView

**Files:**
- Modify: `src/features/chat/OpensidianView.ts`
- Create: `src/features/chat/components/TabBar.ts`

在视图头部添加标签栏，每个标签绑定独立的对话状态。

---

### Task 10: 持久查询 (Persistent Query)

**Files:**
- Create: `src/core/runtime/PersistentQuery.ts`
- Modify: `src/core/providers/opencode/OpenCodeRuntime.ts`

实现持久查询：当用户连续发送消息时，复用同一个查询上下文而非重建进程。需要 OpenCode CLI 支持 session 模式。

如果 CLI 不支持持久 session，则回退到当前的每次重建模式。

---

## 验收标准

- [ ] `ProviderRegistry.register()` 可注册多个 provider
- [ ] `ChatRuntime` 接口的 5 个核心方法全部实现
- [ ] OpenCodeService 作为 facade 保持向后兼容（所有现有调用不报错）
- [ ] TabManager 支持创建/切换/关闭标签
- [ ] build 通过且现有功能不被破坏
- [ ] 每个 task 单独提交

## 风险与回退

- **风险1**: OpenCodeRuntime 迁移过程中丢失逻辑 → 回退到 git tag
- **风险2**: 性能倒退 → 每个 task 后单独测试
- **风险3**: TabManager 内存泄漏 → 添加 dispose 机制
- **回退**: 所有改动在 feature branch 上进行，main 保持稳定
