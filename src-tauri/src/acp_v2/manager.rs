// AcpManager - Manages the lifecycle of the ACP connection
// Handles process spawning, connection setup, and request/response coordination

use super::client::{FrontendPermissionResponse, ThinkingSpaceClient};
use agent_client_protocol::{Agent, ClientSideConnection};
use agent_client_protocol_schema::{
    ClientCapabilities, ContentBlock, InitializeRequest, NewSessionRequest, PromptRequest,
    SessionId, TextContent, VERSION,
};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
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
    session_id: Arc<Mutex<Option<SessionId>>>,
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
            session_id: Arc::new(Mutex::new(None)),
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
                        client_capabilities: ClientCapabilities::default(),
                        meta: None,
                    })
                    .await
                    .map_err(|e| format!("Initialize failed: {}", e))?;

                println!(
                    "[ACP V2] Initialized! Protocol version: {:?}",
                    init_response.protocol_version
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

        *self.session_id.lock() = None;
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

    let session_id_arc = state.session_id.clone();
    let working_directory = params.working_directory.clone();
    let system_prompt = params.system_prompt.clone();
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
            // Get or create session
            let session_id = {
                let lock = session_id_arc.lock();
                lock.clone()
            };

            let session_id = if let Some(id) = session_id {
                println!("[ACP V2] Reusing existing session: {}", id.0);
                id
            } else {
                println!("[ACP V2] Creating new session...");

                // Build system prompt with history if provided
                let mut full_system_prompt = system_prompt.unwrap_or_default();

                if let Some(history) = conversation_history {
                    if !history.is_empty() {
                        full_system_prompt.push_str("\n\n# Previous Conversation:\n");
                        for msg in history {
                            full_system_prompt.push_str(&format!(
                                "\n{}: {}\n",
                                if msg.role == "user" {
                                    "User"
                                } else {
                                    "Assistant"
                                },
                                msg.content
                            ));
                        }
                        full_system_prompt.push_str("\n# Current Request:\n");
                    }
                }

                let session_response = conn
                    .new_session(NewSessionRequest {
                        mcp_servers: vec![],
                        cwd: PathBuf::from(working_directory),
                        meta: None,
                    })
                    .await
                    .map_err(|e| format!("Failed to create session: {}", e))?;

                let session_id = session_response.session_id.clone();
                *session_id_arc.lock() = Some(session_id.clone());

                println!("[ACP V2] Session created: {}", session_id.0);
                session_id
            };

            // Set the current request ID so the client can include it in events
            client.set_current_request_id(request_id);

            // Send the prompt
            println!("[ACP V2] Sending prompt...");

            let prompt_result = conn
                .prompt(PromptRequest {
                    session_id: session_id.clone(),
                    prompt: vec![ContentBlock::Text(TextContent {
                        text: message,
                        annotations: None,
                        meta: None,
                    })],
                    meta: None,
                })
                .await;

            match prompt_result {
                Ok(response) => {
                    println!(
                        "[ACP V2] Prompt completed with stop reason: {:?}",
                        response.stop_reason
                    );

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
