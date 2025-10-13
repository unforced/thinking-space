use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JsonRpcRequest {
    jsonrpc: String,
    id: u64,
    method: String,
    params: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JsonRpcResponse {
    jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
    #[serde(skip_serializing_if = "Option::is_none")]
    method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JsonRpcError {
    code: i32,
    message: String,
}

pub struct SidecarManager {
    process: Arc<Mutex<Option<Child>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        SidecarManager {
            process: Arc::new(Mutex::new(None)),
            app_handle: Arc::new(Mutex::new(None)),
        }
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        let mut app_handle = self.app_handle.lock().unwrap();
        *app_handle = Some(handle);
    }

    pub fn start(&self) -> Result<(), String> {
        let mut process_lock = self.process.lock().unwrap();

        if process_lock.is_some() {
            return Ok(()); // Already running
        }

        // Get the sidecar path
        let sidecar_path = self.get_sidecar_path()?;

        // Start Node.js process
        let mut child = Command::new("node")
            .arg(&sidecar_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .map_err(|e| format!("Failed to start sidecar: {}", e))?;

        // Spawn thread to read stdout and emit events
        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;

        let app_handle = self.app_handle.lock().unwrap().clone();
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                if let Ok(line) = line {
                    eprintln!(
                        "[RUST RECEIVED] {} chars: {}",
                        line.len(),
                        &line[..line.len().min(100)]
                    );
                    match serde_json::from_str::<JsonRpcResponse>(&line) {
                        Ok(response) => {
                            eprintln!(
                                "[RUST PARSED] method={:?} id={:?}",
                                response.method, response.id
                            );
                            // Emit event to frontend
                            if let Some(ref handle) = app_handle {
                                if let Err(e) = handle.emit("sidecar-message", response) {
                                    eprintln!("[RUST EMIT ERROR] {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            eprintln!("[RUST PARSE ERROR] {}", e);
                        }
                    }
                }
            }
            eprintln!("[RUST] Stdout reading thread ended");
        });

        *process_lock = Some(child);
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut process_lock = self.process.lock().unwrap();

        if let Some(mut child) = process_lock.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        Ok(())
    }

    pub fn send_request(
        &self,
        method: &str,
        params: serde_json::Value,
        id: u64,
    ) -> Result<(), String> {
        let request = JsonRpcRequest {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.to_string(),
            params,
        };

        let request_json = serde_json::to_string(&request)
            .map_err(|e| format!("Failed to serialize request: {}", e))?;

        let mut process_lock = self.process.lock().unwrap();
        let process = process_lock.as_mut().ok_or("Sidecar not running")?;

        // Send request
        let stdin = process.stdin.as_mut().ok_or("No stdin")?;
        writeln!(stdin, "{}", request_json)
            .map_err(|e| format!("Failed to write to sidecar: {}", e))?;
        stdin
            .flush()
            .map_err(|e| format!("Failed to flush stdin: {}", e))?;

        Ok(())
    }

    fn get_sidecar_path(&self) -> Result<String, String> {
        // In development, try multiple possible paths
        let current_dir =
            std::env::current_dir().map_err(|e| format!("Failed to get current dir: {}", e))?;

        let mut possible_paths = vec![
            current_dir.join("src-tauri/sidecar/agent-server.js"),
            current_dir.join("sidecar/agent-server.js"),
        ];

        // Add parent directory path if it exists
        if let Some(parent) = current_dir.parent() {
            possible_paths.push(parent.join("src-tauri/sidecar/agent-server.js"));
        }

        for path in &possible_paths {
            if path.exists() {
                return Ok(path.to_string_lossy().to_string());
            }
        }

        Err(format!(
            "Sidecar not found. Searched in:\n{}\nCurrent dir: {:?}\nMake sure to run: cd src-tauri/sidecar && npm install",
            possible_paths.iter()
                .map(|p| format!("  - {:?}", p))
                .collect::<Vec<_>>()
                .join("\n"),
            current_dir
        ))
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
    eprintln!(
        "[RUST] agent_send_message called with request_id={}",
        params.request_id
    );

    let request_params = serde_json::json!({
        "sessionId": format!("session-{}", params.request_id),
        "message": params.message,
        "apiKey": params.api_key,
        "workingDirectory": params.working_directory,
        "systemPrompt": params.system_prompt,
        "model": params.model,
        "allowedTools": params.allowed_tools,
        "maxTurns": params.max_turns,
        "conversationHistory": params.conversation_history,
    });

    eprintln!(
        "[RUST] Sending request to sidecar: {}",
        serde_json::to_string(&request_params).unwrap_or_default()
    );
    state.send_request("sendMessage", request_params, params.request_id)?;
    eprintln!("[RUST] Request sent successfully");
    Ok(())
}

#[tauri::command]
pub fn agent_start_sidecar(state: tauri::State<'_, Arc<SidecarManager>>) -> Result<(), String> {
    state.start()
}

#[tauri::command]
pub fn agent_stop_sidecar(state: tauri::State<'_, Arc<SidecarManager>>) -> Result<(), String> {
    state.stop()
}
