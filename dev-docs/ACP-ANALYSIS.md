# ACP (Agent Client Protocol) Integration Plan

**Created:** October 14, 2025
**Updated:** October 14, 2025 - Revised to full ACP adoption
**Purpose:** Migrate Thinking Space to use ACP for agent communication

---

## Executive Summary - REVISED ✅

### The Insight

**ACP is the transport layer. Spaces are the product layer.**

These are **completely orthogonal** - adopting ACP doesn't conflict with our Spaces concept at all!

**What ACP provides:**

- Standardized agent communication (JSON-RPC over stdio)
- Permission system for tool calls
- Session management
- Streaming responses
- Multi-agent support (Claude, Gemini, Goose, etc.)

**What Thinking Space adds on top:**

- Spaces organization (our unique value)
- CLAUDE.md persistent context per Space
- SQLite conversation persistence
- Spatial UI/UX
- Non-developer focused experience

**We should absolutely become a full ACP client!**

---

## Why Full ACP Adoption is the Right Choice

### 1. **Use Official Adapters** ✅

Instead of maintaining our custom sidecar (`agent-server.js`), we use:

- `@zed-industries/claude-code-acp` - Official Claude adapter
- Future: `@google/gemini-acp`, `@block/goose-acp`, etc.

**Benefits:**

- Anthropic/Google maintain them
- We get updates for free
- Battle-tested by Zed and others
- Security patches automatic

### 2. **Multi-Agent Support** ✅

**User can choose their agent:**

```
Settings → Agent
  ○ Claude Code (Anthropic)
  ○ Gemini CLI (Google)
  ○ Goose (Block)
  ○ Custom ACP Agent
```

**This is huge** - not locked into one vendor!

### 3. **Get All ACP Features for Free** ✅

- ✅ Permission system
- ✅ Tool call transparency
- ✅ MCP server integration
- ✅ Slash commands
- ✅ Proper conversation history
- ✅ Multimodal support (images, audio)
- ✅ Session lifecycle management

### 4. **Less Code to Maintain** ✅

**Delete:**

- `src-tauri/sidecar/agent-server.js` (300+ lines)
- Custom protocol implementation
- Manual SDK event serialization

**Keep:**

- All Spaces logic
- CLAUDE.md integration
- SQLite persistence
- UI/UX

**Win:** Simpler codebase, more features!

### 5. **Future-Proof** ✅

- New ACP features → We get them automatically
- Community improvements
- Ecosystem growth
- Interoperability with other tools

---

## Architecture Comparison

### Current Architecture (Custom Protocol)

```
┌─────────────────────────────────────────────┐
│     Thinking Space UI (React)               │
│  - Spaces, Chat, Settings                   │
└─────────────────────────────────────────────┘
              ▲ ▼ Tauri IPC
┌─────────────────────────────────────────────┐
│     Rust Backend (Tauri)                    │
│  - Spawn sidecar                            │
│  - Custom JSON-RPC protocol                 │
└─────────────────────────────────────────────┘
              ▲ ▼ Custom protocol (stdio)
┌─────────────────────────────────────────────┐
│     agent-server.js (Custom Sidecar)        │
│  - Wraps Claude Agent SDK                   │
│  - sendMessage, startSession, etc.          │
│  - Auto-approve all tools                   │
└─────────────────────────────────────────────┘
              ▲ ▼
┌─────────────────────────────────────────────┐
│     @anthropic-ai/claude-agent-sdk          │
└─────────────────────────────────────────────┘
```

### New Architecture (Full ACP)

```
┌─────────────────────────────────────────────┐
│     Thinking Space UI (React)               │
│  - Spaces, Chat, Settings                   │
│  - NEW: Permission dialogs                  │
│  - NEW: Tool call display                   │
└─────────────────────────────────────────────┘
              ▲ ▼ Tauri IPC
┌─────────────────────────────────────────────┐
│     Rust Backend (Tauri)                    │
│  - Spawn ACP adapter (npx)                  │
│  - ACP JSON-RPC client                      │
│  - NEW: Permission handling                 │
└─────────────────────────────────────────────┘
              ▲ ▼ ACP Protocol (stdio)
┌─────────────────────────────────────────────┐
│  @zed-industries/claude-code-acp            │
│  (Official adapter - maintained by Zed)     │
│                                              │
│  - Permission requests                      │
│  - Tool calls                                │
│  - Streaming                                 │
│  - MCP integration                           │
└─────────────────────────────────────────────┘
              ▲ ▼
┌─────────────────────────────────────────────┐
│     @anthropic-ai/claude-agent-sdk          │
│     @anthropic-ai/claude-code               │
└─────────────────────────────────────────────┘
```

