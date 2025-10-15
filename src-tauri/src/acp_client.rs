use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{ChildStdin, ChildStdout};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpMessage {
    pub jsonrpc: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub method: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<AcpError>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AcpError {
    pub code: i32,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
}

/// ACP Client for communicating with ACP-compatible agents
#[derive(Clone)]
pub struct AcpClient {
    stdin: Arc<Mutex<ChildStdin>>,
    stdout: Arc<Mutex<BufReader<ChildStdout>>>,
    next_id: Arc<Mutex<u64>>,
}

impl AcpClient {
    /// Create a new ACP client from stdin/stdout handles
    pub fn new(stdin: ChildStdin, stdout: ChildStdout) -> Self {
        Self {
            stdin: Arc::new(Mutex::new(stdin)),
            stdout: Arc::new(Mutex::new(BufReader::new(stdout))),
            next_id: Arc::new(Mutex::new(1)),
        }
    }

    /// Initialize the ACP connection
    pub fn initialize(&self) -> Result<AcpMessage, String> {
        println!("[ACP CLIENT] Initializing...");

        let request = AcpMessage {
            jsonrpc: "2.0".to_string(),
            id: Some(self.get_next_id()),
            method: Some("initialize".to_string()),
            params: Some(serde_json::json!({
                "protocolVersion": 1,
                "clientInfo": {
                    "name": "Thinking Space",
                    "version": "0.1.0"
                },
                "clientCapabilities": {
                    "tools": true,
                    "streaming": true
                }
            })),
            result: None,
            error: None,
        };

        self.send_request(&request)?;
        self.read_response()
    }

    /// Create a new session
    pub fn new_session(
        &self,
        working_dir: String,
        system_prompt: Option<String>,
    ) -> Result<AcpMessage, String> {
        println!("[ACP CLIENT] Creating new session...");

        let mut params = serde_json::json!({
            "workingDirectory": working_dir
        });

        if let Some(prompt) = system_prompt {
            params["systemPrompt"] = serde_json::Value::String(prompt);
        }

        let request = AcpMessage {
            jsonrpc: "2.0".to_string(),
            id: Some(self.get_next_id()),
            method: Some("session/new".to_string()),
            params: Some(params),
            result: None,
            error: None,
        };

        self.send_request(&request)?;
        self.read_response()
    }

    /// Send a prompt to the current session
    pub fn send_prompt(
        &self,
        message: String,
        context: Vec<serde_json::Value>,
    ) -> Result<AcpMessage, String> {
        println!(
            "[ACP CLIENT] Sending prompt: {}...",
            &message[..message.len().min(50)]
        );

        let request = AcpMessage {
            jsonrpc: "2.0".to_string(),
            id: Some(self.get_next_id()),
            method: Some("session/prompt".to_string()),
            params: Some(serde_json::json!({
                "message": message,
                "context": context
            })),
            result: None,
            error: None,
        };

        self.send_request(&request)?;
        self.read_response()
    }

    /// Approve a tool permission request
    pub fn approve_tool(
        &self,
        tool_id: String,
        modified_input: Option<serde_json::Value>,
    ) -> Result<(), String> {
        println!("[ACP CLIENT] Approving tool: {}", tool_id);

        let request = AcpMessage {
            jsonrpc: "2.0".to_string(),
            id: None, // Notification, no response expected
            method: Some("tool/response".to_string()),
            params: Some(serde_json::json!({
                "toolId": tool_id,
                "approved": true,
                "modifiedInput": modified_input
            })),
            result: None,
            error: None,
        };

        self.send_request(&request)
    }

    /// Deny a tool permission request
    pub fn deny_tool(&self, tool_id: String, reason: Option<String>) -> Result<(), String> {
        println!("[ACP CLIENT] Denying tool: {}", tool_id);

        let request = AcpMessage {
            jsonrpc: "2.0".to_string(),
            id: None, // Notification
            method: Some("tool/response".to_string()),
            params: Some(serde_json::json!({
                "toolId": tool_id,
                "approved": false,
                "reason": reason
            })),
            result: None,
            error: None,
        };

        self.send_request(&request)
    }

    /// Read the next message from the agent
    /// This is non-blocking and will return None if no message is available
    pub fn read_message(&self) -> Result<Option<AcpMessage>, String> {
        let mut stdout = self.stdout.lock();
        let mut line = String::new();

        match stdout.read_line(&mut line) {
            Ok(0) => {
                // EOF
                println!("[ACP CLIENT] Received EOF from agent");
                Ok(None)
            }
            Ok(_) => {
                let line = line.trim();
                if line.is_empty() {
                    return Ok(None);
                }

                println!("[ACP CLIENT] Received: {}...", &line[..line.len().min(100)]);

                let msg: AcpMessage = serde_json::from_str(line)
                    .map_err(|e| format!("Failed to parse ACP message: {} - Line: {}", e, line))?;

                Ok(Some(msg))
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                // No data available
                Ok(None)
            }
            Err(e) => Err(format!("Failed to read from agent: {}", e)),
        }
    }

    /// Send a request to the agent
    fn send_request(&self, request: &AcpMessage) -> Result<(), String> {
        let json = serde_json::to_string(request)
            .map_err(|e| format!("Failed to serialize ACP request: {}", e))?;

        println!("[ACP CLIENT] Sending: {}...", &json[..json.len().min(100)]);

        let mut stdin = self.stdin.lock();
        writeln!(stdin, "{}", json)
            .map_err(|e| format!("Failed to write to agent stdin: {}", e))?;

        stdin
            .flush()
            .map_err(|e| format!("Failed to flush agent stdin: {}", e))?;

        Ok(())
    }

    /// Read a response (blocking until message arrives)
    fn read_response(&self) -> Result<AcpMessage, String> {
        loop {
            if let Some(msg) = self.read_message()? {
                return Ok(msg);
            }
            // Small sleep to avoid busy waiting
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }

    /// Get next request ID
    fn get_next_id(&self) -> u64 {
        let mut next_id = self.next_id.lock();
        let id = *next_id;
        *next_id += 1;
        id
    }
}
