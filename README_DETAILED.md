# Opensidian - OpenCode AI Assistant for Obsidian

<p align="center">
  <strong>An Obsidian plugin that embeds opencode as an AI collaborator in your vault with integrated MCP tools.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#usage">Usage</a> •
  <a href="#troubleshooting">Troubleshooting</a> •
  <a href="#development">Development</a>
</p>

---

## 🌟 Features

### 🤖 **AI-Powered Assistance**
- **Multiple AI Models**: Support for OpenCode Zen (free & paid), local models (Ollama, LM Studio), and popular providers
- **Real-time Streaming**: Watch AI responses appear character by character
- **Thinking Process**: See the AI's reasoning process (collapsible/expandable)
- **Context-Aware**: Automatically includes active file context, supports @-mentions for files

### 🎨 **Modern UI/UX**
- **Responsive Design**: Optimized for desktop, tablet, and mobile views
- **Beautiful Chat Interface**: Message bubbles with shadows, animations, and smooth transitions
- **Dark/Light Themes**: Follows Obsidian's theme or choose your preference
- **Customizable Settings**: Fine-tune font sizes, auto-scroll, and display preferences

### 🔧 **Vault Integration**
- **Inline Text Editing**: Select text and edit with AI assistance (Ctrl+Shift+E)
- **Diff Preview**: See exactly what changes before applying edits
- **File Operations**: Read, write, search, and manage notes through AI
- **Tag Management**: Add/remove tags from notes using natural language

### 🛡️ **Safety & Control**
- **Permission Modes**: YOLO (auto-execute), Safe (ask for dangerous ops), Plan (always ask)
- **Command Blocklist**: Prevent execution of dangerous system commands
- **Context Controls**: Exclude sensitive tags from AI context
- **Session Management**: Persist conversations, sync with OpenCode sessions

### 🔌 **MCP Integration**
- **Internal MCP Server**: Built-in tools for vault access (no external dependencies)
- **External MCP Support**: Connect to additional MCP servers
- **Tool Calling**: AI can use tools to interact with your vault directly

---

## 📦 Installation

