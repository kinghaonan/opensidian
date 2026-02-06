# This file contains instructions for working with the Opensidian codebase

## Build Commands

- `npm run dev` - Start development mode with hot reload
- `npm run build` - Create production build
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Project Structure

- `src/main.ts` - Plugin entry point
- `src/core/` - Core services (agent, mcp, storage, security)
- `src/features/` - UI features (chat, inline-edit, settings)
- `src/styles/` - CSS styles

## Key Files

- `src/core/agent/OpenCodeService.ts` - Opencode API integration
- `src/core/mcp/internal/InternalMCPServer.ts` - Built-in MCP tools
- `src/features/chat/OpensidianView.ts` - Chat UI
- `src/features/inline-edit/InlineEditService.ts` - Text editing

## Development Notes

- Obsidian plugins use CommonJS format
- CSS is bundled into styles.css
- The plugin reads opencode config from vault or global location
- MCP tools provide vault access to the AI

## Testing

Tests use Jest. Run with `npm test`.

## Building for Release

1. Update version in `manifest.json`
2. Update `versions.json`
3. Run `npm run build`
4. Create release with `main.js`, `manifest.json`, `styles.css`