**Key changes:**

- Replace custom sidecar with official ACP adapter
- Implement ACP protocol (standardized)
- Add permission UI (user control)
- Support multiple agents (not just Claude)

---

## The Spaces Layer (Unchanged!)

**This is the key insight:** Spaces sit **on top** of ACP, not in conflict with it.

### How Spaces Work with ACP

**1. User selects a Space**

```
User clicks: "Book Research" Space
```

**2. Load Space context**

```rust
// Load Space metadata
let space = spaces::load_space("book-research-id");
let claude_md = fs::read(space.claude_md_path);
let conversation = conversations::load(space.id);
```

**3. Start ACP session with Space context**

```json
{
  "method": "session/new",
  "params": {
    "workingDirectory": "/Users/me/.thinking-space/spaces/book-research/",
    "systemPrompt": "<contents of CLAUDE.md>",
    "conversationHistory": [
      /* from SQLite */
    ]
  }
}
```

**4. User sends message**

```
User types: "What themes emerged from my research?"
```

**5. ACP sends with Space context**

```json
{
  "method": "session/prompt",
  "params": {
    "message": "What themes emerged from my research?",
    "context": [
      { "type": "file", "path": "CLAUDE.md" },
      { "type": "directory", "path": "notes/" }
    ]
  }
}
```

**6. Agent responds, we save to Space**

```rust
// Conversation continues via ACP...
// When complete:
conversations::save(space.id, messages);
```

**The Spaces layer is completely independent of ACP!**

---

## Implementation Plan

### Phase 1: Basic ACP Integration (8-12 hours)

**Goal:** Replace custom sidecar with ACP adapter, basic communication working

#### Step 1.1: Install ACP Adapter (1 hour)

```bash
cd src-tauri
npm init -y  # If no package.json
npm install @zed-industries/claude-code-acp
```

#### Step 1.2: Update Sidecar Spawn (2-3 hours)

**File:** `src-tauri/src/sidecar.rs`

```rust
// Instead of spawning our custom server:
let sidecar_path = app_dir.join("sidecar").join("agent-server.js");
Command::new("node")
    .arg(sidecar_path)
    // ...

// Spawn ACP adapter:
Command::new("npx")
    .arg("@zed-industries/claude-code-acp")
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()?
```

#### Step 1.3: Implement ACP Client (4-6 hours)

**Create:** `src-tauri/src/acp_client.rs`

```rust
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{ChildStdin, ChildStdout};

#[derive(Debug, Serialize, Deserialize)]
struct AcpMessage {
    jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<AcpError>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AcpError {
    code: i32,
    message: String,
}

pub struct AcpClient {
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    next_id: u64,
}

impl AcpClient {
    pub fn new(stdin: ChildStdin, stdout: ChildStdout) -> Self {
        Self {
            stdin,
            stdout: BufReader::new(stdout),
            next_id: 1,
        }
    }

    pub fn initialize(&mut self) -> Result<(), String> {
        let request = AcpMessage {
            jsonrpc: "2.0".to_string(),
            id: Some(self.next_id),
            method: Some("initialize".to_string()),
            params: Some(serde_json::json!({
                "protocolVersion": "1.0",
                "clientInfo": {
                    "name": "Thinking Space",
                    "version": "0.1.0"
                }
            })),
            result: None,
            error: None,
        };

        self.next_id += 1;
        self.send_request(request)
    }

    pub fn new_session(&mut self, params: serde_json::Value) -> Result<(), String> {
        let request = AcpMessage {
            jsonrpc: "2.0".to_string(),
            id: Some(self.next_id),
            method: Some("session/new".to_string()),
            params: Some(params),
            result: None,
            error: None,
        };

        self.next_id += 1;
        self.send_request(request)
    }

    pub fn send_prompt(&mut self, message: String, context: Vec<serde_json::Value>) -> Result<(), String> {
        let request = AcpMessage {
            jsonrpc: "2.0".to_string(),
            id: Some(self.next_id),
            method: Some("session/prompt".to_string()),
            params: Some(serde_json::json!({
                "message": message,
                "context": context
            })),
            result: None,
            error: None,
        };

        self.next_id += 1;
        self.send_request(request)
    }

    fn send_request(&mut self, request: AcpMessage) -> Result<(), String> {
        let json = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;

        writeln!(self.stdin, "{}", json)
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;

        self.stdin.flush()
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;

        Ok(())
    }

    pub fn read_message(&mut self) -> Result<Option<AcpMessage>, String> {
        let mut line = String::new();
        match self.stdout.read_line(&mut line) {
            Ok(0) => Ok(None), // EOF
            Ok(_) => {
                let msg: AcpMessage = serde_json::from_str(&line)
                    .map_err(|e| format!("Failed to parse message: {}", e))?;
                Ok(Some(msg))
            }
            Err(e) => Err(format!("Failed to read from stdout: {}", e)),
        }
    }
}
```

