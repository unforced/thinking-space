# Agent Client Protocol (ACP) Rust Library Reference

This is a comprehensive reference guide for implementing an ACP client using the `agent-client-protocol` Rust library (version 0.4.7).

## Table of Contents
1. [Dependencies and Imports](#dependencies-and-imports)
2. [Client Trait Implementation Pattern](#client-trait-implementation-pattern)
3. [Connection Creation Pattern](#connection-creation-pattern)
4. [Agent Trait Usage (Making Requests)](#agent-trait-usage-making-requests)
5. [Common Patterns](#common-patterns)
6. [Session Notifications](#session-notifications)
7. [Permission Requests](#permission-requests)
8. [Complete Working Example](#complete-working-example)

---

## 1. Dependencies and Imports

### Cargo.toml Dependencies

```toml
[dependencies]
agent-client-protocol = "0.4.7"
agent-client-protocol-schema = "0.4.9"
async-trait = "0.1"
anyhow = "1.0"
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
futures = "0.3"
```

### Required Imports

```rust
// Core ACP library
use agent_client_protocol::{
    Client, Agent, ClientSideConnection, ClientCapabilities, AgentCapabilities,
    Error,
};

// Schema types from agent-client-protocol-schema
use agent_client_protocol_schema::{
    // Initialization
    InitializeRequest, InitializeResponse, VERSION,

    // Session Management
    NewSessionRequest, NewSessionResponse,
    LoadSessionRequest, LoadSessionResponse,
    SessionId,

    // Prompts
    PromptRequest, PromptResponse, StopReason,

    // Session Updates (notifications from agent to client)
    SessionNotification, SessionUpdate,

    // Content types
    ContentBlock, TextContent, ToolCallContent,

    // Tool Calls
    ToolCall, ToolCallId, ToolCallStatus, ToolKind,
    ToolCallUpdate, ToolCallUpdateFields, ToolCallLocation,

    // Permissions
    RequestPermissionRequest, RequestPermissionResponse,
    RequestPermissionOutcome, PermissionOption, PermissionOptionId, PermissionOptionKind,

    // File Operations
    ReadTextFileRequest, ReadTextFileResponse,
    WriteTextFileRequest, WriteTextFileResponse,

    // Terminal (optional, if you implement terminal support)
    CreateTerminalRequest, CreateTerminalResponse,
    TerminalOutputRequest, TerminalOutputResponse,
    KillTerminalCommandRequest, KillTerminalCommandResponse,
    ReleaseTerminalRequest, ReleaseTerminalResponse,
    WaitForTerminalExitRequest, WaitForTerminalExitResponse,

    // Cancellation
    CancelNotification,

    // Extensions (for custom methods)
    ExtRequest, ExtResponse, ExtNotification,

    // Notifications
    AgentNotification, ClientNotification,
};

// Async traits
use async_trait::async_trait;

// Standard library
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::path::PathBuf;

// Futures
use futures::future::LocalBoxFuture;
```

---

## 2. Client Trait Implementation Pattern

The `Client` trait is the interface that your application must implement to handle requests from the agent.

### Complete Client Trait Definition

```rust
#[async_trait::async_trait(?Send)]
pub trait Client {
    // REQUIRED METHODS - Must implement these
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> Result<RequestPermissionResponse, Error>;

    async fn session_notification(
        &self,
        args: SessionNotification
    ) -> Result<(), Error>;

    // OPTIONAL METHODS - Have default implementations that return method_not_found()
    // Only implement if you advertise the capability

    async fn write_text_file(
        &self,
        args: WriteTextFileRequest,
    ) -> Result<WriteTextFileResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn read_text_file(
        &self,
        args: ReadTextFileRequest,
    ) -> Result<ReadTextFileResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn create_terminal(
        &self,
        args: CreateTerminalRequest,
    ) -> Result<CreateTerminalResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn terminal_output(
        &self,
        args: TerminalOutputRequest,
    ) -> Result<TerminalOutputResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn kill_terminal_command(
        &self,
        args: KillTerminalCommandRequest,
    ) -> Result<KillTerminalCommandResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn release_terminal(
        &self,
        args: ReleaseTerminalRequest,
    ) -> Result<ReleaseTerminalResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn wait_for_terminal_exit(
        &self,
        args: WaitForTerminalExitRequest,
    ) -> Result<WaitForTerminalExitResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn ext_method(
        &self,
        args: ExtRequest
    ) -> Result<ExtResponse, Error> {
        Ok(RawValue::NULL.to_owned().into())
    }

    async fn ext_notification(
        &self,
        args: ExtNotification
    ) -> Result<(), Error> {
        Ok(())
    }
}
```

### Example Implementation from Tests

```rust
#[derive(Clone)]
struct TestClient {
    permission_responses: Arc<Mutex<Vec<RequestPermissionOutcome>>>,
    file_contents: Arc<Mutex<HashMap<PathBuf, String>>>,
    written_files: Arc<Mutex<Vec<(PathBuf, String)>>>,
    session_notifications: Arc<Mutex<Vec<SessionNotification>>>,
    extension_notifications: Arc<Mutex<Vec<(String, ExtNotification)>>>,
}

impl TestClient {
    fn new() -> Self {
        Self {
            permission_responses: Arc::new(Mutex::new(Vec::new())),
            file_contents: Arc::new(Mutex::new(HashMap::new())),
            written_files: Arc::new(Mutex::new(Vec::new())),
            session_notifications: Arc::new(Mutex::new(Vec::new())),
            extension_notifications: Arc::new(Mutex::new(Vec::new())),
        }
    }

    fn add_permission_response(&self, outcome: RequestPermissionOutcome) {
        self.permission_responses.lock().unwrap().push(outcome);
    }

    fn add_file_content(&self, path: PathBuf, content: String) {
        self.file_contents.lock().unwrap().insert(path, content);
    }
}

#[async_trait::async_trait(?Send)]
impl Client for TestClient {
    // REQUIRED: Handle permission requests from agent
    async fn request_permission(
        &self,
        _arguments: RequestPermissionRequest,
    ) -> Result<RequestPermissionResponse, Error> {
        let responses = self.permission_responses.clone();
        let mut responses = responses.lock().unwrap();
        let outcome = responses
            .pop()
            .unwrap_or(RequestPermissionOutcome::Cancelled);
        Ok(RequestPermissionResponse {
            outcome,
            meta: None,
        })
    }

    // REQUIRED: Handle session update notifications from agent
    async fn session_notification(&self, args: SessionNotification) -> Result<(), Error> {
        self.session_notifications.lock().unwrap().push(args);
        Ok(())
    }

    // OPTIONAL: Only implement if you set fs.writeTextFile capability
    async fn write_text_file(
        &self,
        arguments: WriteTextFileRequest,
    ) -> Result<WriteTextFileResponse, Error> {
        self.written_files
            .lock()
            .unwrap()
            .push((arguments.path, arguments.content));
        Ok(WriteTextFileResponse::default())
    }

    // OPTIONAL: Only implement if you set fs.readTextFile capability
    async fn read_text_file(
        &self,
        arguments: ReadTextFileRequest,
    ) -> Result<ReadTextFileResponse, Error> {
        let contents = self.file_contents.lock().unwrap();
        let content = contents
            .get(&arguments.path)
            .cloned()
            .unwrap_or_else(|| "default content".to_string());
        Ok(ReadTextFileResponse {
            content,
            meta: None,
        })
    }

    // OPTIONAL: Terminal methods - use unimplemented!() if not supporting
    async fn create_terminal(
        &self,
        _args: CreateTerminalRequest,
    ) -> Result<CreateTerminalResponse, Error> {
        unimplemented!()
    }

    async fn terminal_output(
        &self,
        _args: TerminalOutputRequest,
    ) -> Result<TerminalOutputResponse, Error> {
        unimplemented!()
    }

    async fn kill_terminal_command(
        &self,
        _args: KillTerminalCommandRequest,
    ) -> Result<KillTerminalCommandResponse, Error> {
        unimplemented!()
    }

    async fn release_terminal(
        &self,
        _args: ReleaseTerminalRequest,
    ) -> Result<ReleaseTerminalResponse, Error> {
        unimplemented!()
    }

    async fn wait_for_terminal_exit(
        &self,
        _args: WaitForTerminalExitRequest,
    ) -> Result<WaitForTerminalExitResponse, Error> {
        unimplemented!()
    }

    // OPTIONAL: Extension methods for custom functionality
    async fn ext_method(&self, args: ExtRequest) -> Result<ExtResponse, Error> {
        match args.method.as_ref() {
            "example.com/ping" => {
                let response = serde_json::json!({
                    "response": "pong",
                    "params": args.params
                });
                Ok(serde_json::value::to_raw_value(&response).unwrap().into())
            }
            _ => Err(Error::method_not_found()),
        }
    }

    async fn ext_notification(&self, args: ExtNotification) -> Result<(), Error> {
        self.extension_notifications
            .lock()
            .unwrap()
            .push((args.method.to_string(), args));
        Ok(())
    }
}
```

---

## 3. Connection Creation Pattern

### Creating ClientSideConnection

The `ClientSideConnection::new()` method is the core of setting up the connection to an agent.

#### Function Signature

```rust
pub fn new(
    client: impl MessageHandler<ClientSide> + 'static,
    outgoing_bytes: impl Unpin + AsyncWrite,
    incoming_bytes: impl Unpin + AsyncRead,
    spawn: impl Fn(LocalBoxFuture<'static, ()>) + 'static,
) -> (Self, impl Future<Output = Result<()>>)
```

#### Key Points

1. **client**: Your `Client` trait implementation (anything that implements `Client` automatically implements `MessageHandler<ClientSide>`)
2. **outgoing_bytes**: Stream to send data to agent (e.g., subprocess stdin)
3. **incoming_bytes**: Stream to receive data from agent (e.g., subprocess stdout)
4. **spawn**: Function to spawn async tasks - use `tokio::task::spawn_local` for `!Send` futures
5. **Returns**: Tuple of (connection, io_task) - YOU MUST SPAWN THE IO_TASK!

### Complete Example from Tests

```rust
use futures::AsyncRead;
use futures::AsyncWrite;

fn create_connection_pair(
    client: &TestClient,
    agent: &TestAgent,
) -> (ClientSideConnection, AgentSideConnection) {
    // Create bidirectional pipes for communication
    let (client_to_agent_rx, client_to_agent_tx) = piper::pipe(1024);
    let (agent_to_client_rx, agent_to_client_tx) = piper::pipe(1024);

    // Create client-side connection (agent_conn from client's perspective)
    let (agent_conn, agent_io_task) = ClientSideConnection::new(
        client.clone(),
        client_to_agent_tx,      // outgoing to agent
        agent_to_client_rx,      // incoming from agent
        |fut| {
            tokio::task::spawn_local(fut);  // CRITICAL: Use spawn_local for !Send
        },
    );

    // Create agent-side connection (client_conn from agent's perspective)
    let (client_conn, client_io_task) = AgentSideConnection::new(
        agent.clone(),
        agent_to_client_tx,      // outgoing to client
        client_to_agent_rx,      // incoming from client
        |fut| {
            tokio::task::spawn_local(fut);  // CRITICAL: Use spawn_local for !Send
        },
    );

    // CRITICAL: Spawn the IO tasks - connection won't work without this!
    tokio::task::spawn_local(agent_io_task);
    tokio::task::spawn_local(client_io_task);

    (agent_conn, client_conn)
}
```

### Using with Subprocess (Real-World Example)

```rust
use tokio::process::Command;
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

async fn connect_to_agent_process() -> Result<ClientSideConnection> {
    let local_set = tokio::task::LocalSet::new();

    local_set.run_until(async {
        // Spawn agent as subprocess
        let mut child = Command::new("path/to/agent")
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .spawn()?;

        let stdin = child.stdin.take().unwrap().compat_write();
        let stdout = child.stdout.take().unwrap().compat_read();

        let client = MyClient::new();

        // Create connection
        let (connection, io_task) = ClientSideConnection::new(
            client,
            stdin,   // We write to agent's stdin
            stdout,  // We read from agent's stdout
            |fut| {
                tokio::task::spawn_local(fut);
            },
        );

        // MUST spawn the IO task!
        tokio::task::spawn_local(io_task);

        Ok(connection)
    }).await
}
```

### Critical Notes

1. **LocalBoxFuture Issue**: The library uses `!Send` futures, so you MUST use `tokio::task::spawn_local` and run everything inside a `LocalSet`.
2. **IO Task**: The returned `io_task` MUST be spawned, or the connection won't process messages.
3. **Compatibility**: Use `tokio_util::compat` to convert between tokio and futures traits if needed.

---

## 4. Agent Trait Usage (Making Requests)

Once you have a `ClientSideConnection`, it implements the `Agent` trait, allowing you to make requests to the agent.

### Initialize Connection

```rust
use agent_client_protocol_schema::{InitializeRequest, ClientCapabilities, VERSION};

let init_response = agent_conn
    .initialize(InitializeRequest {
        protocol_version: VERSION,  // Always use VERSION constant
        client_capabilities: ClientCapabilities {
            fs: Some(agent_client_protocol_schema::FsCapabilities {
                read_text_file: Some(true),
                write_text_file: Some(true),
            }),
            terminal: Some(false),  // Set to true if you implement terminal methods
        },
        meta: None,  // Always None unless you have custom metadata
    })
    .await?;

// Response contains:
// - protocol_version: String
// - agent_capabilities: AgentCapabilities
// - auth_methods: Vec<AuthMethod>
// - meta: Option<RawValue>
```

### Create New Session

```rust
let session_response = agent_conn
    .new_session(NewSessionRequest {
        mcp_servers: vec![],  // MCP server configurations (usually empty)
        cwd: PathBuf::from("/path/to/working/directory"),
        meta: None,
    })
    .await?;

let session_id = session_response.session_id;
// Type: SessionId(Arc<str>)

// Response also contains:
// - modes: Option<AvailableModes>
// - models: Option<Vec<Model>> (if unstable feature enabled)
```

### Send Prompt

```rust
use agent_client_protocol_schema::{ContentBlock, TextContent};

let prompt_response = agent_conn
    .prompt(PromptRequest {
        session_id: session_id.clone(),
        prompt: vec![
            ContentBlock::Text(TextContent {
                annotations: None,
                text: "Please read the file at /path/to/file.txt".to_string(),
                meta: None,
            })
        ],
        meta: None,
    })
    .await?;

// Response contains:
// - stop_reason: StopReason (EndTurn, Cancelled, MaxTokens, etc.)
// - meta: Option<RawValue>
```

### Cancel Ongoing Operation

```rust
// This is a notification (no response expected)
agent_conn
    .cancel(CancelNotification {
        session_id: session_id.clone(),
        meta: None,
    })
    .await?;
```

### Load Existing Session

```rust
let load_response = agent_conn
    .load_session(LoadSessionRequest {
        session_id: session_id.clone(),
        mcp_servers: vec![],
        cwd: PathBuf::from("/path/to/working/directory"),
        meta: None,
    })
    .await?;
```

### Example from Tests

```rust
#[tokio::test]
async fn test_basic_session_creation() {
    let local_set = tokio::task::LocalSet::new();
    local_set.run_until(async {
        let client = TestClient::new();
        let agent = TestAgent::new();

        let (agent_conn, _client_conn) = create_connection_pair(&client, &agent);

        // Initialize
        agent_conn
            .initialize(InitializeRequest {
                protocol_version: VERSION,
                client_capabilities: ClientCapabilities::default(),
                meta: None,
            })
            .await
            .expect("initialize failed");

        // Create session
        let session = agent_conn
            .new_session(NewSessionRequest {
                mcp_servers: vec![],
                cwd: PathBuf::from("/test"),
                meta: None,
            })
            .await
            .expect("new_session failed");

        // Send prompt
        agent_conn
            .prompt(PromptRequest {
                session_id: session.session_id,
                prompt: vec![
                    ContentBlock::Text(TextContent {
                        annotations: None,
                        text: "Hello!".to_string(),
                        meta: None,
                    })
                ],
                meta: None,
            })
            .await
            .expect("prompt failed");
    }).await;
}
```

---

## 5. Common Patterns

### Type Conversions

#### String to SessionId
```rust
use std::sync::Arc;

let session_id = SessionId(Arc::from("my-session-123"));
```

#### Creating ToolCallId
```rust
let tool_call_id = ToolCallId(Arc::from("read-file-001"));
```

#### Creating PermissionOptionId
```rust
let option_id = PermissionOptionId(Arc::from("allow-once"));
```

### Meta Fields

**Always use `None` unless you have custom metadata**:

```rust
InitializeRequest {
    protocol_version: VERSION,
    client_capabilities: ClientCapabilities::default(),
    meta: None,  // <-- Always None in standard usage
}
```

### Error Handling

```rust
use agent_client_protocol_schema::Error;

// Return method not found for unsupported features
async fn create_terminal(&self, _args: CreateTerminalRequest)
    -> Result<CreateTerminalResponse, Error>
{
    Err(Error::method_not_found())
}

// Or use unimplemented! if you know it won't be called
async fn create_terminal(&self, _args: CreateTerminalRequest)
    -> Result<CreateTerminalResponse, Error>
{
    unimplemented!()
}
```

### Async/Await Patterns

All operations are async and should be awaited:

```rust
// ✅ Correct
let response = connection.prompt(request).await?;

// ❌ Wrong - doesn't actually execute
let response = connection.prompt(request);
```

Use `tokio::task::yield_now()` to allow other tasks to run:

```rust
// Send multiple notifications
for update in updates {
    connection.session_notification(update).await?;
    tokio::task::yield_now().await;  // Let other tasks run
}
```

### Handling Collections

#### Storing Session Notifications
```rust
use std::sync::{Arc, Mutex};

struct MyClient {
    notifications: Arc<Mutex<Vec<SessionNotification>>>,
}

impl MyClient {
    async fn session_notification(&self, args: SessionNotification) -> Result<(), Error> {
        self.notifications.lock().unwrap().push(args);
        Ok(())
    }
}
```

---

## 6. Session Notifications

Session notifications are sent by the agent to inform the client about progress, tool calls, and content.

### All SessionUpdate Variants

```rust
pub enum SessionUpdate {
    // Agent is sending a message chunk
    AgentMessageChunk { content: ContentBlock },

    // User message chunk (usually for history replay)
    UserMessageChunk { content: ContentBlock },

    // New tool call created
    ToolCall(ToolCall),

    // Update to existing tool call
    ToolCallUpdate(ToolCallUpdate),

    // Current mode changed (if using modes feature)
    CurrentModeUpdate { mode: String },

    // Custom extension update
    ExtUpdate { method: Arc<str>, params: Box<RawValue> },
}
```

### Handling SessionNotification

```rust
async fn session_notification(&self, args: SessionNotification) -> Result<(), Error> {
    let session_id = &args.session_id;

    match args.update {
        SessionUpdate::AgentMessageChunk { content } => {
            // Handle agent text output
            if let ContentBlock::Text(text) = content {
                println!("Agent: {}", text.text);
                // Send to frontend, store in database, etc.
            }
        }

        SessionUpdate::UserMessageChunk { content } => {
            // Handle user message (usually during session replay)
            if let ContentBlock::Text(text) = content {
                println!("User: {}", text.text);
            }
        }

        SessionUpdate::ToolCall(tool_call) => {
            // New tool call - display to user
            println!("Tool call: {} ({})", tool_call.title, tool_call.id.0);
            println!("  Status: {:?}", tool_call.status);
            println!("  Kind: {:?}", tool_call.kind);
            for location in &tool_call.locations {
                println!("  Location: {:?}", location.path);
            }
        }

        SessionUpdate::ToolCallUpdate(update) => {
            // Update existing tool call
            println!("Tool call update: {}", update.id.0);

            if let Some(status) = update.fields.status {
                println!("  New status: {:?}", status);
            }

            if let Some(content) = update.fields.content {
                for item in content {
                    match item {
                        ToolCallContent::Content { content } => {
                            println!("  Content: {:?}", content);
                        }
                        ToolCallContent::Terminal { terminal_id } => {
                            println!("  Terminal: {:?}", terminal_id);
                        }
                    }
                }
            }
        }

        SessionUpdate::CurrentModeUpdate { mode } => {
            println!("Mode changed to: {}", mode);
        }

        SessionUpdate::ExtUpdate { method, params } => {
            println!("Extension update: {}", method);
        }
    }

    Ok(())
}
```

### Complete Example from Tests

```rust
#[tokio::test]
async fn test_session_notifications() {
    let local_set = tokio::task::LocalSet::new();
    local_set.run_until(async {
        let client = TestClient::new();
        let agent = TestAgent::new();

        let (_agent_conn, client_conn) = create_connection_pair(&client, &agent);

        let session_id = SessionId(Arc::from("test-session"));

        // Send user message chunk
        client_conn
            .session_notification(SessionNotification {
                session_id: session_id.clone(),
                update: SessionUpdate::UserMessageChunk {
                    content: ContentBlock::Text(TextContent {
                        annotations: None,
                        text: "Hello from user".to_string(),
                        meta: None,
                    }),
                },
                meta: None,
            })
            .await
            .expect("session_notification failed");

        // Send agent message chunk
        client_conn
            .session_notification(SessionNotification {
                session_id: session_id.clone(),
                update: SessionUpdate::AgentMessageChunk {
                    content: ContentBlock::Text(TextContent {
                        annotations: None,
                        text: "Hello from agent".to_string(),
                        meta: None,
                    }),
                },
                meta: None,
            })
            .await
            .expect("session_notification failed");

        tokio::task::yield_now().await;

        let notifications = client.session_notifications.lock().unwrap();
        assert_eq!(notifications.len(), 2);
    }).await;
}
```

### Tool Call Lifecycle

A typical tool call goes through these states:

```rust
// 1. Create tool call with Pending status
SessionUpdate::ToolCall(ToolCall {
    id: ToolCallId(Arc::from("read-001")),
    title: "Reading file".to_string(),
    kind: ToolKind::Read,
    status: ToolCallStatus::Pending,
    content: vec![],
    locations: vec![ToolCallLocation {
        path: PathBuf::from("/path/to/file.txt"),
        line: None,
        meta: None,
    }],
    raw_input: None,
    raw_output: None,
    meta: None,
})

// 2. Update to InProgress
SessionUpdate::ToolCallUpdate(ToolCallUpdate {
    id: ToolCallId(Arc::from("read-001")),
    fields: ToolCallUpdateFields {
        status: Some(ToolCallStatus::InProgress),
        ..Default::default()
    },
    meta: None,
})

// 3. Update to Completed with content
SessionUpdate::ToolCallUpdate(ToolCallUpdate {
    id: ToolCallId(Arc::from("read-001")),
    fields: ToolCallUpdateFields {
        status: Some(ToolCallStatus::Completed),
        content: Some(vec![ToolCallContent::Content {
            content: ContentBlock::Text(TextContent {
                annotations: None,
                text: "File contents here...".to_string(),
                meta: None,
            }),
        }]),
        ..Default::default()
    },
    meta: None,
})
```

---

## 7. Permission Requests

When the agent needs to perform a sensitive operation, it requests permission from the client.

### RequestPermissionRequest Structure

```rust
pub struct RequestPermissionRequest {
    pub session_id: SessionId,
    pub tool_call: ToolCallUpdate,  // Information about what it wants to do
    pub options: Vec<PermissionOption>,  // What choices the user has
    pub meta: Option<Box<RawValue>>,
}
```

### PermissionOption Structure

```rust
pub struct PermissionOption {
    pub id: PermissionOptionId,
    pub name: String,  // Display name for user
    pub kind: PermissionOptionKind,
    pub meta: Option<Box<RawValue>>,
}

pub enum PermissionOptionKind {
    AllowOnce,      // Allow this one time
    AllowAll,       // Allow all future requests of this type
    RejectOnce,     // Reject this one time
    RejectAll,      // Reject all future requests of this type
}
```

### RequestPermissionResponse Structure

```rust
pub struct RequestPermissionResponse {
    pub outcome: RequestPermissionOutcome,
    pub meta: Option<Box<RawValue>>,
}

pub enum RequestPermissionOutcome {
    Selected { option_id: PermissionOptionId },
    Cancelled,  // User cancelled or session was cancelled
}
```

### Implementation Example

```rust
async fn request_permission(
    &self,
    args: RequestPermissionRequest,
) -> Result<RequestPermissionResponse, Error> {
    // Extract information
    let tool_call_id = &args.tool_call.id;
    let session_id = &args.session_id;

    // Get the tool call title and locations
    let title = args.tool_call.fields.title.as_ref();
    let locations = args.tool_call.fields.locations.as_ref();

    // Present options to user (this is where you'd show a UI dialog)
    println!("Permission Request:");
    println!("  Tool Call: {}", tool_call_id.0);
    if let Some(title) = title {
        println!("  Title: {}", title);
    }
    if let Some(locations) = locations {
        for loc in locations {
            println!("  Location: {:?}", loc.path);
        }
    }
    println!("  Options:");
    for opt in &args.options {
        println!("    [{}] {} ({:?})", opt.id.0, opt.name, opt.kind);
    }

    // For this example, auto-approve
    // In real code, you'd wait for user input
    let selected_option = args.options
        .iter()
        .find(|opt| matches!(opt.kind, PermissionOptionKind::AllowOnce))
        .or_else(|| args.options.first());

    if let Some(option) = selected_option {
        Ok(RequestPermissionResponse {
            outcome: RequestPermissionOutcome::Selected {
                option_id: option.id.clone(),
            },
            meta: None,
        })
    } else {
        Ok(RequestPermissionResponse {
            outcome: RequestPermissionOutcome::Cancelled,
            meta: None,
        })
    }
}
```

### Complete Example from Tests

```rust
#[tokio::test]
async fn test_permission_request() {
    let local_set = tokio::task::LocalSet::new();
    local_set.run_until(async {
        let client = TestClient::new();
        let agent = TestAgent::new();

        // Pre-configure permission response
        client.add_permission_response(RequestPermissionOutcome::Selected {
            option_id: PermissionOptionId(Arc::from("allow-once")),
        });

        let (_agent_conn, client_conn) = create_connection_pair(&client, &agent);

        let session_id = SessionId(Arc::from("test-session"));
        let tool_call_id = ToolCallId(Arc::from("read-001"));

        // Agent requests permission
        let permission_result = client_conn
            .request_permission(RequestPermissionRequest {
                session_id: session_id.clone(),
                tool_call: ToolCallUpdate {
                    id: tool_call_id.clone(),
                    fields: ToolCallUpdateFields {
                        title: Some("Read /test/data.txt".to_string()),
                        locations: Some(vec![ToolCallLocation {
                            path: PathBuf::from("/test/data.txt"),
                            line: None,
                            meta: None,
                        }]),
                        ..Default::default()
                    },
                    meta: None,
                },
                options: vec![
                    PermissionOption {
                        id: PermissionOptionId(Arc::from("allow-once")),
                        name: "Allow once".to_string(),
                        kind: PermissionOptionKind::AllowOnce,
                        meta: None,
                    },
                    PermissionOption {
                        id: PermissionOptionId(Arc::from("reject-once")),
                        name: "Reject".to_string(),
                        kind: PermissionOptionKind::RejectOnce,
                        meta: None,
                    },
                ],
                meta: None,
            })
            .await
            .expect("request_permission failed");

        // Verify permission was granted
        match permission_result.outcome {
            RequestPermissionOutcome::Selected { option_id } => {
                assert_eq!(option_id.0.as_ref(), "allow-once");
            }
            RequestPermissionOutcome::Cancelled => panic!("Expected permission granted"),
        }
    }).await;
}
```

---

## 8. Complete Working Example

Here's a complete example showing all the pieces together:

```rust
use agent_client_protocol::{Client, Agent, ClientSideConnection};
use agent_client_protocol_schema::*;
use async_trait::async_trait;
use std::sync::{Arc, Mutex};
use std::path::PathBuf;
use std::collections::HashMap;
use anyhow::Result;

#[derive(Clone)]
struct MyClient {
    // Store session notifications
    notifications: Arc<Mutex<Vec<SessionNotification>>>,

    // Store file contents for read operations
    files: Arc<Mutex<HashMap<PathBuf, String>>>,

    // Track permission decisions
    permission_handler: Arc<dyn Fn(RequestPermissionRequest) -> RequestPermissionOutcome + Send + Sync>,
}

impl MyClient {
    fn new() -> Self {
        Self {
            notifications: Arc::new(Mutex::new(Vec::new())),
            files: Arc::new(Mutex::new(HashMap::new())),
            permission_handler: Arc::new(|_req| {
                // Default: auto-approve
                RequestPermissionOutcome::Selected {
                    option_id: PermissionOptionId(Arc::from("allow-once")),
                }
            }),
        }
    }

    fn add_file(&self, path: PathBuf, content: String) {
        self.files.lock().unwrap().insert(path, content);
    }
}

#[async_trait(?Send)]
impl Client for MyClient {
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> Result<RequestPermissionResponse, Error> {
        let outcome = (self.permission_handler)(args);
        Ok(RequestPermissionResponse {
            outcome,
            meta: None,
        })
    }

    async fn session_notification(&self, args: SessionNotification) -> Result<(), Error> {
        // Store notification
        self.notifications.lock().unwrap().push(args.clone());

        // Process based on type
        match args.update {
            SessionUpdate::AgentMessageChunk { content } => {
                if let ContentBlock::Text(text) = content {
                    println!("[Agent] {}", text.text);
                }
            }
            SessionUpdate::ToolCall(tool_call) => {
                println!("[Tool Call] {} - {:?}", tool_call.title, tool_call.status);
            }
            SessionUpdate::ToolCallUpdate(update) => {
                if let Some(status) = update.fields.status {
                    println!("[Tool Update] {} - {:?}", update.id.0, status);
                }
            }
            _ => {}
        }

        Ok(())
    }

    async fn read_text_file(
        &self,
        args: ReadTextFileRequest,
    ) -> Result<ReadTextFileResponse, Error> {
        let files = self.files.lock().unwrap();
        let content = files
            .get(&args.path)
            .cloned()
            .unwrap_or_else(|| format!("File not found: {:?}", args.path));

        Ok(ReadTextFileResponse {
            content,
            meta: None,
        })
    }

    async fn write_text_file(
        &self,
        args: WriteTextFileRequest,
    ) -> Result<WriteTextFileResponse, Error> {
        self.files.lock().unwrap().insert(args.path, args.content);
        Ok(WriteTextFileResponse::default())
    }

    // Terminal methods not implemented
    async fn create_terminal(&self, _: CreateTerminalRequest)
        -> Result<CreateTerminalResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn terminal_output(&self, _: TerminalOutputRequest)
        -> Result<TerminalOutputResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn kill_terminal_command(&self, _: KillTerminalCommandRequest)
        -> Result<KillTerminalCommandResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn release_terminal(&self, _: ReleaseTerminalRequest)
        -> Result<ReleaseTerminalResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn wait_for_terminal_exit(&self, _: WaitForTerminalExitRequest)
        -> Result<WaitForTerminalExitResponse, Error> {
        Err(Error::method_not_found())
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Must use LocalSet for !Send futures
    let local_set = tokio::task::LocalSet::new();

    local_set.run_until(async {
        // Create client
        let client = MyClient::new();
        client.add_file(
            PathBuf::from("/test/example.txt"),
            "Hello, World!".to_string()
        );

        // Set up pipes for communication (in real code, use subprocess stdio)
        let (client_to_agent_rx, client_to_agent_tx) = piper::pipe(1024);
        let (agent_to_client_rx, agent_to_client_tx) = piper::pipe(1024);

        // Create connection
        let (connection, io_task) = ClientSideConnection::new(
            client.clone(),
            client_to_agent_tx,
            agent_to_client_rx,
            |fut| {
                tokio::task::spawn_local(fut);
            },
        );

        // CRITICAL: Spawn IO task
        tokio::task::spawn_local(io_task);

        // Initialize connection
        let init_response = connection
            .initialize(InitializeRequest {
                protocol_version: VERSION,
                client_capabilities: ClientCapabilities {
                    fs: Some(FsCapabilities {
                        read_text_file: Some(true),
                        write_text_file: Some(true),
                    }),
                    terminal: Some(false),
                },
                meta: None,
            })
            .await?;

        println!("Initialized with protocol version: {}", init_response.protocol_version);

        // Create session
        let session = connection
            .new_session(NewSessionRequest {
                mcp_servers: vec![],
                cwd: PathBuf::from("/test"),
                meta: None,
            })
            .await?;

        println!("Created session: {}", session.session_id.0);

        // Send prompt
        let prompt_response = connection
            .prompt(PromptRequest {
                session_id: session.session_id.clone(),
                prompt: vec![ContentBlock::Text(TextContent {
                    annotations: None,
                    text: "Please read /test/example.txt".to_string(),
                    meta: None,
                })],
                meta: None,
            })
            .await?;

        println!("Prompt completed with stop reason: {:?}", prompt_response.stop_reason);

        // Check collected notifications
        let notifications = client.notifications.lock().unwrap();
        println!("Received {} notifications", notifications.len());

        Ok(())
    }).await
}
```

---

## Key Takeaways

1. **Use `tokio::task::LocalSet`** - The library uses `!Send` futures, so everything must run in a `LocalSet`
2. **Spawn the IO task** - Always spawn the IO task returned from `ClientSideConnection::new()`
3. **Implement required Client methods** - `request_permission` and `session_notification` are mandatory
4. **Use `meta: None`** - Unless you have custom metadata, always use `None`
5. **Handle all SessionUpdate variants** - Be prepared to receive any type of session update
6. **Type conversions use Arc** - `SessionId`, `ToolCallId`, etc. all wrap `Arc<str>`
7. **Check capabilities** - Only implement methods for capabilities you advertise
8. **Yield occasionally** - Use `tokio::task::yield_now()` in loops to allow other tasks to run

---

## Additional Resources

- [ACP Specification](https://agentclientprotocol.com/)
- [agent-client-protocol crate](https://crates.io/crates/agent-client-protocol)
- [agent-client-protocol-schema crate](https://crates.io/crates/agent-client-protocol-schema)
