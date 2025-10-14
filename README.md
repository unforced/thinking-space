# Thinking Space

> **A spatial interface for Claude Agent SDK**
> Making AI-powered thinking as approachable as Claude Desktop, with the power of local file access and persistent memory.

![Status: MVP Development](https://img.shields.io/badge/status-mvp%20development-yellow)
![Version: 0.1.0](https://img.shields.io/badge/version-0.1.0-blue)

---

## 🎯 What is Thinking Space?

Thinking Space bridges the gap between **Claude Desktop's simplicity** and **Claude Code's power**. It's not just a chat interface—it's a **place to think** with AI.

**Key Concept:** Each "Space" is like a room in your digital memory palace:

- Has its own **context** (via CLAUDE.md)
- Contains **relevant files** for that type of thinking
- Gives Claude **persistent memory** about what you're working on
- Works **locally** with full file access (no size limits)

Built for non-developers who want AI assistance with local files and context.

---

## ✨ What's Working Now

### ✅ Core Features (Ready to Use)

**Space Management**

- Create Spaces with Quick Start or Custom templates
- Switch between multiple Spaces in sidebar
- Each Space has independent context and files

**Claude Agent SDK Integration**

- Real AI conversations powered by Claude Sonnet 4
- Streaming responses in real-time
- Tool use indicators (WebSearch, Read, Write, Bash, Grep)
- Uses Claude Code OAuth or API key

**Chat Interface**

- Markdown rendering with syntax highlighting
- Code blocks, lists, tables, formatting
- Conversation history maintained across messages
- Smooth streaming as Claude responds

**CLAUDE.md Editor**

- Visual Monaco editor for Space context
- Edit instructions Claude should follow
- Changes apply immediately to conversations

**File Operations**

- Drag-and-drop file attachments
- Files included as context in messages
- Artifact viewer to browse Space files
- Click to open files in default app

### 🔨 Known Limitations (MVP Phase)

- Conversations don't persist after app restart yet
- Settings panel incomplete (no theme toggle)
- No permission dialogs for file access (auto-allows within Space)
- No welcome screen for first-time users
- No keyboard shortcuts yet

**See full status:** [`docs/STATUS.md`](docs/STATUS.md)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or later
- **Rust** latest stable
- **Claude Code OAuth** (recommended) or Anthropic API key

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd thinking-space

# Install frontend dependencies
cd src
npm install

# Run in development mode
npm run tauri dev
```

The app will build and launch automatically. (First time may take a few minutes to compile Rust code.)

### First Time Setup

**Option A: Use Claude Code OAuth (Recommended)**

1. Install and authenticate with [Claude Code](https://code.anthropic.com)
2. Launch Thinking Space - it will automatically use your existing auth
3. Create your first Space and start chatting!

**Option B: Use API Key**

1. Get an API key from [Anthropic Console](https://console.anthropic.com)
2. Open Settings (⚙️) in Thinking Space
3. Enter your API key
4. Create your first Space and start chatting!

### Quick Start Guide

1. **Create a Space**
   - Click "+ New Space"
   - Name it (e.g., "Book Research")
   - Choose "Quick Start" template
   - Click "Create Space"

2. **Customize CLAUDE.md**
   - Click "📝 Edit CLAUDE.md"
   - Add context about what you're working on
   - Add any guidelines for Claude
   - Save

3. **Start Conversing**
   - Type a message in the chat
   - Claude will respond with your Space context in mind
   - Attach files with the paperclip icon or drag-drop

4. **View Space Files**
   - Click "📁 View Files" to browse your Space directory
   - Click any file to open in default app

---

## 📖 Documentation

### Essential Reading

- **[STATUS.md](docs/STATUS.md)** - Current implementation state, what's built, what's not
- **[VISION.md](docs/VISION.md)** - Why this exists, design philosophy
- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** - How it's built technically

### Project Structure

```
thinking-space/
├── docs/                      # Documentation
│   ├── STATUS.md             # Current state (read this first!)
│   ├── VISION.md             # Product vision
│   ├── ARCHITECTURE.md       # Technical architecture
│   ├── MVP-SCOPE.md          # What we're building for v1
│   └── archive/              # Historical docs
├── src/                       # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── stores/           # State management (Zustand)
│   │   ├── services/         # Agent SDK, auth
│   │   └── App.tsx
│   └── package.json
├── src-tauri/                 # Rust backend
│   ├── src/
│   │   ├── main.rs           # Entry point
│   │   ├── spaces.rs         # Space management
│   │   ├── auth.rs           # Authentication
│   │   └── sidecar.rs        # Agent SDK communication
│   └── sidecar/
│       └── agent-server.js   # Node.js Agent SDK wrapper
└── CLAUDE.md                  # Instructions for AI assistants
```

### Data Storage

```
~/.thinking-space/
└── spaces/
    ├── {space-id-1}/
    │   ├── CLAUDE.md              # Context for this Space
    │   ├── .space-metadata.json   # Created date, etc.
    │   └── [your files]           # Work files
    └── {space-id-2}/
        └── ...

~/.config/claude-code/          # OAuth tokens (read-only)
```

---

## 🎨 Key Concepts

### Spaces

Contextual environments for different types of thinking. Like rooms in a memory palace:

- **Book Research** - Notes, quotes, outlines
- **Newsletter Writing** - Drafts, ideas, past issues
- **Personal Finance** - Statements, budget tracking
- **Learning Rust** - Code examples, notes, exercises

Each Space is completely independent with its own context and files.

### CLAUDE.md

The "memory" file for each Space. Tells Claude:

- **Purpose** - What this Space is for
- **Context** - Background information
- **Guidelines** - How Claude should behave here

This is automatically included in every conversation in that Space.

### Templates

Pre-configured CLAUDE.md structures:

- **Quick Start** - Simple structure (purpose, context, guidelines)
- **Custom** - Blank slate for power users

---

## 🛣️ Roadmap

### Current Phase: MVP (85% complete)

- ✅ Space management
- ✅ Claude Agent SDK integration
- ✅ Chat with markdown rendering
- ✅ File attachments
- ✅ CLAUDE.md editor
- 🔨 Conversation persistence
- 🔨 Settings panel
- 🔨 Permission system

### Next Phase: Polish & Launch

- Welcome screen / onboarding
- Keyboard shortcuts
- Better error handling
- Performance optimization
- Packaging for macOS/Windows/Linux

### Future Phases

- Search across Spaces
- Session history
- MCP server integration
- Usage analytics
- Templates library
- Multi-agent support (ACP)

**See detailed roadmap:** [`docs/MVP-SCOPE.md`](docs/MVP-SCOPE.md)

---

## 🤝 Contributing

Currently in active MVP development. Contributions welcome!

### Development Commands

```bash
# Run in dev mode (auto-reload)
npm run tauri dev

# Build for production
npm run tauri build

# Build frontend only
cd src && npm run build

# Check Rust code
cd src-tauri && cargo check
```

### Contribution Ideas

- Test on Windows/Linux (currently Mac-focused)
- Report bugs or UX issues
- Suggest features
- Improve documentation
- Add keyboard shortcuts
- Optimize performance

---

## 🙏 Acknowledgments

- **Annie Murphy Paul** - "The Extended Mind" inspired the spatial approach
- **Anthropic** - Claude and the Agent SDK
- **Zed** - Agent Client Protocol and authentication patterns
- Everyone using Claude Code creatively for non-dev tasks

---

## 📝 License

MIT License - see LICENSE file for details

---

## 📧 Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check [`docs/STATUS.md`](docs/STATUS.md) for current state

---

**Built with ❤️ for thoughtful AI interaction**