#### Step 1.4: Update SidecarManager (2-3 hours)

**File:** `src-tauri/src/sidecar.rs`

Update to use `AcpClient` instead of custom protocol.

#### Step 1.5: Test Basic Communication (1-2 hours)

- Initialize ACP connection
- Create session
- Send simple message
- Verify response

---

### Phase 2: ACP Features & UI (10-14 hours)

**Goal:** Add permission dialogs, tool transparency, proper UI integration

#### Step 2.1: Permission Dialog UI (4-6 hours)

**Create:** `src/src/components/PermissionDialog.tsx`

```typescript
interface PermissionDialogProps {
  tool: string;
  input: Record<string, any>;
  onApprove: (modifiedInput?: Record<string, any>) => void;
  onDeny: () => void;
}

export function PermissionDialog({ tool, input, onApprove, onDeny }: PermissionDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            🔐 Permission Request
          </h2>

          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Claude wants to use:
            </p>
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="font-mono text-sm font-semibold">{tool}</p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              With input:
            </p>
            <pre className="px-4 py-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs overflow-auto max-h-64">
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onDeny}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Deny
            </button>
            <button
              onClick={() => onApprove()}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

#### Step 2.2: Tool Call Display (3-4 hours)

**Update:** `src/src/components/ChatArea.tsx`

Show tool calls inline:

```typescript
{message.toolCalls?.map((tool, idx) => (
  <div key={idx} className="mt-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm">
    <div className="flex items-center gap-2 mb-1">
      <span className="text-blue-600 dark:text-blue-400">🔧</span>
      <span className="font-semibold">{tool.name}</span>
    </div>
    <details className="text-xs text-gray-600 dark:text-gray-400">
      <summary className="cursor-pointer">View details</summary>
      <pre className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded overflow-auto">
        {JSON.stringify(tool.input, null, 2)}
      </pre>
    </details>
  </div>
))}
```

#### Step 2.3: Permission Handling Flow (3-4 hours)

**Update:** `src-tauri/src/sidecar.rs`

```rust
// When ACP sends tool request notification:
if message.method == Some("tool/request") {
    // Send to frontend via Tauri event
    app_handle.emit_all("permission-request", PermissionRequest {
        tool: tool_name,
        input: tool_input,
    })?;

    // Wait for frontend response...
    let response = wait_for_permission_response()?;

    // Send back to ACP
    acp_client.send_permission_response(response)?;
}
```

---

### Phase 3: Agent Selection & Polish (6-10 hours)

**Goal:** Multi-agent support, settings UI, testing

#### Step 3.1: Agent Selection UI (3-4 hours)

**Update:** `src/src/components/SettingsPanel.tsx`

```typescript
<div>
  <label className="block text-sm font-medium mb-2">
    Agent
  </label>
  <select
    value={selectedAgent}
    onChange={(e) => setSelectedAgent(e.target.value)}
    className="w-full px-3 py-2 border rounded-lg"
  >
    <option value="claude-code">Claude Code (Anthropic)</option>
    <option value="gemini">Gemini CLI (Google)</option>
    <option value="goose">Goose (Block)</option>
    <option value="custom">Custom ACP Agent...</option>
  </select>
