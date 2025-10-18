# Next Features Recommendation - Leveraging Zed's ACP Implementation

**Date:** October 17, 2025
**Context:** Post slash-commands & session-persistence implementation
**Strategy:** Maximize leverage of Zed's work, minimize custom code

---

## Executive Summary

After analyzing Zed's ACP implementation, the official ACP library, and our current codebase, here are the **optimal next features** in priority order:

**🎯 Top Recommendation: Finish Session Persistence Frontend (1-2 hours)**
- Quick win, high user value
- Completes Priority #2 feature
- No Zed dependency needed

**🚀 Second Priority: Terminal Integration via ACP (1 week)**
- **Zed already implemented this in the ACP library**
- We can directly use their types and patterns
- Gives us embedded terminal support "for free"
- Differentiates us from Claude Desktop

**⭐ Third Priority: MCP Server Integration (2-3 weeks)**
- **Critical for competitive parity**
- Zed has reference implementation we can study
- ACP library has MCP types we can use
- Anthropic is pushing this heavily

**🔮 Fourth Priority: Multi-Buffer Diff View (3-4 weeks)**
- Complex but high value
- Can study Zed's implementation
- Key differentiator from CLI

---

## Feature #1: Session Persistence Frontend (FINISH IT!)

### Why First
- Backend already complete (367 lines, committed)
- Just needs frontend integration
- High user value (seamless resumption)
- Quick win before tackling harder features

### Implementation (1-2 hours)

**1. Hook ACP Manager to Save Session IDs**
```typescript
// In agentService.ts after session creation
const sessionId = response.session_id;
await invoke('save_session', {
  session: {
    session_id: sessionId,
    space_id: currentSpace.id,
    created_at: Date.now(),
    last_active: Date.now(),
    is_active: true,
    metadata: {}
  }
});
```

**2. Check for Active Session on Space Load**
```typescript
// In spacesStore.ts when switching spaces
const activeSession = await invoke('get_active_session_for_space', {
  spaceId: space.id
});

if (activeSession) {
  // Resume existing session
  await agentService.resumeSession(activeSession.session_id);
} else {
  // Create new session
  await agentService.startNewSession();
}
```

**3. Deactivate on Session End**
```typescript
// When user explicitly starts new session or app closes
await invoke('deactivate_session', { sessionId: currentSessionId });
```

**Status:** ✅ **RECOMMENDED - Do this first**

---

## Feature #2: Terminal Integration via ACP (Leverage Zed!)

### Why This is Perfect for Us

**Zed already implemented terminal support in the ACP library!** We can use their types and patterns directly.

### What Zed Provides

From the ACP library (`agent-client-protocol-schema`):
```rust
// Terminal types (already in the library we use!)
CreateTerminalRequest
CreateTerminalResponse
TerminalOutputRequest
TerminalOutputResponse
KillTerminalCommandRequest
WaitForTerminalExitRequest
ReleaseTerminalRequest
```

### What We Get
- Embedded terminal in our UI
- Agent can request terminal access
- User approves/denies terminal commands
- Real-time terminal output
- Terminal session management

### Implementation Plan (1 week)

**Backend (Rust) - 2 days:**
1. Add terminal trait methods to `ThinkingSpaceClient`
   - `create_terminal()` - Spawn PTY process
   - `terminal_output()` - Stream terminal output
   - `kill_terminal_command()` - Stop running command
   - `wait_for_terminal_exit()` - Wait for completion
   - `release_terminal()` - Clean up terminal

2. Use existing Rust crates:
   - `portable-pty` or `tokio-pty-process` for PTY management
   - Already have tokio for async

**Frontend (React) - 3 days:**
1. Terminal component using `xterm.js`
2. Terminal permission dialog
3. Output streaming to terminal
4. Terminal lifecycle management

