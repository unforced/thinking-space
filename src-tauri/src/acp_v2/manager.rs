// AcpManager - Manages the lifecycle of the ACP connection
// Handles process spawning, connection setup, and request/response coordination

use super::client::{FrontendPermissionResponse, ThinkingSpaceClient};
use crate::mcp_config::McpConfig;
use agent_client_protocol::{Agent, ClientSideConnection};
use agent_client_protocol_schema::{
    ClientCapabilities, ContentBlock, InitializeRequest, NewSessionRequest, PromptRequest,
    SessionId, TextContent, VERSION,
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot};
use tokio_util::compat::{TokioAsyncReadCompatExt, TokioAsyncWriteCompatExt};

pub struct AcpManager {
    process: Arc<Mutex<Option<tokio::process::Child>>>,
    connection: Arc<Mutex<Option<Arc<ClientSideConnection>>>>,
    client: Arc<ThinkingSpaceClient>,
    permission_response_tx: mpsc::UnboundedSender<FrontendPermissionResponse>,
    runtime: tokio::runtime::Runtime,
    // Map of working_directory -> SessionId to support multiple spaces
    sessions: Arc<Mutex<HashMap<String, SessionId>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    shutdown_tx: Arc<Mutex<Option<oneshot::Sender<()>>>>,
}

impl AcpManager {
    pub fn new() -> Self {
        let (client, permission_response_tx) = ThinkingSpaceClient::new();

        // Create multi-threaded runtime for spawning tasks
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .enable_all()
            .build()
            .expect("Failed to create tokio runtime");

        Self {
            process: Arc::new(Mutex::new(None)),
            connection: Arc::new(Mutex::new(None)),
            client: Arc::new(client),
            permission_response_tx,
            runtime,
            sessions: Arc::new(Mutex::new(HashMap::new())),
            app_handle: Arc::new(Mutex::new(None)),
            shutdown_tx: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        self.client.set_app_handle(handle.clone());
        *self.app_handle.lock() = Some(handle);
    }

    pub fn start(&self, api_key: Option<String>) -> Result<(), String> {
        // Check if already running (scope the lock)
        {
            let process_lock = self.process.lock();
            if process_lock.is_some() {
                return Ok(()); // Already running
            }
        } // Lock is dropped here

        println!("[ACP V2] Starting claude-code-acp adapter...");

        // Get API key - if not provided, adapter will use Claude Code's OAuth credentials
        let api_key_value = api_key.or_else(|| std::env::var("ANTHROPIC_API_KEY").ok());

        let client = self.client.clone();
        let connection_arc = self.connection.clone();
        let process_arc = self.process.clone();
        let shutdown_tx_arc = self.shutdown_tx.clone();
        let app_handle_arc = self.app_handle.clone();

        // Create shutdown channel
        let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();
        *shutdown_tx_arc.lock() = Some(shutdown_tx);

        // Spawn in background thread to avoid blocking
        std::thread::spawn(move || {
            println!("[ACP V2] Start thread spawned");

            // Create runtime for this thread
            let rt = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();

            let local_set = tokio::task::LocalSet::new();

            // Use run_until instead of block_on - this keeps LocalSet alive
            let result: Result<(), String> = rt.block_on(local_set.run_until(async move {
                // Spawn the ACP adapter process
                let mut cmd = tokio::process::Command::new("npx");
                cmd.arg("@zed-industries/claude-code-acp")
                    .stdin(std::process::Stdio::piped())
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::inherit());

                // Only set ANTHROPIC_API_KEY if we have one (for API key auth)
                // Otherwise, adapter will use Claude Code's OAuth credentials
                if let Some(key) = api_key_value {
                    println!("[ACP V2] Using API key authentication");
                    cmd.env("ANTHROPIC_API_KEY", key);
                } else {
                    println!("[ACP V2] Using Claude Code OAuth credentials");
                }

                let mut child = cmd
                    .spawn()
                    .map_err(|e| format!("Failed to spawn adapter: {}", e))?;

                println!("[ACP V2] Adapter process spawned");

                // Get stdin/stdout with compat wrappers for futures traits
                let stdin = child.stdin.take().unwrap().compat_write();
                let stdout = child.stdout.take().unwrap().compat();

                // Create the connection
                // The spawn function must return () and work with LocalBoxFuture
                let (conn, io_task) =
                    ClientSideConnection::new((*client).clone(), stdin, stdout, |fut| {
                        tokio::task::spawn_local(fut);
                    });

                println!("[ACP V2] Connection created, spawning IO task...");

                // CRITICAL: Must spawn the IO task or connection won't work
                tokio::task::spawn_local(io_task);

                println!("[ACP V2] Initializing ACP protocol...");

                // Initialize the connection
                let init_response = conn
                    .initialize(InitializeRequest {
                        protocol_version: VERSION,
                        client_capabilities: ClientCapabilities {
                            terminal: true, // Enable terminal support
                            ..Default::default()
                        },
                        meta: None,
                    })
                    .await
                    .map_err(|e| format!("Initialize failed: {}", e))?;

                println!(
                    "[ACP V2] Initialized! Protocol version: {:?}",
                    init_response.protocol_version
                );
                println!(
                    "[ACP V2] Agent capabilities - load_session: {}",
                    init_response.agent_capabilities.load_session
                );

                // Store connection and process (wrap connection in Arc)
                *connection_arc.lock() = Some(Arc::new(conn));
                *process_arc.lock() = Some(child);

                println!("[ACP V2] Connection ready, waiting for shutdown signal...");

                // Emit ready event to frontend
                if let Some(handle) = app_handle_arc.lock().as_ref() {
                    let _ = handle.emit("agent-ready", ());
                    println!("[ACP V2] Emitted agent-ready event");
                }

                // CRITICAL: Wait for shutdown signal to keep LocalSet alive
                // This is like Zed's interactive loop - keeps the IO task running
                let _ = shutdown_rx.await;

                println!("[ACP V2] Shutdown signal received");

                Ok::<(), String>(())
            }));

            if let Err(e) = result {
                eprintln!("[ACP V2] Start failed: {}", e);
            }
        });

        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        // Send shutdown signal to background thread
        if let Some(tx) = self.shutdown_tx.lock().take() {
            let _ = tx.send(());
            println!("[ACP V2] Sent shutdown signal");
        }

        // Clear connection
        *self.connection.lock() = None;

        // Kill the adapter process
        if let Some(mut child) = self.process.lock().take() {
            self.runtime.block_on(async move {
                let _ = child.kill().await;
                let _ = child.wait().await;
            });
        }

        self.sessions.lock().clear();
        println!("[ACP V2] Stopped");
        Ok(())
    }

