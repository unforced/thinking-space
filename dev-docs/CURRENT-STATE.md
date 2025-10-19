# Thinking Space - Current State

**Last Updated:** October 18, 2025
**Status:** ✅ Working - Full ACP Integration with UI Complete + Critical Permission Bug Fixed

---

## What This Is

A desktop application that provides a "thinking space" for interacting with Claude via the Agent Client Protocol (ACP). Built with Tauri (Rust) and React.

## Current Architecture

### Backend (Rust/Tauri)

```
src-tauri/src/
├── main.rs              - Entry point, command registration
├── acp_v2/              - ACP integration (NEW - official library)
│   ├── mod.rs           - Module exports
│   ├── client.rs        - ThinkingSpaceClient (implements Client trait)
│   └── manager.rs       - AcpManager + Tauri commands
├── auth.rs              - Authentication (OAuth + API keys)
├── spaces.rs            - Space/project management
├── conversations.rs     - Conversation persistence
└── settings.rs          - App settings
```

### Frontend (React/TypeScript)

```
src/src/
├── services/
│   ├── agentService.ts  - ACP communication (UPDATED for v2)
│   ├── authService.ts   - Authentication
│   └── ...
├── components/
│   ├── Chat.tsx         - Main chat interface
│   ├── SpaceSelector.tsx
│   └── ...
└── ...
```

---

## ACP Integration (v2)

### What Changed

We **completely rewrote** the ACP integration to use the official `agent-client-protocol` Rust library from Zed instead of manually implementing JSON-RPC.

**Old Approach (removed):**

- Manual JSON-RPC parsing
- `sidecar.rs` + `acp_client.rs`
- Fragile, hard to maintain

**New Approach (current):**

- Official `agent-client-protocol` crate
- Implements proper `Client` trait
- Type-safe, future-proof
- Full feature support

### How It Works

```
User sends message
    ↓
[Frontend] agentService.ts
    ↓
[Tauri Command] agent_v2_send_message
    ↓
[Rust] AcpManager (manager.rs)
    ↓
[ACP Library] ClientSideConnection
    ↓
[Process] claude-code-acp adapter (npx @zed-industries/claude-code-acp)
    ↓
[Claude API] Anthropic servers
    ↓
[Callbacks] ThinkingSpaceClient.session_notification()
    ↓
[Events] agent-message-chunk, tool-call, etc.
    ↓
[Frontend] Event listeners in agentService.ts
    ↓
User sees response
```

### Key Components

**1. AcpManager (manager.rs)**

- Manages connection lifecycle
- Spawns claude-code-acp adapter process
- Handles session creation
- Sends prompts
- Emits completion/error events

**2. ThinkingSpaceClient (client.rs)**

- Implements `Client` trait from ACP library
- Handles callbacks FROM the agent:
  - `session_notification()` - streaming updates
  - `request_permission()` - tool approval
  - `read_text_file()` - file operations
  - `write_text_file()` - file operations

**3. AgentService (agentService.ts)**

- Frontend service for ACP communication
- Calls Tauri commands
- Listens for events
- Manages streaming responses

---

## Events System

### Events Emitted (Backend → Frontend)

| Event                    | Payload                                         | Purpose                |
| ------------------------ | ----------------------------------------------- | ---------------------- |
| `agent-message-chunk`    | `{ sessionId, text }`                           | Streaming message text |
| `tool-call`              | `{ sessionId, toolCallId, title, status, ... }` | New tool usage         |
| `tool-call-update`       | `{ sessionId, toolCallId, status, content }`    | Tool status change     |
| `permission-request`     | `{ request_id, tool_call_id, options, ... }`    | User approval needed   |
| `agent-message-complete` | `{ requestId, stopReason }`                     | Response finished      |
| `agent-message-error`    | `{ requestId, error }`                          | Request failed         |

### Commands Available (Frontend → Backend)

| Command                             | Parameters          | Purpose                       |
| ----------------------------------- | ------------------- | ----------------------------- |
| `agent_v2_start`                    | `{ apiKey }`        | Start ACP adapter             |
| `agent_v2_stop`                     | -                   | Stop adapter                  |
| `agent_v2_send_message`             | `{ params: {...} }` | Send message to Claude        |
| `agent_v2_send_permission_response` | `{ response }`      | Respond to permission request |

---

## What Works

✅ **Core Functionality**

- Send messages to Claude
- Receive streaming responses
- Conversation history maintained
- Working directory context

✅ **Technical Foundation**

- ACP v2 integration with official library
- Type-safe Rust implementation
- Event-based architecture
- Session management
- LocalSet for !Send futures
- Proper async/await handling

✅ **Infrastructure**

