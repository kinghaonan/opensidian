# Opensidian

An Obsidian plugin that embeds opencode as an AI collaborator in your vault, with integrated MCP tools for vault access.

## Features

- **AI Chat Interface**: Chat with AI models powered by your opencode configuration
- **Context-Aware**: Automatically includes active file, supports @-mentions for files
- **Inline Edit**: Edit selected text with AI assistance and diff preview
- **Internal MCP Server**: Built-in tools for reading, writing, and managing your vault
- **MCP Integration**: Support for external MCP servers
- **Safety Controls**: Permission modes (YOLO/Safe/Plan), command blocklist

## Installation

1. Download the latest release from GitHub
2. Extract to your vault's `.obsidian/plugins/opensidian/` folder
3. Enable the plugin in Obsidian Settings

## Requirements

- Obsidian v1.8.9+
- opencode configured with at least one AI provider
- Desktop only (Windows, macOS, Linux)

## Configuration

### Opencode Integration

Opensidian automatically reads your opencode configuration:

1. **Vault-specific**: `opencode.json` in your vault root
2. **Global**: `~/.config/opencode/opencode.json`

### Quick Setup

1. Ensure opencode is configured with your AI provider
2. Install and enable the Opensidian plugin
3. Click the 🤖 icon in the sidebar or run "Open Opensidian" command

## Usage

### Chat Interface

- Open chat: Click the 🤖 icon or use command palette
- Reference files: Type `@filename` in your message
- Quick commands: Type `/command` for predefined actions

### Inline Edit

1. Select text in any note
2. Press `Ctrl+Shift+E` (or your configured hotkey)
3. Describe how you want to edit the text
4. Review the diff preview
5. Accept or reject the changes

### MCP Tools

The internal MCP server provides these tools:

- `read_note`: Read note content and frontmatter
- `write_note`: Create or update notes
- `patch_note`: Find and replace text
- `list_directory`: Browse vault structure
- `search_notes`: Search vault contents
- `move_note`: Move or rename notes
- `manage_tags`: Add/remove tags
- `get_vault_stats`: Get vault statistics

## Settings

### Permission Modes

- **YOLO**: Auto-execute all tool calls
- **Safe**: Ask permission for dangerous operations (delete, bash, etc.)
- **Plan**: Always ask for permission

### Safety Features

- Command blocklist for dangerous bash commands
- Path traversal protection
- Confirmation required for file deletion

## Development

```bash
npm install
npm run dev    # Watch mode
npm run build  # Production build
```

## License

MIT

## Acknowledgments

- Inspired by [Claudian](https://github.com/YishenTu/claudian)
- MCP tools based on [mcp-obsidian](https://github.com/bitbonsai/mcp-obsidian)
