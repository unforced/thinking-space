use crate::acp_client::AcpClient;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JsonRpcError {
    code: i32,
    message: String,
}

pub struct SidecarManager {
    process: Arc<Mutex<Option<Child>>>,
    acp_client: Arc<Mutex<Option<AcpClient>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    session_id: Arc<Mutex<Option<String>>>,
    message_thread_started: Arc<Mutex<bool>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        SidecarManager {
            process: Arc::new(Mutex::new(None)),
            acp_client: Arc::new(Mutex::new(None)),
            app_handle: Arc::new(Mutex::new(None)),
            session_id: Arc::new(Mutex::new(None)),
            message_thread_started: Arc::new(Mutex::new(false)),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.lock() = Some(handle);
    }

    pub fn start(&self, api_key: Option<String>) -> Result<(), String> {
        let mut process_lock = self.process.lock();

        if process_lock.is_some() {
            return Ok(()); // Already running
        }

        println!("[SIDECAR] Starting ACP adapter...");

        // Find npx command
        let npx_cmd = if cfg!(target_os = "windows") {
            "npx.cmd"
        } else {
            "npx"
        };

        // Get API key from parameter or environment
        let api_key_value = api_key
            .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok())
            .unwrap_or_default();

        // Start ACP adapter process
        let mut child = Command::new(npx_cmd)
            .arg("@zed-industries/claude-code-acp")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .env("ANTHROPIC_API_KEY", api_key_value)
            .spawn()
            .map_err(|e| format!("Failed to start ACP adapter: {}\nMake sure you've run: cd src-tauri && npm install @zed-industries/claude-code-acp", e))?;

        println!("[SIDECAR] ACP adapter process spawned");

        // Get stdin/stdout
        let stdin = child.stdin.take().ok_or("Failed to capture stdin")?;
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;

        // Create ACP client
        let acp_client = AcpClient::new(stdin, stdout);

        // Initialize ACP connection
        println!("[SIDECAR] Initializing ACP connection...");
        match acp_client.initialize() {
            Ok(response) => {
                println!("[SIDECAR] ACP initialized: {:?}", response);
            }
            Err(e) => {
                return Err(format!("Failed to initialize ACP: {}", e));
            }
        }

        // Store client
        *self.acp_client.lock() = Some(acp_client);

        *process_lock = Some(child);
        println!("[SIDECAR] ACP adapter started successfully");
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut process_lock = self.process.lock();

        if let Some(mut child) = process_lock.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        *self.acp_client.lock() = None;
        *self.session_id.lock() = None;

        Ok(())
    }

    pub fn get_acp_client(&self) -> Option<AcpClient> {
        self.acp_client.lock().clone()
    }

    pub fn get_session_id(&self) -> Option<String> {
        self.session_id.lock().clone()
    }

    pub fn set_session_id(&self, id: Option<String>) {
        *self.session_id.lock() = id;
    }

    pub fn start_message_thread(&self) {
        let mut started = self.message_thread_started.lock();
        if *started {
            return; // Already started
        }

        let client = match self.get_acp_client() {
            Some(c) => c,
            None => return,
        };

        let app_handle = self.app_handle.lock().clone();

        thread::spawn(move || {
            println!("[SIDECAR] Message reading thread started");
            loop {
                match client.read_message() {
                    Ok(Some(msg)) => {
                        println!("[SIDECAR] Received ACP message: {:?}", msg);

                        // Convert ACP message to our JsonRpcResponse format for frontend
                        let response = JsonRpcResponse {
                            jsonrpc: msg.jsonrpc.clone(),
                            id: msg.id,
                            result: msg.result,
                            error: msg.error.map(|e| JsonRpcError {
                                code: e.code,
                                message: e.message,
                            }),
                            method: msg.method,
                            params: msg.params,
                        };

                        // Emit to frontend
                        if let Some(ref handle) = app_handle {
                            if let Err(e) = handle.emit("sidecar-message", response) {
                                eprintln!("[SIDECAR] Failed to emit message: {}", e);
                            }
                        }
                    }
                    Ok(None) => {
                        // No message available, continue
                        std::thread::sleep(std::time::Duration::from_millis(10));
                    }
                    Err(e) => {
                        eprintln!("[SIDECAR] Error reading message: {}", e);
                        break;
                    }
                }
            }
            println!("[SIDECAR] Message reading thread ended");
        });

        *started = true;
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

// Tauri commands

#[derive(Debug, Serialize, Deserialize)]
pub struct ConversationMessage {
    pub role: String, // "user" or "assistant"
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SendMessageParams {
    pub request_id: u64,
    pub message: String,
    pub api_key: String,
    pub working_directory: String,
    pub system_prompt: Option<String>,
    pub model: Option<String>,
    pub allowed_tools: Option<Vec<String>>,
    pub max_turns: Option<u32>,
    pub conversation_history: Option<Vec<ConversationMessage>>,
}

#[tauri::command]
pub fn agent_send_message(
    state: tauri::State<'_, Arc<SidecarManager>>,
    params: SendMessageParams,
) -> Result<(), String> {
    println!(
        "[SIDECAR CMD] agent_send_message called with request_id={}",
        params.request_id
    );

    let client = state.get_acp_client().ok_or("ACP client not initialized")?;

    // Get or create session
    let session_id = if let Some(id) = state.get_session_id() {
        id
    } else {
        println!("[SIDECAR CMD] Creating new ACP session...");

        // Build system prompt with conversation history if provided
        let mut full_system_prompt = params.system_prompt.clone().unwrap_or_default();

        if let Some(history) = &params.conversation_history {
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

        let response =
            client.new_session(params.working_directory.clone(), Some(full_system_prompt))?;

        println!("[SIDECAR CMD] Session created response: {:?}", response);

        // Debug: print the full result structure
        if let Some(ref result) = response.result {
            println!(
                "[SIDECAR CMD] Result keys: {:?}",
                result.as_object().map(|o| o.keys().collect::<Vec<_>>())
            );
        }

        // Extract session ID from response
        let session_id = response
            .result
            .as_ref()
            .and_then(|r| r.get("sessionId"))
            .and_then(|s| s.as_str())
            .ok_or_else(|| format!("No sessionId in response. Full response: {:?}", response))?
            .to_string();

        println!("[SIDECAR CMD] Session ID: {}", session_id);
        state.set_session_id(Some(session_id.clone()));

        // Now that session is created, start the message reading thread
        // to handle streaming responses
        state.start_message_thread();

        session_id
    };

    // Send the prompt
    println!("[SIDECAR CMD] Sending prompt via ACP...");

    // Format prompt as ACP expects: array of chunks
    let prompt_chunks = vec![serde_json::json!({
        "type": "text",
        "text": params.message
    })];

    client.send_prompt(session_id, prompt_chunks)?;
    println!("[SIDECAR CMD] Prompt sent, responses will arrive as notifications");

    Ok(())
}

#[tauri::command]
pub fn agent_start_sidecar(
    state: tauri::State<'_, Arc<SidecarManager>>,
    api_key: Option<String>,
) -> Result<(), String> {
    state.start(api_key)
}

#[tauri::command]
pub fn agent_stop_sidecar(state: tauri::State<'_, Arc<SidecarManager>>) -> Result<(), String> {
    state.stop()
}