### Method 1: Manual Installation (Recommended)
1. Download the latest release from the [GitHub Releases](https://github.com/yourusername/opensidian/releases) page
2. Extract the zip file to your vault's `.obsidian/plugins/opensidian/` folder
3. Enable the plugin in Obsidian Settings → Community Plugins

### Method 2: Using Obsidian Community Plugins
*(Coming soon - Plugin submission in progress)*

### Method 3: Development Build
```bash
# Clone the repository
git clone https://github.com/yourusername/opensidian.git

# Navigate to plugin directory
cd opensidian

# Install dependencies
npm install

# Build the plugin
npm run build

# Copy to your vault's plugins folder
cp -r opensidian_release/* ~/YourVault/.obsidian/plugins/opensidian/
```

---

## ⚙️ Configuration

### OpenCode Setup

#### Option A: Using OpenCode Zen (Free/Paid Models)
1. **Free Models**: No configuration needed - works out of the box!
2. **Paid Models**: Add your OpenCode Zen API key in settings
3. **Auto-detection**: Plugin automatically reads your OpenCode configuration

#### Option B: Local Models (Ollama, LM Studio, etc.)
1. **Enable Local Model** in settings
2. **Select Provider**: Ollama, LM Studio, or Custom
3. **Configure Base URL**: 
   - Ollama: `http://localhost:11434`
   - LM Studio: `http://localhost:1234`
   - Custom: Your OpenAI-compatible API endpoint
4. **Model Name**: Specify the model to use (e.g., `llama2`, `mistral`)

#### Option C: OpenCode CLI
1. **Specify CLI Path**: Set the path to `opencode.cmd` or `opencode` executable
2. **Auto-detection**: Use the "Auto-detect" button to find it automatically
3. **Fallback Options**: Configure API fallback behavior

### Quick Configuration Guide

#### Step 1: Open Settings
- Click the gear icon in Opensidian chat
- Or go to Obsidian Settings → Opensidian

#### Step 2: Configure Your AI Provider
```
[Model Settings]
├── Use Free Models: ✅ Enable (default)
├── OpenCode Zen API Key: (optional)
├── OpenCode CLI Path: (auto-detected)
└── Local Model: Configure if using local LLM
```

#### Step 3: Set Up Safety & UI
```
[UI Settings]
├── Theme: Auto/Light/Dark
├── Font Size: 12-24px
├── Show Thinking Process: ✅ Enable
└── Auto Scroll: ✅ Enable

[Safety Settings]
├── Permission Mode: Safe (recommended)
├── Enable Command Blocklist: ✅ Enable
└── Excluded Tags: private, sensitive
```

---

## 🚀 Usage

### Starting a Chat
1. **Open Chat View**: Click the 🤖 icon in the sidebar
2. **Command Palette**: Press `Ctrl+P` and type "Open Opensidian"
3. **Hotkey**: Assign a custom hotkey in Obsidian settings

### Chat Features

#### Basic Chatting
- **Type your message** in the input box and press Enter
- **Reference files** by typing `@filename` or `@foldername/filename`
- **Attach images** using the paperclip button
- **Switch models** using the dropdown in the header

#### Advanced Features
- **Streaming Responses**: Watch AI responses appear in real-time
- **Thinking Process**: Click the 💭 icon to expand/collapse AI reasoning
- **Message History**: Use the history dropdown to revisit conversations
- **Mode Switching**: Toggle between Plan (analysis) and Build (execution) modes

### Inline Text Editing
1. **Select text** in any note
2. **Press `Ctrl+Shift+E`** (default hotkey)
3. **Describe your edit** in the popup
4. **Review the diff** preview
5. **Accept or reject** the changes

### MCP Tools (AI Tool Calling)
The AI can use these tools automatically when needed:

| Tool | Description | Example Use |
|------|-------------|-------------|
| `read_note` | Read note content | "What's in my TODO list?" |
| `write_note` | Create/update notes | "Create a meeting notes template" |
| `search_notes` | Search vault contents | "Find all notes about React" |
| `manage_tags` | Add/remove tags | "Tag all project notes with #active" |
| `get_vault_stats` | Get vault statistics | "How many notes do I have?" |

### Permission Modes Explained

#### 🟢 **YOLO Mode** (You Only Live Once)
- AI automatically executes all tool calls
- Fastest but least safe
- **Use case**: Trusted environments, simple tasks

#### 🟡 **Safe Mode** (Recommended)
- Asks permission for dangerous operations
- Auto-approves safe operations (read, search)
- **Use case**: Daily use, balanced safety/convenience

#### 🔴 **Plan Mode**
- Always asks for permission before any operation
- Maximum control and safety
- **Use case**: Sensitive data, critical operations

---

## 🔧 Troubleshooting

### Common Issues

#### ❌ "OpenCode CLI not found"
**Solution**:
1. Check if OpenCode is installed: `opencode --version`
2. Set the CLI path manually in settings
3. Use the "Auto-detect" button
4. Enable API fallback in settings

#### ❌ "Connection failed" for Local Models
**Solution**:
1. Verify your local model server is running
2. Check the base URL in settings
3. Use the "Test Connection" button
4. Ensure firewall isn't blocking the connection

#### ❌ "Streaming not working"
**Solution**:
1. Check your internet connection
2. Try a different AI model
3. Enable debug mode for more information
4. Check browser console for errors

#### ❌ "Plugin not loading"
**Solution**:
1. Restart Obsidian
2. Disable and re-enable the plugin
3. Check console for errors (Ctrl+Shift+I)
4. Ensure all required files are in the plugin folder

### Debug Mode
Enable debug mode in settings to get detailed logs:
1. Go to Opensidian Settings → Advanced Settings
2. Enable "Debug mode"
3. Check Obsidian console (Ctrl+Shift+I) for logs

---

## 🛠️ Development

### Project Structure
```
opensidian/
├── src/
│   ├── main.ts                    # Plugin entry point
│   ├── core/                      # Core infrastructure
│   │   ├── agent/                 # OpenCode service integration
│   │   ├── mcp/                   # MCP server management
│   │   ├── storage/               # File storage service
│   │   ├── types/                 # TypeScript definitions
│   │   └── i18n/                  # Internationalization
│   ├── features/
│   │   ├── chat/                  # Chat interface (OpensidianView)
│   │   ├── settings/              # Settings UI
│   │   └── inline-edit/           # Inline text editing
│   └── styles/                    # CSS styles
├── tests/                         # Test files
└── manifest.json                  # Plugin manifest
```

### Building from Source
```bash
# Install dependencies
npm install

# Development (watch mode)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

### Code Style
- **TypeScript**: Strict typing enabled
- **ESLint**: Airbnb style guide with modifications
- **CSS**: BEM-like naming convention with CSS variables
- **Comments**: JSDoc for public APIs

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **OpenCode**: For providing the AI infrastructure
- **Obsidian**: For the amazing note-taking platform
- **MCP Protocol**: For enabling tool calling standardization
- **Claudian**: Inspiration for Obsidian AI integration
- **Contributors**: Everyone who helped build and improve Opensidian

---

## 🔗 Links

- **GitHub Repository**: [https://github.com/yourusername/opensidian](https://github.com/yourusername/opensidian)
- **Issues & Bug Reports**: [GitHub Issues](https://github.com/yourusername/opensidian/issues)
- **Discussions & Support**: [GitHub Discussions](https://github.com/yourusername/opensidian/discussions)
- **Obsidian Forum**: [Obsidian Community](https://forum.obsidian.md/)

---

## 📞 Support

### Quick Help
- Check the [Troubleshooting](#troubleshooting) section
- Search [GitHub Issues](https://github.com/yourusername/opensidian/issues)
- Enable debug mode and check console logs

### Community Support
- Join the [GitHub Discussions](https://github.com/yourusername/opensidian/discussions)
- Ask on the [Obsidian Forum](https://forum.obsidian.md/)
- Check the [Wiki](https://github.com/yourusername/opensidian/wiki) for tutorials

### Reporting Issues
When reporting an issue, please include:
1. Obsidian version
2. Opensidian version
3. Operating system
4. Steps to reproduce
5. Expected vs actual behavior
6. Console errors (if any)

---

<p align="center">
  Made with ❤️ for the Obsidian community
</p>

<p align="center">
  <sub>If you find Opensidian useful, consider giving it a ⭐ on GitHub!</sub>
</p>