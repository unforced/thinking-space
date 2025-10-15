# ACP Refactor Plan

**Created:** October 15, 2025
**Status:** In Progress - Dependencies Added

## Executive Summary

Our current ACP implementation is **fundamentally incorrect**. We're manually implementing JSON-RPC protocol when we should be using the official `agent-client-protocol` Rust crate. This document outlines the complete refactor needed.

---

## Problems with Current Implementation

### 1. Manual JSON-RPC Instead of Official Library ❌
**Current:**
```rust
pub struct AcpClient {
    stdin: Arc<Mutex<ChildStdin>>,
    stdout: Arc<Mutex<BufReader<ChildStdout>>>,
}
```

**Should be:**
```rust
use agent_client_protocol as acp;

let conn = acp::ClientSideConnection::new(stdin, stdout, client).await?;
```

### 2. Invalid Method Names ❌
**Current:**
```rust
// This method doesn't exist in ACP!
pub fn approve_tool(&self, tool_id: String, ...) {
    method: Some("tool/response".to_string()),  // ❌ Wrong!
}
```

**Should be:**
- Agent calls `session/request_permission` ON the client
- Client implements `request_permission()` trait method
- Returns `RequestPermissionResponse` with user's choice

### 3. Missing Client Trait Implementation ❌
We don't implement `acp::Client` trait at all!

**Need to implement:**
```rust
#[async_trait::async_trait(?Send)]
impl acp::Client for ThinkingSpaceClient {
    async fn request_permission(&self, args: RequestPermissionRequest)
        -> Result<RequestPermissionResponse, Error>;

    async fn session_notification(&self, notification: SessionNotification)
        -> Result<(), Error>;

    async fn read_text_file(&self, args: ReadTextFileRequest)
        -> Result<ReadTextFileResponse, Error>;

    // ... other methods
}
```

### 4. Incorrect Notification Handling ❌
**Current:**
```rust
// We skip notifications!
if msg.id.is_some() {
    return Ok(msg);
} else {
    println!("Skipping notification");  // ❌ Should handle!
}
```

**Should be:**
- Implement `session_notification()` trait method
- ACP library routes notifications there automatically
- No manual skipping needed

---

## ACP Protocol Key Concepts

### Session Update Notifications

The `session/update` notification is how agents stream progress:

```json
{
  "jsonrpc": "2.0",
  "method": "session/update",
  "params": {
    "sessionId": "uuid-here",
    "update": {
      "sessionUpdate": "agent_message_chunk",
      "content": {"type": "text", "text": "Hello!"}
    }
  }
}
```

**Update Types:**
- `agent_message_chunk` - Streaming agent text
- `user_message_chunk` - Streaming user text
- `agent_thought_chunk` - Agent internal reasoning
- `tool_call` - New tool call created
- `tool_call_update` - Tool call status update
- `plan` - Agent's execution plan
- `available_commands_update` - Available slash commands changed
- `current_mode_update` - Session mode changed

### Permission Request Flow

1. Agent sends `session/request_permission` **request** to client (with id)
2. Client implements `request_permission()` method
3. Client shows UI dialog to user
4. User selects option (allow/deny)
5. Client **returns response** to agent
6. Agent continues or stops based on response

**Permission Options:**
- `allow_once` - Allow this one time
- `allow_always` - Always allow this tool
- `reject_once` - Reject this time
- `reject_always` - Never allow this tool
- `cancel` - Cancel the entire operation

### Tool Call Lifecycle

```
1. tool_call (status: Pending)
2. session/request_permission (if needed)
3. Client responds with permission
4. tool_call_update (status: InProgress)
5. tool_call_update (status: Completed/Failed)
```

**ToolCall Structure:**
```rust
struct ToolCall {
    tool_call_id: String,
    title: String,  // "Reading main.rs"
    status: ToolCallStatus,  // Pending, InProgress, Completed, Failed
    kind: ToolCallKind,  // Read, Edit, Execute, etc.
    raw_input: Value,  // {"path": "/path/to/file"}
    raw_output: Option<Value>,  // Results after completion
    content: Vec<ContentBlock>,
    locations: Vec<FileLocation>,
}
```

---

## Refactor Plan