- Tool call notifications (fully implemented with UI)
- Permission requests (fully implemented with auto-approval)
- File operations (read/write)
- Error handling with safe object rendering
- Completion tracking
- Request ID correlation across events

✅ **UI Components**

- **ToolCallDisplay** - Inline display of tool usage with status (running/success/failed)
- **PermissionDialog** - Zed-style inline permission requests (amber-highlighted, compact)
- **Auto-approval logic** - Safe operations automatically approved:
  - Web searches (always safe)
  - File reads (when no write fields present)
  - Safe bash commands (ls, grep, cat, find, etc.)
  - Pattern matching (glob, search queries)

✅ **Bug Fixes (October 18, 2025)**

- **Permission Dialog Not Showing** - CRITICAL FIX
  - Issue: Permission dialogs weren't rendering when they arrived before message content
  - Root cause: Conditional rendering logic only showed dialog when `currentStreamingMessage` existed
  - Fix: Changed condition to show if streaming AND (has message OR has tool calls OR has permission)
  - Impact: Users can now actually approve/deny tool operations (was completely broken)

- **Session Recovery** - CRITICAL FIX
  - Issue: Stale session IDs from SQLite caused "Session not found" errors
  - Root cause: App tried to reuse session IDs after ACP adapter restart
  - Fix: Automatic session recovery - detect error, create new session, retry prompt
  - Impact: App no longer hangs on stale sessions, seamless recovery

- **Conversation Context Restoration** - CRITICAL FIX (Updated Oct 18, 2025)
  - Issue: Previous conversations lost context when app restarted
  - Root cause: ACP adapter sessions are in-memory only, lost when app/adapter restarts
  - Solution: Include full conversation history in first prompt when restoring conversations
  - Implementation:
    - Format previous messages with XML tags: `<previous_user>...</previous_user>`, `<previous_assistant>...</previous_assistant>`
    - Prepend formatted history to first user message after restoration
    - Claude Agent SDK sees full conversation and applies automatic context compaction
    - Subsequent messages use normal flow (SDK maintains context within session)
  - Research findings:
    - ✅ claude-code-acp adapter declares `loadSession: true` but only loads from in-memory cache
    - ❌ Sessions are NOT persisted to disk by adapter
    - ❌ Zed also doesn't restore conversation context across restarts
    - ✅ Claude Agent SDK has **built-in automatic context compaction** for 200K+ token conversations
    - ✅ Our approach provides **better UX than Zed** by actually restoring context
  - Impact: Conversations maintain full context across app restarts, leverages SDK's auto-compaction

- **Context Window Management** - NEW FEATURE
  - Research: Analyzed Zed's approach - uses prompt caching, no auto-compaction
  - Implementation: Token counting + visual warnings (amber at 150K, red at 200K)
  - Approach: Rely on Claude's prompt caching (5-min cache, 0.1x cost) for optimization
  - UX: Clear warnings with "Start Fresh" option when approaching limits
  - See: `dev-docs/CONTEXT-MANAGEMENT-2025-10-18.md` for research and design

- **See also:** `dev-docs/PERMISSION-FIX-2025-10-18.md` for permission dialog fixes

✅ **Debug Tools (October 18, 2025)**

- **PermissionTestPanel** - Manual testing component for permission flow
- **Debug info panel** - Shows streaming/permission/tool call state in UI
- **Enhanced logging** - Comprehensive console logging throughout permission flow

---

## What Needs Work

### High Priority (Functionality)

1. ✅ ~~Tool Call UI~~ - **DONE**
2. ✅ ~~Permission Dialog~~ - **DONE**
3. ✅ ~~Auto-approval for safe operations~~ - **DONE**
4. ✅ ~~Permission Request UI Bug~~ - **FIXED** (Oct 18, 2025)
5. **Testing & Polish** - Real-world usage testing
   - Status: Core functionality working, permission flow fixed
   - Need: Remove debug components, user testing, edge case handling

### Medium Priority (Polish)

1. **Error Messages** - Better user-facing errors
2. **Loading States** - UI feedback during operations
3. ✅ ~~**Session Persistence**~~ - **DONE** (October 18, 2025)
   - Sessions automatically saved to SQLite
   - Restored when switching spaces
   - Full conversation context maintained

### Low Priority (Future)

1. **Terminal Support** - ACP supports it, not implemented
2. **Extension Methods** - Custom ACP extensions
3. **Mode Switching** - Different agent modes
4. **Performance** - Optimize if needed

---

## File Structure

### What's Where

**Backend Core:**

- `src-tauri/src/main.rs` - App entry, command registration
- `src-tauri/src/acp_v2/` - ACP integration ⭐ NEW
- `src-tauri/Cargo.toml` - Dependencies