</div>
```

#### Step 3.2: Agent Config Management (2-3 hours)

**Create:** `src-tauri/src/agent_config.rs`

Store which agent to use, how to spawn it:

```rust
pub struct AgentConfig {
    pub name: String,
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

pub fn get_agent_configs() -> Vec<AgentConfig> {
    vec![
        AgentConfig {
            name: "Claude Code".to_string(),
            command: "npx".to_string(),
            args: vec!["@zed-industries/claude-code-acp".to_string()],
            env: HashMap::new(),
        },
        // Add more agents as they become available
    ]
}
```

#### Step 3.3: Testing & Debugging (3-4 hours)

- Test all ACP methods
- Test permission flows
- Test multi-turn conversations
- Test with different agents (if available)
- Debug any issues

---

## Timeline

### Sprint 1 (Week 1)

- Days 1-2: Phase 1 (Basic ACP integration)
- Days 3-5: Phase 2 (Permission UI, tool display)

### Sprint 2 (Week 2)

- Days 1-2: Phase 3 (Agent selection, polish)
- Days 3-5: Testing, bug fixes, documentation

**Total: 2 weeks to full ACP migration**

---

## What Stays The Same (Our Unique Value)

### Spaces Concept ✅

- Create, organize, switch Spaces
- Each Space = independent context
- Spatial UI (future: canvas view)

### CLAUDE.md Integration ✅

- Persistent context per Space
- Visual editor (Monaco)
- Auto-included in every conversation

### SQLite Persistence ✅

- Conversations saved per Space
- Survive app restarts
- Search history (future)

### Standalone App ✅

- Not a code editor
- Non-developer focused
- Beautiful desktop experience

### File Operations ✅

- Drag-and-drop attachments
- Artifact viewer
- Space file management

**ACP is plumbing. Spaces are the product.**

---

## Migration Checklist

### Preparation

- [x] Research ACP protocol
- [x] Understand claude-code-acp adapter
- [x] Design integration architecture
- [ ] Create backup branch

### Implementation

- [ ] Install @zed-industries/claude-code-acp
- [ ] Create acp_client.rs
- [ ] Update sidecar spawn logic
- [ ] Implement ACP message handling
- [ ] Add permission dialog UI
- [ ] Add tool call display
- [ ] Test basic communication
- [ ] Test permission flows
- [ ] Test with Spaces context
- [ ] Add agent selection

### Testing

- [ ] Basic message send/receive
- [ ] Tool permission approve/deny
- [ ] Multi-turn conversations
- [ ] Space context inclusion
- [ ] Conversation persistence
- [ ] File attachments
- [ ] Settings integration

### Cleanup

- [ ] Delete agent-server.js
- [ ] Remove custom protocol code
- [ ] Update documentation
- [ ] Update STATUS.md

---

## Expected Benefits

### Immediate (After Migration)

- ✅ Permission system - User control over tools
- ✅ Tool transparency - See what agent does
- ✅ Proper conversation history - No systemPrompt hack
- ✅ Better streaming - Standard ACP events
- ✅ Less code - Delete custom sidecar

### Short Term (Weeks)

- ✅ MCP integration - Ecosystem of tools
- ✅ Slash commands - Power user workflows
- ✅ Multimodal - Images, audio support
- ✅ Session management - Resume, checkpoint

### Long Term (Months)

- ✅ Multi-agent support - Claude, Gemini, Goose
- ✅ Future-proof - New features automatic
- ✅ Community benefits - Ecosystem growth
- ✅ Interoperability - Work with other ACP tools

---

## Risks & Mitigation

### Risk 1: ACP Adapter Issues

**Mitigation:** Keep old sidecar code in git history, can rollback if needed

### Risk 2: Breaking Changes

**Mitigation:** Pin adapter version, test thoroughly before updating

### Risk 3: Performance

**Mitigation:** Benchmark, optimize if needed, ACP is lightweight

### Risk 4: Learning Curve

**Mitigation:** Good documentation, examples from Zed

---

## Success Criteria

**Migration is successful when:**

1. ✅ Can send messages via ACP
2. ✅ Streaming responses work
3. ✅ Permission dialogs appear and work
4. ✅ Tool calls are visible
5. ✅ Spaces context still included
6. ✅ Conversations still persist
7. ✅ File attachments still work
8. ✅ No regressions in existing features

---

## Next Steps

1. **Create backup branch**

   ```bash
   git checkout -b backup-before-acp
   git push origin backup-before-acp
   ```

2. **Create feature branch**

   ```bash
   git checkout main
   git checkout -b feature/acp-integration
   ```

3. **Start Phase 1**
   - Install claude-code-acp
   - Create acp_client.rs
   - Update sidecar spawn

4. **Iterate and test**

---

## Resources

- **ACP Spec:** https://github.com/agentclientprotocol/agent-client-protocol
- **Claude ACP Adapter:** https://github.com/zed-industries/claude-code-acp
- **ACP TypeScript SDK:** https://www.npmjs.com/package/@agentclientprotocol/sdk
- **Zed ACP Docs:** https://zed.dev/docs/ai/external-agents
- **Our Current Sidecar:** `src-tauri/sidecar/agent-server.js`

---

## Conclusion

**Full ACP adoption is the right move.**

It gives us:

- ✅ Better features (permissions, transparency, MCP)
- ✅ Less maintenance (official adapters)
- ✅ Multi-agent support (Claude, Gemini, more)
- ✅ Future-proofing (ecosystem growth)

While keeping:

- ✅ Our unique Spaces concept
- ✅ CLAUDE.md persistence
- ✅ Spatial organization
- ✅ Non-developer focus

**ACP is infrastructure. Thinking Space is the product.**

Let's build the best ACP client for spatial thinking! 🚀