    pub fn send_permission_response(
        &self,
        response: FrontendPermissionResponse,
    ) -> Result<(), String> {
        self.permission_response_tx
            .send(response)
            .map_err(|e| format!("Failed to send permission response: {}", e))
    }
}

// Tauri command types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SendMessageParams {
    pub request_id: u64,
    pub message: String,
    pub working_directory: String,
    pub system_prompt: Option<String>,
    pub conversation_history: Option<Vec<ConversationMessage>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: String,
    pub content: String,
}

// Tauri commands
#[tauri::command]
pub fn agent_v2_send_message(
    state: tauri::State<'_, Arc<AcpManager>>,
    params: SendMessageParams,
) -> Result<(), String> {
    println!(
        "[ACP V2] Sending message (request_id={}): {}",
        params.request_id,
        params.message.chars().take(50).collect::<String>()
    );

    let conn = {
        let lock = state.connection.lock();
        lock.as_ref().ok_or("Not connected")?.clone()
    };

    let sessions_map = state.sessions.clone();
    let working_directory = params.working_directory.clone();
    let _system_prompt = params.system_prompt.clone(); // Reserved for future use
    let message = params.message.clone();
    let conversation_history = params.conversation_history.clone();
    let app_handle_arc = state.app_handle.clone();
    let request_id = params.request_id;
    let client = state.client.clone();

    println!("[ACP V2] About to spawn thread for request {}", request_id);

    // Spawn in new thread with LocalSet - returns immediately
    std::thread::spawn(move || {
        println!(
            "[ACP V2] Thread spawned, creating runtime for request {}",
            request_id
        );

        // Create runtime for this thread
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap();

        println!(
            "[ACP V2] Runtime created, creating LocalSet for request {}",
            request_id
        );
        let local_set = tokio::task::LocalSet::new();

        println!(
            "[ACP V2] About to block_on LocalSet for request {}",
            request_id
        );
        let _ = local_set.block_on(&rt, async move {
            println!(
                "[ACP V2] Inside LocalSet async block for request {}",
                request_id
            );
            // Get or create session for this space
            let cached_session_id = {
                let lock = sessions_map.lock();
                lock.get(&working_directory).cloned()
            };

            // Set the current request ID so the client can include it in events
            client.set_current_request_id(request_id);

            // Determine if we need to create a new session
            // We ONLY create a new session if no cached session exists for this space
            // Having conversation_history doesn't mean we need a new session -
            // it's sent on every message by the frontend
            let need_new_session = cached_session_id.is_none();

            let mut session_id = cached_session_id;

            // If we need a new session (first message or restoring conversation), create it
            if need_new_session {
                println!("[ACP V2] Creating new session for conversation...");

                // Load MCP configuration from the Space directory
                let mcp_config = McpConfig::load_from_space(Path::new(&working_directory))
                    .unwrap_or_else(|e| {
                        println!("[ACP V2] Failed to load MCP config: {}, using no servers", e);
                        McpConfig {
                            mcp_servers: HashMap::new(),
                        }
                    });

                let mcp_servers = mcp_config.to_acp_servers();

                if !mcp_servers.is_empty() {
                    let server_names: Vec<&str> = mcp_servers.iter().map(|s| match s {
                        agent_client_protocol_schema::McpServer::Stdio { name, .. } => name.as_str(),
                        agent_client_protocol_schema::McpServer::Http { name, .. } => name.as_str(),
                        agent_client_protocol_schema::McpServer::Sse { name, .. } => name.as_str(),
                    }).collect();
                    println!("[ACP V2] Loaded {} MCP server(s): {}",
                        mcp_servers.len(),
                        server_names.join(", ")
                    );
                }

                // Create new session
                let session_response = conn
                    .new_session(NewSessionRequest {
                        mcp_servers,
                        cwd: PathBuf::from(working_directory.clone()),
                        meta: None,
                    })
                    .await
                    .map_err(|e| format!("Failed to create session: {}", e))?;

                session_id = Some(session_response.session_id.clone());

                // Store session ID for this space
                sessions_map.lock().insert(
                    working_directory.clone(),
                    session_response.session_id.clone()
                );

                println!(
                    "[ACP V2] New session created for space '{}': {}",
                    working_directory,
                    session_response.session_id.0
                );

                // Emit session created event to frontend
                if let Some(handle) = app_handle_arc.lock().as_ref() {
                    let _ = handle.emit(
                        "agent-session-created",
                        serde_json::json!({
                            "sessionId": session_response.session_id.0,
                        }),
                    );
                }

            }

            // Prepare the current prompt
            // If we just created a new session and have conversation history,
            // include the history in this first prompt so the SDK can see
            // the full conversation for context compaction
            let prompt_text = if need_new_session && conversation_history.is_some() {
                let history = conversation_history.as_ref().unwrap();
                if !history.is_empty() {
                    println!(
                        "[ACP V2] Including {} previous messages as context in first prompt",
                        history.len()
                    );

                    // Format history as text that the SDK can use for context
                    let mut history_text = String::from("This session is being continued from a previous conversation. Here is the conversation history:\n\n");

                    for msg in history.iter() {
                        history_text.push_str(&format!("<previous_{}>\n{}\n</previous_{}>\n\n",
                            msg.role, msg.content, msg.role));
                    }

                    history_text.push_str("--- End of previous conversation ---\n\nCurrent message:\n");
                    history_text.push_str(&message);

                    history_text
                } else {
                    message.clone()
                }
            } else {
                message.clone()
            };

            // Send the prompt
            println!("[ACP V2] Sending prompt ({} chars)...", prompt_text.len());

            let prompt_result = if let Some(ref sid) = session_id {
                conn.prompt(PromptRequest {
                    session_id: sid.clone(),
                    prompt: vec![ContentBlock::Text(TextContent {
                        text: prompt_text,
                        annotations: None,
                        meta: None,
                    })],
                    meta: None,
                })
                .await
            } else {
                // This should never happen now
                return Err("[ACP V2] No session available after creation attempt".to_string());
            };

            // Handle the prompt result
            match prompt_result {
                Ok(response) => {
                    println!(
                        "[ACP V2] Prompt completed with stop reason: {:?}",
                        response.stop_reason
                    );

                    // Check if we hit max tokens
                    use agent_client_protocol_schema::StopReason;
                    if matches!(response.stop_reason, StopReason::MaxTokens) {
                        eprintln!("[ACP V2] WARNING: Hit max tokens limit!");
                        // Emit special event for max tokens
                        if let Some(handle) = app_handle_arc.lock().as_ref() {
                            let _ = handle.emit(
                                "agent-max-tokens",
                                serde_json::json!({
                                    "requestId": request_id,
                                    "message": "Conversation has reached the maximum context window. Consider starting a fresh conversation.",
                                }),
                            );
                        }
                    }

                    // Emit completion event to frontend
                    if let Some(handle) = app_handle_arc.lock().as_ref() {
                        let _ = handle.emit(
                            "agent-message-complete",
                            serde_json::json!({
                                "requestId": request_id,
                                "stopReason": format!("{:?}", response.stop_reason),
                            }),
                        );
                    }
                }
                Err(e) => {
                    eprintln!("[ACP V2] Prompt failed: {}", e);

                    // Emit error event to frontend
                    if let Some(handle) = app_handle_arc.lock().as_ref() {
                        let _ = handle.emit(
                            "agent-message-error",
                            serde_json::json!({
                                "requestId": request_id,
                                "error": e.to_string(),
                            }),
                        );
                    }
                }
            }

            Ok::<(), String>(())
        });
    });

    Ok(())
}

#[tauri::command]
pub fn agent_v2_start(
    state: tauri::State<'_, Arc<AcpManager>>,
    api_key: Option<String>,
) -> Result<(), String> {
    state.start(api_key)
}

#[tauri::command]
pub fn agent_v2_stop(state: tauri::State<'_, Arc<AcpManager>>) -> Result<(), String> {
    state.stop()
}

#[tauri::command]
pub fn agent_v2_send_permission_response(
    state: tauri::State<'_, Arc<AcpManager>>,
    response: FrontendPermissionResponse,
) -> Result<(), String> {
    state.send_permission_response(response)
}

// Note: Session management is now automatic and per-space
// Sessions are created on-demand and cached in the sessions HashMap
// No need for manual get/set session ID commands
