# ACP (Agent Client Protocol) Analysis & Comparison

**Created:** October 14, 2025
**Purpose:** Deep dive into Zed's ACP integration and comparison with our implementation

---

## Executive Summary

### What is ACP?

**Agent Client Protocol (ACP)** is an open standard that enables any coding agent to work with any code editor/IDE. Think "LSP for AI agents" - it standardizes communication between editors and AI coding assistants.

**Key Benefits:**
- Editor-agnostic (works with Zed, Emacs, Neovim, JetBrains, etc.)
- Agent-agnostic (Claude Code, Gemini, Goose, etc.)
- Standardized permissions and tool calls
- Streaming support
- Session management

**Maintained by:** Originally Zed Industries, now under `agentclientprotocol` organization

---

## Technical Deep Dive

### ACP Protocol Architecture

```
┌──────────────────────────────────────────────┐
│           Editor/IDE (Client)                │
│                                               │
│  - Sends user messages                       │
│  - Approves/denies tool permissions          │
│  - Streams responses to UI                   │
│  - Manages sessions                          │
└──────────────────────────────────────────────┘
                    ▲ ▼
            JSON-RPC over stdio
            (newline-delimited JSON)
                    ▲ ▼
┌──────────────────────────────────────────────┐
│         Agent Process (Server)               │
│                                               │
│  - Receives messages via stdin               │
│  - Sends responses via stdout                │
│  - Requests tool permissions                 │
│  - Streams events                            │
└──────────────────────────────────────────────┘
```

### Core JSON-RPC Methods

**From Client → Agent:**

1. **`initialize`**
   - Negotiate protocol version and capabilities
   - Exchange supported auth methods
   - Define client capabilities (tools, context types)

2. **`session/new`**
   - Create new conversation context
   - Specify working directory, model, parameters

3. **`session/prompt`**
   - Send user message with context
   - Include @-mentions (files, symbols, threads)
   - Multimodal support (text, images, audio)

4. **`session/set_mode`**
   - Switch agent operational mode
   - Different modes for different tasks

5. **Tool permission responses**
   - Approve/deny tool calls
   - Modify tool inputs before execution

**From Agent → Client:**

1. **`session/update` notifications**
   - Stream response chunks
   - Tool call requests
   - Progress updates

2. **Tool execution requests**
   - Request permission to use tools
   - Provide tool name and input
   - Wait for client approval

3. **Status notifications**
   - Thinking state
   - Error messages
   - Completion events

### Permission Model

**ACP has explicit permission requests for tool calls:**

```typescript
// Agent requests permission
{
  "jsonrpc": "2.0",
  "method": "tool/request",
  "params": {
    "tool": "write_file",
    "input": {
      "path": "/Users/me/file.txt",
      "content": "..."
    }
  }
}

// Client can:
// 1. Approve as-is
// 2. Deny
// 3. Approve with modified input
{
  "jsonrpc": "2.0",
  "method": "tool/response",
  "params": {
    "approved": true,
    "modified_input": { ... }
  }
}
```

**This enables:**
- User control over destructive operations
- Audit trail of all tool usage
- Ability to sandbox/restrict agent actions

---

## Zed's Claude Code Implementation

### Architecture

Zed built an **adapter** that wraps the Claude Agent SDK:

```
┌────────────────────────────────────────────┐
│              Zed Editor                    │
└────────────────────────────────────────────┘
                    ▲ ▼
                  ACP Protocol
                    ▲ ▼
┌────────────────────────────────────────────┐
│     @zed-industries/claude-code-acp        │
│                                             │
│  - Translates ACP ↔ Claude SDK             │
│  - Handles permissions                     │
│  - Manages sessions                        │
│  - Streams events                          │
└────────────────────────────────────────────┘
                    ▲ ▼
┌────────────────────────────────────────────┐
│     @anthropic-ai/claude-agent-sdk         │
│     @anthropic-ai/claude-code              │
└────────────────────────────────────────────┘
```

### Key Features Supported

**From the adapter README:**
- ✅ Context @-mentions
- ✅ Image handling
- ✅ Tool calls with permission requests
- ✅ Following conversations
- ✅ Edit review
- ✅ TODO list generation
- ✅ Interactive and background terminals
- ✅ Custom slash commands
- ✅ Client MCP server integration

### Implementation Pattern

The adapter acts as a **translation layer**:

1. **Receives ACP messages** (JSON-RPC over stdio)
2. **Translates to SDK calls** (Claude Agent SDK API)
3. **Streams SDK events back** (as ACP notifications)
4. **Handles permission flow** (tool approval/denial)