**Why This is Smart:**
- ✅ Zed already figured out the protocol
- ✅ Types already in ACP library
- ✅ Don't have to design the interaction pattern
- ✅ Just follow their implementation
- ✅ Differentiates us from Claude Desktop (they don't have this)
- ✅ Professional IDE feel

**Status:** ✅ **RECOMMENDED - High leverage of Zed's work**

---

## Feature #3: MCP Server Integration (Study Zed's Implementation)

### Why Important
- **Critical for competitive parity with Claude Code**
- Enables connecting to GitHub, databases, Sentry, Linear, etc.
- Hundreds of pre-built MCP servers available
- Anthropic is pushing MCP heavily

### How to Leverage Zed

**1. Study Zed's MCP Extension System**
- Zed has MCP server extensions: `zed.dev/docs/extensions/mcp-extensions`
- They configure servers in `context_servers` section
- Reference: `github.com/zed-industries/zed/discussions/21455`

**2. Use ACP Library Types (If Available)**
- Check if ACP library has MCP-related types
- If not, implement using Zed's pattern

**3. Configuration Format**
Follow Zed's proven pattern:
```json
{
  "context_servers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "uvx",
      "args": ["mcp-server-postgres", "--connection-string", "${DATABASE_URL}"]
    }
  }
}
```

### Implementation Plan (2-3 weeks)

**Week 1: Backend Infrastructure**
1. MCP server process spawning (similar to ACP adapter)
2. Configuration file support (`.mcp.json`)
3. Environment variable expansion
4. Server lifecycle management
5. Health checking

**Week 2: Frontend UI**
1. MCP server configuration panel
2. Server list/add/remove
3. Server status indicators
4. Configuration editor
5. Environment variable input

**Week 3: Integration & Testing**
1. Connect MCP servers to ACP sessions
2. Expose MCP tools to Claude
3. Permission handling for MCP operations
4. Test with popular servers (GitHub, Sentry, etc.)
5. Documentation and examples

**Key Zed References:**
- Zed MCP extensions: `zed.dev/docs/extensions/mcp-extensions`
- Zed config discussion: `github.com/zed-industries/zed/discussions/21455`
- ACP + MCP integration: `zed.dev/blog/bring-your-own-agent-to-zed`

**Status:** ✅ **RECOMMENDED - Critical feature with Zed references**

---

## Feature #4: Multi-Buffer Diff View (Study, Then Build)

### Why Important
- Core value proposition of editor-based ACP
- Trust and transparency for AI changes
- Key differentiator from CLI

### How to Leverage Zed

**Study Zed's Implementation:**
1. Zed shows file changes in multi-buffer with syntax highlighting
2. Side-by-side diff view for reviewing changes
3. Approve/reject individual changes
4. Language server integration

**Don't Copy, Learn:**
- Understand their UX patterns
- See how they handle multi-file diffs
- Study their approval workflow
- Then build our own simpler version

### Implementation Plan (3-4 weeks)

**Week 1: Monaco Editor Integration**
1. Add Monaco editor to project
2. Syntax highlighting for common languages
3. Diff view component
4. File switching

**Week 2: Diff Tracking**
1. Track file changes from tool calls
2. Generate diffs
3. Multi-file diff manager
4. Change grouping by tool call

**Week 3: Approval Workflow**
1. Approve/reject UI
2. Partial approval (line-by-line)
3. Apply changes to actual files
4. Undo/redo support

**Week 4: Polish & Testing**
1. Performance optimization
2. Large file handling
3. Edge cases
4. User testing

**Status:** ⚠️ **RECOMMENDED - But do after terminal & MCP**

---

## Features NOT to Build (Let Zed Handle)

### ❌ Multi-Agent Switching
- **Why Skip:** Most users just want Claude
- **Zed Advantage:** They support multiple agents natively
- **Our Position:** Focus on best Claude experience
- **Future:** Maybe add when agent ecosystem matures

### ❌ Headless/CI Mode
- **Why Skip:** Niche enterprise feature
- **Zed Advantage:** They're targeting developers
- **Our Position:** Focus on interactive GUI use
- **Future:** Maybe add if enterprise demand

### ❌ Plugin System (Like Claude Code 2.0.13)
- **Why Skip:** Very complex, takes months
- **Zed Advantage:** They have mature extension system
- **Our Position:** MCP servers provide extensibility
- **Future:** Maybe add when core features solid

---

## Recommended Roadmap (Next 6 Weeks)

### Week 1: Session Persistence + Planning
- **Days 1-2:** Finish session persistence frontend (2 hours)
- **Days 3-5:** Research terminal integration, design approach
- **Deliverable:** Complete session persistence, terminal design doc

### Weeks 2-3: Terminal Integration
- **Week 2:** Backend (PTY, ACP integration, Tauri commands)
- **Week 3:** Frontend (xterm.js, UI, permissions, testing)
- **Deliverable:** Working embedded terminal

### Weeks 4-6: MCP Server Integration
- **Week 4:** Backend (server spawning, config, lifecycle)
- **Week 5:** Frontend (UI, configuration, management)
- **Week 6:** Integration, testing, documentation
- **Deliverable:** MCP server support with 3+ working examples

### Beyond Week 6: Multi-Buffer Diff
- Start research and design
- Learn from Zed's patterns
- Build simpler, focused version
- **Deliverable:** Diff view for file changes

---

## Why This Roadmap is Smart

### ✅ Leverage Existing Work
- Terminal: Use Zed's ACP types directly
- MCP: Study Zed's configuration patterns
- Diff View: Learn from Zed's UX, build our own

### ✅ Build on Our Strengths
- **Simpler UX:** Not trying to be full IDE like Zed
- **Non-developer focus:** Terminal + MCP accessible to all
- **Desktop app:** Better than CLI, more private than web

### ✅ Competitive Positioning

**vs Claude Desktop:**
- ✅ Slash commands (we have, they don't)
- ✅ Session persistence (we'll have)
- ✅ Terminal (we'll have, they don't)
- ✅ MCP servers (we'll have, they'll have too)

**vs Zed:**
- ✅ Simpler UX (our advantage)
- ✅ Non-developer focus (our advantage)
- ✅ Same ACP capabilities (leverage their work)
- ⚠️ Not trying to be full IDE (not our goal)

**vs Claude Code CLI:**
- ✅ GUI (our advantage)
- ✅ Slash commands (parity achieved!)
- ✅ Session persistence (almost there)
- ✅ Terminal (we'll have via ACP)
- ✅ MCP servers (we'll have)

---

## Technical Deep Dives

### Terminal Integration: Using Zed's ACP Types

The ACP library already has terminal support! We just need to implement the client trait methods:

```rust
// These types are ALREADY in agent-client-protocol-schema
use agent_client_protocol_schema::{
    CreateTerminalRequest,
    CreateTerminalResponse,
    TerminalOutputRequest,
    TerminalOutputResponse,
    KillTerminalCommandRequest,
    WaitForTerminalExitRequest,
    ReleaseTerminalRequest,
};

// In our ThinkingSpaceClient implementation
impl Client for ThinkingSpaceClient {
    // ... existing methods ...

    async fn create_terminal(
        &self,
        request: CreateTerminalRequest,
    ) -> Result<CreateTerminalResponse, Error> {
        // Spawn PTY process
        // Return terminal ID
    }

    async fn terminal_output(
        &self,
        request: TerminalOutputRequest,
    ) -> Result<TerminalOutputResponse, Error> {
        // Read from PTY
        // Return output
    }

    // ... other terminal methods ...
}
```

**This is essentially free functionality** because Zed already designed the protocol!

### MCP Integration: Configuration Pattern

Follow Zed's proven configuration format:

```typescript
// .mcp.json in each Space
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "postgres": {
      "command": "uvx",
      "args": ["mcp-server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "${SPACE_PATH}"]
    }
  }
}
```

Then in Rust:
```rust
// Spawn MCP server process
let mut cmd = Command::new(&config.command);
cmd.args(&config.args);

// Expand environment variables
for (key, value) in &config.env {
    let expanded = expand_env_var(value);
    cmd.env(key, expanded);
}

let child = cmd
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?;
```

---

## Conclusion

**🎯 Recommended Next Steps:**

1. **This Week:** Finish session persistence frontend (1-2 hours)
2. **Next 2 Weeks:** Terminal integration (leverage Zed's ACP types)
3. **Following 3 Weeks:** MCP server integration (study Zed's patterns)
4. **Then:** Multi-buffer diff view (learn from Zed, build our own)

**Why This is Optimal:**
- ✅ Maximum leverage of Zed's engineering work
- ✅ Minimum custom code for us to maintain
- ✅ Focus on our strengths (simple UX, non-dev users)
- ✅ Competitive parity on critical features
- ✅ Clear path to MVP with all high-priority features

**Key Insight:** We don't need to compete with Zed on IDE features. We compete on **simplicity and accessibility** while leveraging their excellent ACP implementation work. Terminal + MCP + Diff View gives us professional capabilities without the IDE complexity.

🚀 **Ready to build!**