**Frontend Core:**

- `src/src/services/agentService.ts` - ACP communication ⭐ UPDATED
- `src/src/components/Chat.tsx` - Main UI

**Documentation:**

- `CURRENT-STATE.md` - This file (start here!)
- `README.md` - Project overview
- `dev-docs/ACP-LIBRARY-REFERENCE.md` - ACP API reference
- `dev-docs/ACP-V2-COMPLETE.md` - Implementation details
- `FRONTEND-WIRED-UP.md` - Frontend integration guide

**Archived (Historical Context):**

- `dev-docs/ACP-REFACTOR-PLAN.md` - Original refactor plan
- `dev-docs/ACP-REFACTOR-LESSONS.md` - What we learned
- `dev-docs/IMMEDIATE-FIXES.md` - Old fix list (mostly done)

---

## How to Work on This

### Making Changes

**1. Backend (Rust)**

```bash
cd src-tauri
cargo build         # Build
cargo check         # Fast check
cargo clippy        # Linting
```

**2. Frontend (TypeScript)**

```bash
npm run dev        # Dev mode (frontend + backend)
npm run build      # Production build
```

**3. Testing**

```bash
npm run tauri dev  # Full app in dev mode
```

### Common Tasks

**Add a new event:**

1. Emit in `acp_v2/client.rs` or `manager.rs`
2. Listen in `agentService.ts`
3. Handle in React component

**Add a new command:**

1. Add `#[tauri::command]` function in `acp_v2/manager.rs`
2. Register in `main.rs` invoke_handler
3. Call with `invoke()` from frontend

**Debug ACP issues:**

- Check console for `[ACP V2]` logs
- Check frontend console for event logs
- Look at `claude-code-acp` stderr output

---

## Dependencies

### Key Rust Crates

- `agent-client-protocol = "0.4"` - Official ACP library ⭐
- `agent-client-protocol-schema = "0.4"` - ACP types ⭐
- `tauri = "2"` - Desktop framework
- `tokio` - Async runtime
- `serde` - Serialization

### Key NPM Packages

- `@tauri-apps/api` - Tauri frontend API
- `react` - UI framework
- `vite` - Build tool

### External Dependencies

- `npx @zed-industries/claude-code-acp` - ACP adapter process
- Anthropic API - Claude backend

---

## Configuration

### Environment Variables

- `ANTHROPIC_API_KEY` - API key (if not using OAuth)

### User Data Locations

- **macOS:** `~/Library/Application Support/com.thinkingspace.app/`
- **Linux:** `~/.config/thinking-space/`
- **Windows:** `%APPDATA%\thinking-space\`

Contains:

- `settings.json` - App settings
- `spaces/` - User spaces (projects)
- `conversations/` - Chat history

---

## Known Issues / Quirks

1. **First message might be slow** - ACP adapter startup time
2. **Permission dialogs not implemented yet** - Will log to console
3. **Tool calls not shown in UI yet** - Will log to console
4. **Old extraction code still present** - In `agentService.ts`, not used

---

## Next Steps (Recommended Priority)

1. ✅ **Test basic messaging** - Verify current state works
2. 🔨 **Add tool call display** - Show what Claude is doing
3. 🔨 **Add permission dialog** - Let users approve tool usage
4. 📝 **Update README** - Public-facing documentation
5. 🧹 **Remove unused code** - Clean up `extractTextFromEvent()` etc.
6. 🧪 **Add tests** - Rust unit tests, frontend tests
7. 📦 **Improve builds** - Optimize, package for distribution

---

## Getting Help

**Understanding ACP:**

- Read `dev-docs/ACP-LIBRARY-REFERENCE.md`
- Check official docs: https://agentclientprotocol.com/
- Look at test file: `~/.cargo/registry/.../agent-client-protocol-0.4.7/src/rpc_tests.rs`

**Understanding Current Code:**

- Start with this file (CURRENT-STATE.md)
- Read code comments in `acp_v2/`
- Check `FRONTEND-WIRED-UP.md` for integration details

**Debugging:**

- Backend: `println!()` statements with `[ACP V2]` prefix
- Frontend: `console.log()` statements with `[FRONTEND V2]` prefix
- Use browser DevTools for frontend
- Check Tauri console for Rust logs

---

## Summary

We have a **working foundation** with the official ACP library properly integrated. The hard architectural work is done. Now we need to:

1. **Test** - Make sure it works in real usage
2. **Polish** - Add missing UI components (tool calls, permissions)
3. **Clean** - Remove dead code, improve documentation
4. **Ship** - Package and distribute

The codebase is in a good state to move forward confidently. The ACP v2 integration is solid, type-safe, and maintainable.
