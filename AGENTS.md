# AGENTS.md

This file helps OpenCode understand the Opensidian project structure and coding patterns.

## Project Overview

Opensidian is an Obsidian plugin that integrates opencode AI assistance with MCP (Model Context Protocol) tools for vault management.

## Architecture

### Directory Structure

```
src/
├── main.ts                    # Plugin entry point
├── core/                      # Core infrastructure
│   ├── agent/                 # Opencode service integration
│   ├── mcp/                   # MCP server management
│   │   └── internal/          # Built-in MCP server
│   ├── storage/               # File storage service
│   ├── security/              # Permission management
│   └── types/                 # TypeScript definitions
├── features/
│   ├── chat/                  # Chat interface
│   ├── inline-edit/           # Inline text editing
│   └── settings/              # Settings UI
└── styles/                    # CSS styles
```

## Key Components

### Plugin Lifecycle

1. **onload()**: Initialize services, register views/commands
2. **Services**: StorageService, OpenCodeService, McpServerManager
3. **Views**: OpensidianView (chat interface)

### Opencode Integration

- Reads config from `opencode.json` (vault or global)
- Reads auth from `~/.local/share/opencode/auth.json`
- Uses OpenAI-compatible API format
- Supports streaming responses

### MCP Server

InternalMCPServer provides vault access tools:
- File read/write/operations
- Frontmatter management
- Tag management
- Search functionality

## Coding Patterns

### Service Pattern

```typescript
export class MyService {
  private plugin: OpensidianPlugin;
  
  constructor(plugin: OpensidianPlugin) {
    this.plugin = plugin;
  }
  
  async initialize(): Promise<void> {
    // Setup logic
  }
}
```

### Obsidian Integration

- Use `plugin.app.vault` for file operations
- Use `plugin.app.workspace` for UI operations
- Use `TFile` and `TFolder` for file system abstractions

### Error Handling

```typescript
try {
  await riskyOperation();
} catch (error) {
  console.error('Context:', error);
  new Notice('User-friendly error message');
}
```

## Dependencies

- `obsidian`: Obsidian API
- `@modelcontextprotocol/sdk`: MCP protocol
- `gray-matter`: Frontmatter parsing
- `diff`: Text diffing for inline edit

## Testing

Run tests with: `npm test`

## Building

Development: `npm run dev`
Production: `npm run build`