### Phase 1: Setup ✅
- [x] Add `agent-client-protocol = "0.4"`
- [x] Add `tokio` with full features
- [x] Add `tokio-util` for compat
- [x] Add `async-trait`
- [x] Add `futures`

### Phase 2: Implement Client Trait
- [ ] Create `ThinkingSpaceClient` struct
- [ ] Implement `acp::Client` trait
- [ ] Handle `request_permission()` with channels
- [ ] Handle `session_notification()` with event emission
- [ ] Implement `read_text_file()` for file access
- [ ] Implement `write_text_file()` for file writes
- [ ] Implement terminal methods if needed

### Phase 3: Update SidecarManager
- [ ] Make `start()` async
- [ ] Use `tokio::process::Command` instead of `std::process::Command`
- [ ] Create `ClientSideConnection` with our client
- [ ] Call `initialize()` via connection
- [ ] Create sessions via `new_session()`
- [ ] Send prompts via `prompt()`
- [ ] Handle connection lifecycle

### Phase 4: Frontend Integration
- [ ] Add permission dialog component
- [ ] Add tool call display component
- [ ] Wire up permission approval flow
- [ ] Display tool call status updates
- [ ] Handle cancellation

### Phase 5: Testing
- [ ] Test basic message flow
- [ ] Test permission requests
- [ ] Test tool call display
- [ ] Test file operations
- [ ] Test error handling

---

## Implementation Details

### ThinkingSpaceClient Structure

```rust
use agent_client_protocol as acp;
use tokio::sync::mpsc;
use parking_lot::Mutex;

pub struct ThinkingSpaceClient {
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    request_id: Arc<Mutex<Option<u64>>>,

    // Channels for permission requests
    permission_tx: mpsc::Sender<PermissionRequest>,
    permission_rx: Arc<Mutex<mpsc::Receiver<PermissionResponse>>>,
}

struct PermissionRequest {
    request_id: String,
    session_id: String,
    tool_call: acp::ToolCall,
    options: Vec<acp::PermissionOption>,
}

struct PermissionResponse {
    request_id: String,
    outcome: acp::RequestPermissionOutcome,
}
```

### Client Trait Implementation

```rust
#[async_trait::async_trait(?Send)]
impl acp::Client for ThinkingSpaceClient {
    async fn request_permission(
        &self,
        args: acp::RequestPermissionRequest,
    ) -> Result<acp::RequestPermissionResponse, acp::Error> {
        let request_id = uuid::Uuid::new_v4().to_string();

        // Emit event to frontend
        if let Some(handle) = self.app_handle.lock().as_ref() {
            handle.emit("permission-request", serde_json::json!({
                "requestId": request_id,
                "sessionId": args.session_id,
                "toolCall": args.tool_call,
                "options": args.options,
            })).map_err(|e| acp::Error::internal_error(e.to_string()))?;
        }

        // Wait for user response
        let response = self.permission_rx.lock().recv().await
            .ok_or_else(|| acp::Error::internal_error("Permission channel closed"))?;

        Ok(acp::RequestPermissionResponse {
            outcome: response.outcome
        })
    }

    async fn session_notification(
        &self,
        notification: acp::SessionNotification,
    ) -> Result<(), acp::Error> {
        let handle = self.app_handle.lock();
        let Some(ref app_handle) = *handle else {
            return Ok(());
        };

        // Get request_id for sessionId translation
        let request_id = self.request_id.lock().clone();
        let frontend_session_id = request_id.map(|id| format!("session-{}", id))
            .unwrap_or_else(|| notification.session_id.clone());

        match notification.update {
            acp::SessionUpdate::AgentMessageChunk { content } => {
                app_handle.emit("streamEvent", serde_json::json!({
                    "sessionId": frontend_session_id,
                    "event": {
                        "type": "assistant",
                        "message": {
                            "role": "assistant",
                            "content": [content]
                        }
                    }
                })).ok();
            }

            acp::SessionUpdate::ToolCall { tool_call } => {
                app_handle.emit("tool-call", serde_json::json!({
                    "sessionId": frontend_session_id,
                    "toolCall": tool_call,
                })).ok();
            }

            acp::SessionUpdate::ToolCallUpdate { tool_call_id, update } => {
                app_handle.emit("tool-call-update", serde_json::json!({
                    "sessionId": frontend_session_id,
                    "toolCallId": tool_call_id,
                    "update": update,
                })).ok();
            }

            _ => {
                // Log other updates for debugging
                println!("[ACP] Session update: {:?}", notification.update);
            }
        }

        Ok(())
    }

    async fn read_text_file(
        &self,
        args: acp::ReadTextFileRequest,
    ) -> Result<acp::ReadTextFileResponse, acp::Error> {
        std::fs::read_to_string(&args.path)
            .map(|content| acp::ReadTextFileResponse { content })
            .map_err(|e| acp::Error::internal_error(e.to_string()))
    }

    async fn write_text_file(
        &self,
        args: acp::WriteTextFileRequest,
    ) -> Result<acp::WriteTextFileResponse, acp::Error> {
        std::fs::write(&args.path, &args.content)
            .map(|_| acp::WriteTextFileResponse {})
            .map_err(|e| acp::Error::internal_error(e.to_string()))
    }
}
```