**Key insight:** They don't reinvent the wheel - they wrap the existing SDK and make it speak ACP.

---

## Our Current Implementation

### Architecture

```
┌────────────────────────────────────────────┐
│         Thinking Space (Tauri)             │
│                                             │
│  Frontend (React/TypeScript)               │
│    - Chat UI                               │
│    - Space management                      │
│    - Settings                              │
└────────────────────────────────────────────┘
                    ▲ ▼
              Tauri IPC Commands
                    ▲ ▼
┌────────────────────────────────────────────┐
│         Rust Backend                       │
│                                             │
│  - Spawns sidecar process                 │
│  - Custom JSON-RPC protocol               │
│  - File operations                         │
│  - Auth management                         │
└────────────────────────────────────────────┘
                    ▲ ▼
         Custom JSON-RPC over stdio
         (newline-delimited JSON)
                    ▲ ▼
┌────────────────────────────────────────────┐
│      agent-server.js (Sidecar)             │
│                                             │
│  - Wraps Claude Agent SDK                 │
│  - Custom protocol (sendMessage, etc.)    │
│  - Auto-approves all tools                │
│  - Streams events                          │
└────────────────────────────────────────────┘
                    ▲ ▼
┌────────────────────────────────────────────┐
│     @anthropic-ai/claude-agent-sdk         │
└────────────────────────────────────────────┘
```

### Our Custom Protocol

**Methods we implemented:**

1. **`ping`** - Health check
2. **`startSession`** - Initialize session with params
3. **`sendMessage`** - Send user message and stream response
4. **`stopSession`** - Clean up session

**Streaming pattern:**
- Agent sends `streamEvent` notifications
- Contains serialized SDK events
- Frontend extracts text from events

### Key Differences from ACP

| Feature | Our Implementation | ACP Standard |
|---------|-------------------|--------------|
| **Protocol** | Custom JSON-RPC | Standardized ACP |
| **Permissions** | Auto-approve all tools | Explicit permission requests |
| **Session Management** | Basic start/stop | Full lifecycle (new, load, set_mode) |
| **Context Passing** | Via systemPrompt | Native @-mentions, resources |
| **Conversation History** | Manual concatenation in systemPrompt | Built-in message history |
| **Tool Requests** | Invisible to user | Visible approval flow |
| **Multimodal** | Text only (files as text) | Text, images, audio natively |
| **Interoperability** | Thinking Space only | Works with any ACP client |

---

## Gap Analysis

### What We're Missing vs. ACP

#### 1. **No Permission System** ⭐⭐⭐⭐⭐
**Current:** Auto-approve all tools
**ACP:** Explicit permission requests with approve/deny UI

**Impact:**
- Security concern - agent can do anything
- No user control over destructive operations
- No audit trail

**Example scenario we can't handle:**
```
User: "Clean up my home directory"
Agent: *Wants to delete files*
    ↳ Should prompt: "Allow deletion of 500 files?"
    ↳ We just auto-approve and delete
```

#### 2. **Conversation History Management** ⭐⭐⭐⭐
**Current:** Manually concatenate history into systemPrompt
**ACP:** Native message history API

**Impact:**
- Inefficient (huge systemPrompts)
- Loses structure (roles collapsed)
- Token wastage

**Our workaround:**
```javascript
let enhancedSystemPrompt = systemPrompt || "";
if (conversationHistory && conversationHistory.length > 0) {
  enhancedSystemPrompt += "\n\n# Previous Conversation:\n";
  for (const msg of conversationHistory) {
    enhancedSystemPrompt += `\n${msg.role}: ${msg.content}\n`;
  }
}
```

**ACP approach:**
```javascript
session.prompt({
  message: "Current request",
  history: [
    { role: "user", content: "..." },
    { role: "assistant", content: "..." }
  ]
});
```

#### 3. **Context @-Mentions** ⭐⭐⭐⭐
**Current:** Pass files as text in message
**ACP:** Native @-mentions with metadata

**Impact:**
- Verbose messages
- No semantic understanding of context type
- Harder to track what's included

**Example:**
```
// Our way:
<file path="/path/to/file.txt">
content...
</file>

What's the issue in this file?

// ACP way:
@file:/path/to/file.txt What's the issue?
```

#### 4. **Session Lifecycle** ⭐⭐⭐
**Current:** Simple start/stop
**ACP:** Full lifecycle (new, load, resume, set_mode)

**Impact:**
- Can't resume conversations properly
- No mode switching
- No session checkpoints

#### 5. **Multimodal Support** ⭐⭐
**Current:** Text only (convert images to text descriptions)
**ACP:** Native image, audio support

