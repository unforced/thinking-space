# Thinking Space

> **A spatial interface for Claude Agent SDK**
> Making AI-powered thinking as approachable as Claude Desktop, with the power of local file access and persistent memory.

![Status: MVP Development](https://img.shields.io/badge/status-mvp%20development-yellow)
![Version: 0.1.0](https://img.shields.io/badge/version-0.1.0-blue)

---

## 🎯 Vision

Thinking Space bridges the gap between **Claude Desktop's simplicity** and **Claude Code's power**. It's not just a chat interface—it's a **place to think** with AI, inspired by the Extended Mind principles and the method of loci (memory palaces).

### The Core Insight

People are discovering that Claude Code is more effective than Claude Desktop, even for non-developers. But the CLI interface creates barriers. Thinking Space solves this by:

- Creating **Spaces** - contextual environments for different kinds of thinking
- Giving each Space **memory** through CLAUDE.md files
- Providing **local file access** without file size limits
- Wrapping everything in a **beautiful, approachable UI**

Each Space is like a room in your digital memory palace where Claude understands the context and helps you think.

---

## ✨ Features

### Currently Implemented (MVP)

✅ **Space Management**
- Create new Spaces with Quick Start or Custom templates
- List and switch between Spaces
- Each Space has its own CLAUDE.md for context

✅ **CLAUDE.md Editor**
- Visual editor for Space context and instructions
- Edit directly in the app
- Changes apply immediately to conversations

✅ **Chat Interface**
- Clean, Claude Desktop-style UI
- Message history per Space
- Context-aware conversations

✅ **Backend Infrastructure**
- Rust backend with Tauri 2
- File system integration (~/.thinking-space/)
- Secure Space storage and management

### Coming Soon (Post-MVP)

🔲 **Claude Agent SDK Integration**
- Real AI-powered responses (currently placeholder)
- Local file operations
- Full Agent SDK capabilities

🔲 **Settings Panel**
- API key management
- Theme selection (light/dark)
- Data location preferences

🔲 **File Operations**
- Attach files to messages
- Claude can read/write within Spaces
- Permission system for external files

🔲 **Enhanced Features**
- Search across Spaces
- Session history
- MCP server integration
- Usage analytics

---

## 🏗️ Architecture

### Tech Stack

**Frontend**
- React 18 + TypeScript
- Vite 7 for blazing-fast builds
- Tailwind CSS v3 for styling
- Zustand for state management

**Backend**
- Tauri 2 (Rust + WebView)
- Native file system access
- Secure command execution
- SQLite for metadata (future)

**Agent Integration** (Planned)
- Claude Agent SDK via Node.js sidecar
- JSON-RPC communication
- Full ACP protocol support later

### Project Structure

```
thinking-space/
├── dev-docs/              # Vision, architecture, and planning
│   ├── 00-research-findings.md
│   ├── 01-vision.md
│   ├── 02-architecture.md
│   └── 03-mvp-scope.md
├── src/                   # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── stores/        # Zustand state management
│   │   └── App.tsx        # Main application
│   └── package.json
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── main.rs        # Entry point
│   │   └── spaces.rs      # Space management
│   └── Cargo.toml
└── CLAUDE.md              # Project instructions for Claude
```

### Data Storage

```
~/.thinking-space/
└── spaces/
    ├── {space-id-1}/
    │   ├── CLAUDE.md
    │   ├── .space-metadata.json
    │   └── [user files]
    └── {space-id-2}/
        └── ...
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v18 or later)
- **Rust** (latest stable)
- **Tauri CLI** (installed via npm)

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd thinking-space

# Install frontend dependencies
cd src
npm install

# Run the app in development mode
cd ..
npx @tauri-apps/cli dev
```

The app will:
1. Start the Vite dev server on http://localhost:5173 (or next available port)
2. Build and launch the Tauri desktop application
3. Open the Thinking Space window

### First Time Setup

1. **Create your first Space**
   - Click "+ New Space" in the sidebar
   - Give it a name (e.g., "Personal Notes")
   - Choose "Quick Start" template
   - Click "Create Space"

2. **Edit CLAUDE.md**
   - Click "📝 Edit CLAUDE.md" in the sidebar
   - Customize the instructions for this Space
   - Save your changes

3. **Start thinking!**
   - Type a message in the chat input
   - Claude will respond with context from your CLAUDE.md
   - (Note: Currently shows placeholder responses until Agent SDK is integrated)

---

## 📖 Documentation

### For Users

- See [`dev-docs/01-vision.md`](dev-docs/01-vision.md) for the full vision and philosophy
- See [`dev-docs/03-mvp-scope.md`](dev-docs/03-mvp-scope.md) for current feature scope

### For Developers

- See [`dev-docs/02-architecture.md`](dev-docs/02-architecture.md) for technical details
- See [`dev-docs/00-research-findings.md`](dev-docs/00-research-findings.md) for background research
- See [`CLAUDE.md`](CLAUDE.md) for development guidelines

### Key Concepts

**Spaces**: Contextual environments for different types of thinking. Each Space has:
- A unique name and ID
- Its own CLAUDE.md file with context and instructions
- Its own file storage
- Independent conversation history

**CLAUDE.md**: The memory file for each Space. Contains:
- Purpose: What this Space is for
- Context: Background Claude should know
- Guidelines: How Claude should behave here

**Templates**: Pre-configured CLAUDE.md structures:
- **Quick Start**: Basic structure with purpose, context, guidelines
- **Custom**: Blank slate for advanced users

---

## 🎨 Design Principles

1. **Simplicity First** - No steep learning curve, approachable for non-developers
2. **Spatial Memory** - Leverage human cognitive patterns (method of loci)
3. **Intentionality Over Chaos** - CLAUDE.md prevents file sprawl
4. **Local First** - Privacy by design, fast performance
5. **Flexible, Not Prescriptive** - No forced PARA or GTD methodology

---

## 🛣️ Roadmap

### Phase 1: Foundation (Current - MVP)
- ✅ Basic Space management
- ✅ CLAUDE.md editing
- ✅ Chat interface
- ✅ Tauri infrastructure
- 🔲 Claude Agent SDK integration

### Phase 2: Enhancement
- File handling and preview
- Settings panel
- Search and navigation
- Template library
- Session history

### Phase 3: Power Features
- MCP server integration
- Custom commands/workflows
- Usage analytics
- Multi-agent support (via ACP)

### Phase 4: Ecosystem
- Sharing and collaboration
- Cloud sync (optional)
- Mobile companion app
- Plugin system

---

## 🤝 Contributing

This is currently in active MVP development. Contributions welcome once we reach a stable release!

### Development Workflow

```bash
# Run in development mode
npx @tauri-apps/cli dev

# Build for production
npx @tauri-apps/cli build

# Run tests (when added)
npm test
```

---

## 📝 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

- **Annie Murphy Paul** for "The Extended Mind" - inspiring the spatial thinking approach
- **Anthropic** for Claude and the Agent SDK
- **Zed** and **Google** for pioneering the Agent Client Protocol
- **Tiago Forte** for PARA (even though we didn't use it directly!)
- Everyone using Claude Code in creative non-developer ways

---

## 📧 Contact

Questions? Feedback? Open an issue or start a discussion!

---

**Built with ❤️ for thoughtful AI interaction**