### SidecarManager with ClientSideConnection

```rust
use agent_client_protocol as acp;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

pub struct SidecarManager {
    process: Arc<Mutex<Option<tokio::process::Child>>>,
    connection: Arc<Mutex<Option<acp::ClientSideConnection</* types */>>>>,
    client: Arc<ThinkingSpaceClient>,
    runtime: Arc<tokio::runtime::Runtime>,
}

impl SidecarManager {
    pub fn start(&self, api_key: Option<String>) -> Result<(), String> {
        let api_key_value = api_key
            .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok())
            .unwrap_or_default();

        // Run async code on tokio runtime
        self.runtime.block_on(async {
            let mut child = tokio::process::Command::new("npx")
                .arg("@zed-industries/claude-code-acp")
                .stdin(std::process::Stdio::piped())
                .stdout(std::process::Stdio::piped())
                .stderr(std::process::Stdio::inherit())
                .env("ANTHROPIC_API_KEY", api_key_value)
                .spawn()
                .map_err(|e| format!("Failed to spawn: {}", e))?;

            let stdin = child.stdin.take().unwrap().compat_write();
            let stdout = child.stdout.take().unwrap().compat();

            let conn = acp::ClientSideConnection::new(stdin, stdout, self.client.clone())
                .await
                .map_err(|e| format!("Failed to create connection: {}", e))?;

            // Initialize
            conn.initialize(acp::InitializeParams {
                protocol_version: 1,
                client_info: acp::ClientInfo {
                    name: "Thinking Space".to_string(),
                    version: "0.1.0".to_string(),
                },
                client_capabilities: acp::ClientCapabilities {
                    tools: Some(true),
                    streaming: Some(true),
                    ..Default::default()
                },
            }).await
            .map_err(|e| format!("Failed to initialize: {}", e))?;

            *self.connection.lock() = Some(conn);
            *self.process.lock() = Some(child);

            Ok(())
        })
    }
}
```

---

## Critical Edge Cases

### 1. Cancellation
After sending `session/cancel`, continue accepting updates until agent responds

### 2. Absolute Paths
All file paths must be absolute, not relative

### 3. Line Numbers
1-based, not 0-based

### 4. Session Reuse
Sessions persist across prompts for conversation continuity

### 5. Notification Ordering
Notifications arrive asynchronously, use IDs to match updates

---

## References

- **Rust docs:** https://docs.rs/agent-client-protocol/latest/agent_client_protocol/
- **Protocol spec:** https://agentclientprotocol.com/protocol/overview
- **Schema:** https://agentclientprotocol.com/protocol/schema
- **Zed implementation:** https://github.com/zed-industries/zed (search for ACP)
- **ACP repo:** https://github.com/zed-industries/agent-client-protocol

---

## Next Steps

1. Create new `acp_client.rs` implementing `ThinkingSpaceClient`
2. Update `sidecar.rs` to use async and `ClientSideConnection`
3. Add permission dialog UI component
4. Wire up permission approval flow
5. Test complete flow

This is a complete rewrite of the ACP integration, but it will be much more robust and maintainable using the official library.