**Impact:**
- Screenshot feature needs workarounds
- Can't do visual debugging
- Limited use cases

#### 6. **MCP Integration** ⭐⭐⭐⭐
**Current:** Not implemented
**ACP:** Built-in MCP server support

**Impact:**
- Can't extend with MCP servers
- Missing ecosystem of tools
- Reinventing capabilities

#### 7. **Tool Call Transparency** ⭐⭐⭐⭐
**Current:** Silent tool execution
**ACP:** Visible tool requests with input/output

**Impact:**
- User doesn't know what agent is doing
- Can't inspect tool calls
- No learning opportunity

#### 8. **Slash Commands** ⭐⭐⭐
**Current:** Not implemented
**ACP:** Built-in slash command support

**Impact:**
- Can't do `/fix`, `/test`, etc.
- Less user-friendly workflow
- Missing power user features

---

## What We're Doing BETTER

### 1. **Space-Based Context** ⭐⭐⭐⭐⭐
**Our advantage:** Each Space has its own CLAUDE.md context that persists

**Why it matters:**
- Spatial organization
- Context doesn't reset
- Memory palace concept
- Project-specific knowledge

**ACP doesn't have:** Persistent, space-based context management

### 2. **SQLite Conversation Persistence** ⭐⭐⭐⭐⭐
**Our advantage:** Conversations saved to database, survive app restart

**Why it matters:**
- Long-term memory
- Return to conversations weeks later
- Search history (future)

**ACP standard:** Doesn't mandate persistence (editor-specific)

### 3. **Unified Desktop App Experience** ⭐⭐⭐⭐
**Our advantage:** Not tied to an editor, standalone app

**Why it matters:**
- Non-developers can use it
- Not code-centric
- General-purpose thinking tool

**Zed/ACP focus:** Code editing workflows

### 4. **Cross-Platform Auth** ⭐⭐⭐⭐
**Our advantage:** OAuth + API key with seamless fallback

**Why it matters:**
- Works with Claude Pro/Max subscriptions
- Fallback to API keys
- Good UX

**ACP:** Auth is agent-specific, not standardized

---

## Recommendations: What Should We Adopt?

### High Priority (Should Implement)

#### 1. **Permission System UI** ⭐⭐⭐⭐⭐
**Effort:** Medium (8-12 hours)
**Impact:** Critical - Security and user trust

**What to build:**
- Modal dialog when agent requests tool use
- Show tool name and input
- Approve/Deny/Modify buttons
- "Always allow this tool" checkbox
- Audit log of all tool usage

**Implementation:**
```typescript
// In sidecar, instead of auto-approve:
canUseTool: async (toolName, input) => {
  // Send permission request to frontend
  const response = await requestPermission(toolName, input);
  return {
    behavior: response.approved ? "allow" : "deny",
    updatedInput: response.modifiedInput || input
  };
}
```

#### 2. **Proper Conversation History API** ⭐⭐⭐⭐
**Effort:** Low (3-4 hours)
**Impact:** High - Better performance, cleaner code

**What to change:**
- Stop concatenating history into systemPrompt
- Pass as separate `messages` array to SDK
- Let SDK handle context efficiently

**Benefits:**
- Smaller requests
- Better token usage
- Proper role separation

#### 3. **Tool Call Transparency** ⭐⭐⭐⭐
**Effort:** Low-Medium (4-6 hours)
**Impact:** High - User understanding and trust

**What to build:**
- Show tool calls in chat UI
- Display tool input (the command/query)
- Show tool output (success/failure)
- Expandable details

**UI mockup:**
```
Assistant: I'll check that file for you.

  [Tool: Read]
  ↳ Input: /path/to/file.txt
  ↳ Output: File read successfully (2.4 KB)

Based on the contents...
```

#### 4. **MCP Server Integration** ⭐⭐⭐⭐
**Effort:** Medium-High (10-15 hours)
**Impact:** High - Extensibility

**What to build:**
- UI to browse/enable MCP servers
- Configuration per Space
- Auto-discover local MCP servers
- Pass to SDK when creating session

**Why:**
- Huge ecosystem of capabilities
- Community-built tools
- Future-proof

### Medium Priority (Nice to Have)

#### 5. **Session Lifecycle Management** ⭐⭐⭐
**Effort:** Medium (6-8 hours)
**Impact:** Medium - Better UX

**What to add:**
- Resume previous sessions
- Checkpoint/restore
- Mode switching (chat, code, analysis)

#### 6. **Slash Command Support** ⭐⭐⭐
**Effort:** Medium (6-8 hours)
**Impact:** Medium - Power user features

