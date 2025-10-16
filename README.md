# Thinking Space

> **A spatial interface for Claude via Agent Client Protocol**
> Making AI-powered thinking as approachable as Claude Desktop, with the power of local file access and persistent context.

![Status: Active Development](https://img.shields.io/badge/status-active%20development-yellow)
![Version: 0.1.0](https://img.shields.io/badge/version-0.1.0-blue)

---

## 🎯 What is Thinking Space?

Thinking Space bridges the gap between **Claude Desktop's simplicity** and **Claude Code's power**. It's not just a chat interface—it's a **place to think** with AI.

**Key Concept:** Each "Space" is like a room in your digital memory palace:

- Has its own **context** (via CLAUDE.md file)
- Contains **relevant files** for that type of thinking
- Gives Claude **persistent memory** about what you're working on
- Works **locally** with full file access
- Uses the official **Agent Client Protocol** (ACP)

Built on a solid foundation using Zed's Agent Client Protocol library.

---

## ✨ Current State

### ✅ What Works

**Core Functionality**

- ✅ Send messages to Claude and receive streaming responses
- ✅ Create and manage Spaces (projects/contexts)
- ✅ CLAUDE.md context file editing
- ✅ File attachments and artifact viewing
- ✅ Conversation history within sessions
- ✅ Working directory context for file operations

**Technical Foundation**

- ✅ Official ACP v2 integration using `agent-client-protocol` crate
- ✅ Type-safe Rust backend
- ✅ Event-based architecture
- ✅ Session management
- ✅ Authentication (OAuth + API keys)

### 🔨 Known Gaps (In Progress)

**UI Components Needed:**

- Tool call visualization (events emitted, needs display)
- Permission approval dialogs (infrastructure ready)
- Better loading states

**Features To Add:**

- Session persistence across app restarts
- Search across conversations
- Keyboard shortcuts
- Better error messages

**For Complete Status:** See [`CURRENT-STATE.md`](CURRENT-STATE.md)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18 or later
- **Rust** latest stable
- **Anthropic API key** from [console.anthropic.com](https://console.anthropic.com)

### Installation

```bash
# Clone and install
git clone <your-repo-url>
cd para-claude-v2

# Install frontend dependencies
cd src
npm install

# Run in development mode
npm run tauri dev
```

First build takes a few minutes (Rust compilation). Subsequent runs are faster.

### First Use

1. **Enter API Key**
   - Open Settings (⚙️)
   - Enter your Anthropic API key
   - Click Save

2. **Create a Space**
   - Click "+ New Space"
   - Name it (e.g., "Research Notes")
   - Choose a template
   - Click "Create Space"

3. **Start Chatting**
   - Type a message
   - Watch Claude respond in real-time
   - Attach files with paperclip icon or drag-drop

---

## 📁 Project Structure

```
para-claude-v2/
├── CURRENT-STATE.md          # ⭐ START HERE - Complete overview
├── README.md                  # This file
├── FRONTEND-WIRED-UP.md      # Frontend integration details
├── src/                       # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   ├── services/         # Agent communication
│   │   │   └── agentService.ts  # ACP v2 integration
│   │   ├── stores/           # State management
│   │   └── App.tsx
│   └── package.json
├── src-tauri/                 # Rust backend
│   ├── src/
│   │   ├── main.rs           # Entry point
│   │   ├── acp_v2/           # ⭐ ACP implementation
│   │   │   ├── client.rs     # Client trait implementation
│   │   │   └── manager.rs    # Connection manager
│   │   ├── spaces.rs         # Space management
│   │   ├── auth.rs           # Authentication
│   │   ├── conversations.rs  # Persistence
│   │   └── settings.rs       # App settings
│   └── Cargo.toml
└── dev-docs/                  # Developer documentation
    ├── README.md             # Doc index
    ├── ACP-LIBRARY-REFERENCE.md   # ACP API guide
    ├── ACP-V2-COMPLETE.md    # Implementation details
    └── archive/              # Historical docs
```

---

## 🏗️ Architecture

### High-Level Flow

```
User → Chat UI → AgentService → Tauri Commands → AcpManager → ACP Library → Claude API
                                                     ↓
                                           ThinkingSpaceClient
                                                     ↓
                                              Event Emissions
                                                     ↓
                                           AgentService Listeners
                                                     ↓
                                                 Chat UI
```

### Key Components

**Backend (Rust):**

- `AcpManager` - Manages ACP connection lifecycle
- `ThinkingSpaceClient` - Implements ACP `Client` trait for callbacks
- Uses official `agent-client-protocol` crate from Zed

**Frontend (TypeScript):**

- `AgentService` - Manages communication with backend
- Event-based streaming (no polling)
- React components for UI

### Events System

**Backend → Frontend:**

- `agent-message-chunk` - Streaming text
- `tool-call` - Tool usage notifications
- `tool-call-update` - Tool status changes
- `permission-request` - Approval requests
- `agent-message-complete` - Response finished
- `agent-message-error` - Errors

**Frontend → Backend:**

- `agent_v2_start(apiKey)` - Start ACP adapter
- `agent_v2_send_message(params)` - Send message
- `agent_v2_stop()` - Stop adapter
- `agent_v2_send_permission_response(response)` - Approval response

---

## 📚 Documentation

### For Users

- **This README** - Getting started
- **CURRENT-STATE.md** - What works, what doesn't, current priorities

### For Developers

- **CURRENT-STATE.md** - Architecture overview, how everything fits together
- **dev-docs/ACP-LIBRARY-REFERENCE.md** - Complete ACP API reference
- **dev-docs/ACP-V2-COMPLETE.md** - Implementation details and decisions
- **FRONTEND-WIRED-UP.md** - Frontend integration guide

### Historical Context

- **dev-docs/ACP-REFACTOR-LESSONS.md** - What we learned migrating to ACP v2
- **dev-docs/archive/** - Old planning docs (kept for reference)

---

## 🛠️ Development

### Commands

```bash
# Development
npm run tauri dev        # Full app with hot reload

# Building
npm run tauri build      # Production build
cd src-tauri && cargo build  # Backend only

# Testing
cd src-tauri && cargo check  # Fast type check
cd src-tauri && cargo test   # Run tests
```

### Making Changes

1. **Backend changes** → Edit `src-tauri/src/acp_v2/`
2. **Frontend changes** → Edit `src/src/`
3. **Events** → Add in backend, listen in `agentService.ts`
4. **Commands** → Add to `manager.rs`, register in `main.rs`

See `CURRENT-STATE.md` for detailed development guide.

---

## 🎯 Immediate Next Steps

1. **Test thoroughly** - Real-world usage, find bugs
2. **Add tool call UI** - Display what Claude is doing
3. **Add permission dialogs** - User approval for file operations
4. **Improve error handling** - Better user-facing messages
5. **Add loading states** - UI feedback during operations

---

## 🙏 Acknowledgments

- **Zed** - Agent Client Protocol library and patterns
- **Anthropic** - Claude and the Agent Client Protocol specification
- **Tauri** - Cross-platform desktop framework

---

## 📝 License

MIT License - see LICENSE file for details

---

## 💬 Contributing

We're in active development. Contributions welcome!

**Good First Issues:**

- Testing on Windows/Linux
- Improving error messages
- Adding keyboard shortcuts
- Documentation improvements
- UI polish

**Read First:**

- `CURRENT-STATE.md` - Understand current architecture
- `dev-docs/README.md` - Developer documentation index

---

## 📧 Questions?

- **Bugs/Features:** Open an issue
- **Development:** Read `CURRENT-STATE.md`
- **ACP Questions:** Check `dev-docs/ACP-LIBRARY-REFERENCE.md`

---

**Built with the official Agent Client Protocol from Zed** 🚀
