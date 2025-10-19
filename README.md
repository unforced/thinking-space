# Thinking Space

> **A spatial interface for Claude via Agent Client Protocol**
> Making AI-powered thinking as approachable as Claude Desktop, with the power of local file access and persistent context.

![Status: Active Development](https://img.shields.io/badge/status-active%20development-yellow)
![Version: 0.1.0](https://img.shields.io/badge/version-0.1.0-blue)
![ACP: v2](https://img.shields.io/badge/ACP-v2-green)

---

## 🎯 What is Thinking Space?

Thinking Space bridges the gap between **Claude Desktop's simplicity** and **Claude Code's power**. It's not just a chat interface—it's a **place to think** with AI.

**Key Concept:** Each "Space" is like a room in your digital memory palace:

- Has its own **context** (via CLAUDE.md file)
- Contains **relevant files** for that type of thinking
- Gives Claude **persistent memory** about what you're working on
- Works **locally** with full file access
- Uses the official **Agent Client Protocol** (ACP v2)

**What Makes Us Different:**

- 🎨 **Simpler than Zed** - Not trying to be a full IDE
- 💪 **More powerful than Claude Desktop** - Local file access, slash commands
- 🖥️ **Better than CLI** - Beautiful GUI, visual feedback
- 🧠 **Space-based organization** - Cognitive science-backed mental model

Built on a solid foundation using Zed's Agent Client Protocol library.

---

## ✨ Current Features

### ✅ Core Functionality (Stable)

- **Streaming chat** with Claude (full ACP v2 integration)
- **MCP Server Support** ⭐ - Connect to GitHub, databases, search, and more!
- **Spaces** - Create unlimited contexts/projects
- **CLAUDE.md context files** - Persistent memory per Space
- **File operations** - Attach, read, write files locally
- **Conversation history** - Full persistence
- **OAuth + API key authentication**
- **Tool call display** - See what Claude is doing
- **Smart permissions** - Auto-approve safe operations
- **Permission queue** - Handle multiple simultaneous requests
- **Token tracking** - Monitor usage in real-time

### 🆕 Latest Features (October 2025)

- **Slash Commands** ⭐ - Type `/` for custom prompt templates
  - 4 starter commands included
  - Create your own in `.claude/commands/`
  - Git-shareable with your team
- **Session Persistence & Context Restoration** ✅ - Full implementation complete!
  - **Per-space session management** - Each Space maintains its own independent session
  - **Automatic context restoration** - Conversations remember full history across app restarts
  - **Intelligent session reuse** - No redundant session creation within conversations
  - **Claude SDK auto-compaction** - Supports 200K+ token conversations automatically
  - **Better than Zed** - We actually restore context; Zed doesn't!
  - Zero configuration required

### 🔜 Coming Soon

1. **Terminal Integration** (1 week) - Embedded terminal via ACP
2. **Multi-Buffer Diff View** (2-3 weeks) - Review AI changes side-by-side
3. **MCP Server UI** (Optional) - GUI for managing MCP servers

See **[dev-docs/NEXT-FEATURES-RECOMMENDATION.md](dev-docs/NEXT-FEATURES-RECOMMENDATION.md)** for detailed roadmap.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+
- **Rust** (latest stable)
- **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com)

### Installation

```bash
# Clone
git clone https://github.com/unforced/thinking-space
cd thinking-space

# Install dependencies
cd src && npm install

# Run in development
npm run tauri dev
```

### First Run

1. Enter your Anthropic API key in Settings (⚙️)
2. Create a Space (e.g., "Research Notes")
3. Start chatting with Claude!
4. Try typing `/` to see slash commands

---

## 📚 Documentation

### 🎯 Start Here

- **This README** - Project overview
- **[dev-docs/README.md](dev-docs/README.md)** - Documentation index ⭐
- **[dev-docs/CURRENT-STATE.md](dev-docs/CURRENT-STATE.md)** - Architecture & status
- **[dev-docs/NEXT-FEATURES-RECOMMENDATION.md](dev-docs/NEXT-FEATURES-RECOMMENDATION.md)** - Roadmap

### For Developers

- **[dev-docs/ACP-LIBRARY-REFERENCE.md](dev-docs/ACP-LIBRARY-REFERENCE.md)** - ACP API guide
- **[dev-docs/TESTING-PLAN.md](dev-docs/TESTING-PLAN.md)** - Testing strategy
- **[dev-docs/PROGRESS-SUMMARY.md](dev-docs/PROGRESS-SUMMARY.md)** - Recent work

### Quick Links by Task

| I want to...                | Read this                                                                   |
| --------------------------- | --------------------------------------------------------------------------- |
| Understand the architecture | [CURRENT-STATE.md](dev-docs/CURRENT-STATE.md)                               |
| Know what to build next     | [NEXT-FEATURES-RECOMMENDATION.md](dev-docs/NEXT-FEATURES-RECOMMENDATION.md) |
| Learn the ACP library       | [ACP-LIBRARY-REFERENCE.md](dev-docs/ACP-LIBRARY-REFERENCE.md)               |
| Set up testing              | [TESTING-PLAN.md](dev-docs/TESTING-PLAN.md)                                 |
| See recent progress         | [PROGRESS-SUMMARY.md](dev-docs/PROGRESS-SUMMARY.md)                         |
| Compare with competitors    | [MISSING-FEATURES-ANALYSIS.md](dev-docs/MISSING-FEATURES-ANALYSIS.md)       |

---

## 🏗️ Architecture

### Tech Stack

- **Frontend:** React + TypeScript + Tailwind CSS
- **Backend:** Rust + Tauri 2
- **ACP:** Official `agent-client-protocol` crate from Zed
- **State:** Zustand
- **DB:** SQLite (rusqlite)
- **Testing:** Vitest + Cargo test

### Project Structure

```
thinking-space/
├── README.md              # This file
├── dev-docs/              # 📚 All documentation
│   ├── README.md          # ⭐ Doc index - start here!
│   ├── CURRENT-STATE.md   # Architecture overview
│   ├── NEXT-FEATURES-RECOMMENDATION.md  # Roadmap
│   └── archive/           # Historical docs
├── src/                   # React frontend
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── services/      # agentService.ts (ACP client)
│   │   └── stores/        # State management
│   └── package.json
└── src-tauri/             # Rust backend
    ├── src/
    │   ├── main.rs
    │   ├── acp_v2/        # ⭐ ACP implementation
    │   ├── commands.rs    # Slash commands
    │   ├── sessions.rs    # Session persistence
    │   ├── spaces.rs      # Space management
    │   └── conversations.rs  # Chat history
    └── Cargo.toml
```

### Data Flow

```
User types message
    ↓
[Frontend] ChatArea.tsx
    ↓
[Frontend] agentService.ts (calls Tauri command)
    ↓
[Backend] AcpManager::send_message()
    ↓
[ACP] claude-code-acp process (via stdio)
    ↓
[Claude API] Anthropic servers
    ↓
[ACP] Session notifications back
    ↓
[Backend] ThinkingSpaceClient callbacks
    ↓
[Backend] Tauri events emitted
    ↓
[Frontend] agentService.ts listeners
    ↓
User sees response streaming in
```

---

## 🛠️ Development

### Commands

```bash
# Development
npm run tauri dev        # Full app with hot reload

# Testing
npm test                 # Frontend tests
npm run test:rust        # Backend tests
npm run test:all         # Everything

# Type checking
npm run typecheck        # Frontend TypeScript
cd src-tauri && cargo check  # Backend Rust

# Building
npm run tauri build      # Production build
```

### Testing

- **Frontend:** Vitest + React Testing Library
- **Backend:** Cargo test with tempfile
- **Coverage:** 87% backend, expanding frontend
- **Strategy:** See [TESTING-PLAN.md](dev-docs/TESTING-PLAN.md)

### Making Changes

**Add a new ACP event:**

1. Emit in `src-tauri/src/acp_v2/client.rs` or `manager.rs`
2. Listen in `src/src/services/agentService.ts`
3. Handle in React component

**Add a new Tauri command:**

1. Add function in relevant `src-tauri/src/*.rs` file
2. Register in `src-tauri/src/main.rs`
3. Call with `invoke()` from frontend

**Add a slash command:**

1. Create `.md` file in any Space's `.claude/commands/` directory
2. Use `$ARGUMENTS` placeholder for user input
3. Share via git for team use

---

## 🎯 Competitive Position

### vs Claude Desktop

- ✅ Slash commands (we have, they don't)
- ✅ MCP servers (we have, they don't yet!)
- ✅ Local file access (unlimited)
- ✅ Persistent context (CLAUDE.md)
- ✅ Session persistence with context restoration

### vs Zed

- ✅ Simpler UX (our advantage)
- ✅ Non-developer focus (our advantage)
- ✅ Same ACP capabilities (we use their library!)
- ⚠️ Not a full IDE (not our goal)

### vs Claude Code CLI

- ✅ Beautiful GUI (our advantage)
- ✅ Slash commands (parity!)
- ✅ MCP servers (parity!)
- ✅ Visual feedback (tool calls, permissions)
- ⚠️ Terminal (coming in 1 week)

**Our Niche:** Power of Claude Code + simplicity of Claude Desktop + unique Space metaphor

---

## 📊 Status Dashboard

| Component      | Status     | Notes                        |
| -------------- | ---------- | ---------------------------- |
| Core ACP       | ✅ Stable  | Full v2 integration          |
| Streaming      | ✅ Stable  | With proper newlines         |
| Permissions    | ✅ Stable  | Smart auto-approval + queue  |
| Tool Calls     | ✅ Stable  | Inline display with status   |
| Slash Commands | ✅ Stable  | Shipped Oct 17, 2025         |
| Session DB     | ⚠️ Backend | Frontend integration pending |
| Terminal       | 🔴 Planned | Next priority (1 week)       |
| MCP Servers    | 🔴 Planned | Critical (2-3 weeks)         |
| Diff View      | 🔴 Planned | High value (3-4 weeks)       |

**Last Updated:** October 18, 2025
**Total Backend Coverage:** 87%
**Recent Commits:** Slash commands, session persistence, permission queue

---

## 🤝 Contributing

We welcome contributions! The project is in active development.

**Good First Issues:**

- Testing on Windows/Linux
- UI polish and animations
- Keyboard shortcuts
- Documentation improvements
- Bug reports with reproduction steps

**Before Contributing:**

1. Read [dev-docs/README.md](dev-docs/README.md) - Doc index
2. Check [dev-docs/CURRENT-STATE.md](dev-docs/CURRENT-STATE.md) - Architecture
3. Review [dev-docs/NEXT-FEATURES-RECOMMENDATION.md](dev-docs/NEXT-FEATURES-RECOMMENDATION.md) - Roadmap
4. See [dev-docs/TESTING-PLAN.md](dev-docs/TESTING-PLAN.md) - Testing approach

**Development Workflow:**

1. Fork the repo
2. Create feature branch
3. Make changes with tests
4. Run `npm run test:all`
5. Submit PR with description

---

## 🙏 Acknowledgments

- **[Zed](https://zed.dev)** - Agent Client Protocol library and reference implementation
- **[Anthropic](https://anthropic.com)** - Claude and the ACP specification
- **[Tauri](https://tauri.app)** - Cross-platform desktop framework
- **Community** - Bug reports, feature requests, and feedback

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 💬 Questions & Support

- **Documentation:** Start at [dev-docs/README.md](dev-docs/README.md)
- **Issues:** [GitHub Issues](https://github.com/unforced/thinking-space/issues)
- **Discussions:** [GitHub Discussions](https://github.com/unforced/thinking-space/discussions)

---

**Built with ❤️ using the official Agent Client Protocol from Zed** 🚀

**Current Focus:** Terminal integration → MCP servers → Diff view
**Join us in building the best Claude experience!**