**What to build:**
- Parse `/command` syntax
- Built-in commands: `/fix`, `/test`, `/explain`
- Custom commands per Space (via CLAUDE.md)

#### 7. **Native @-Mentions** ⭐⭐⭐
**Effort:** Low (3-4 hours)
**Impact:** Medium - Cleaner UX

**What to change:**
- Parse `@file`, `@symbol` syntax
- Highlight in input
- Resolve to proper context format

### Low Priority (Later)

#### 8. **Full ACP Compliance** ⭐⭐
**Effort:** Very High (30-40 hours)
**Impact:** Low initially - Interoperability

**What it means:**
- Implement full ACP protocol
- Could work with other ACP agents (not just Claude)
- Could be used by other ACP editors

**Trade-off:**
- Lots of work
- Lose some custom features
- Benefit unclear for standalone app

**Recommendation:** Don't do this unless we want to be a general ACP client. Our value is in the Thinking Space concept, not being another editor.

---

## Proposed Implementation Plan

### Phase 1: Critical Security & UX (2-3 weeks)

**Goal:** Match essential ACP capabilities without full compliance

1. **Permission System** (8-12 hours)
   - Modal dialog for tool approvals
   - Deny/approve/modify flow
   - Audit log

2. **Tool Call Transparency** (4-6 hours)
   - Show tool calls in UI
   - Display input/output
   - Expandable details

3. **Proper History API** (3-4 hours)
   - Stop using systemPrompt hack
   - Use SDK's message history
   - Clean up sidecar code

**Total:** ~20 hours, 1 sprint

### Phase 2: Power Features (2-3 weeks)

4. **MCP Integration** (10-15 hours)
   - UI for MCP servers
   - Per-Space configuration
   - Auto-discovery

5. **Slash Commands** (6-8 hours)
   - Built-in commands
   - Custom per-Space commands

6. **Session Management** (6-8 hours)
   - Resume sessions
   - Checkpoints
   - Mode switching

**Total:** ~28 hours, 1.5 sprints

### Phase 3: Polish (1-2 weeks)

7. **Native @-Mentions** (3-4 hours)
8. **Multimodal Support** (6-8 hours)
   - Image attachments
   - Screenshot integration

**Total:** ~12 hours, 0.5 sprint

---

## Key Insights

### What ACP Gets Right

1. **Standardization is powerful** - One protocol, many editors/agents
2. **Permissions are non-negotiable** - Users must control agents
3. **Transparency builds trust** - Show what agent is doing
4. **Extensibility matters** - MCP integration is huge

### What We Should Keep Doing

1. **Space-based organization** - Our killer feature
2. **Persistent context (CLAUDE.md)** - Memory palace concept
3. **SQLite persistence** - Long-term conversation storage
4. **Standalone app** - Not tied to code editing

### The Hybrid Approach

**Don't become an ACP client.** Instead:

✅ **Adopt ACP patterns:**
- Permission system
- Tool transparency
- MCP integration
- Better history management

❌ **Keep our unique value:**
- Spaces concept
- CLAUDE.md persistence
- Standalone app
- Non-developer focus

**Think:** "ACP-inspired, Thinking Space-optimized"

---

## Action Items

### Immediate (This Week)

1. ✅ Research complete (this document)
2. ⏭️ Discuss findings with team
3. ⏭️ Prioritize which features to implement first
4. ⏭️ Create tickets for Phase 1 work

### Short Term (Next Sprint)

1. ⏭️ Implement permission system
2. ⏭️ Add tool call transparency
3. ⏭️ Fix conversation history API

### Medium Term (Next Month)

1. ⏭️ MCP integration
2. ⏭️ Slash commands
3. ⏭️ Session management

---

## Questions for Discussion

1. **Permission system urgency?** Should this block 1.0 release?

2. **Full ACP compliance?** Worth pursuing for interoperability?

3. **MCP priority?** Critical or nice-to-have?

4. **Tool auto-approval scope?** Allow within Space directory without prompts?

5. **Slash commands vs. Space templates?** Overlap in purpose?

---

## Resources

- **ACP Spec:** https://github.com/agentclientprotocol/agent-client-protocol
- **Zed's Claude Adapter:** https://github.com/zed-industries/claude-code-acp
- **ACP TypeScript SDK:** https://www.npmjs.com/package/@agentclientprotocol/sdk
- **Zed ACP Blog:** https://zed.dev/blog/claude-code-via-acp
- **Agent SDK Docs:** https://docs.anthropic.com/en/agent-sdk

---

**Bottom Line:**
We don't need to be fully ACP-compliant, but we should adopt their best patterns (permissions, transparency, MCP) while keeping our unique Thinking Space value proposition.
