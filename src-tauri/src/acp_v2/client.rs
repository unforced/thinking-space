// ThinkingSpaceClient - Implementation of the ACP Client trait
// This handles callbacks FROM the agent (notifications, permission requests, file ops)

use agent_client_protocol::Client;
use agent_client_protocol_schema::{
    Error, ExtNotification, ExtRequest, ExtResponse, PermissionOptionId, ReadTextFileRequest,
    ReadTextFileResponse, RequestPermissionOutcome, RequestPermissionRequest,
    RequestPermissionResponse, SessionNotification, SessionUpdate, WriteTextFileRequest,
    WriteTextFileResponse,
};
use async_trait::async_trait;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use tokio::sync::mpsc;

/// Permission request sent to frontend for user approval
#[derive(Debug, Clone, Serialize)]
pub struct FrontendPermissionRequest {
    pub request_id: String,
    pub session_id: String,
    pub tool_call_id: String,
    pub title: String,
    pub kind: String,
    pub raw_input: serde_json::Value,
    pub options: Vec<FrontendPermissionOption>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FrontendPermissionOption {
    pub option_id: String,
    pub name: String,
    pub kind: String,
}

/// Permission response from frontend
#[derive(Debug, Clone, Deserialize)]
pub struct FrontendPermissionResponse {
    pub request_id: String,
    pub option_id: Option<String>,
    pub cancelled: bool,
}

/// ThinkingSpaceClient implements the ACP Client trait
/// The agent calls methods on this when it needs something from us
#[derive(Clone)]
pub struct ThinkingSpaceClient {
    app_handle: Arc<Mutex<Option<AppHandle>>>,

    // For permission handling
    permission_tx: mpsc::UnboundedSender<FrontendPermissionRequest>,
    permission_rx: Arc<Mutex<mpsc::UnboundedReceiver<FrontendPermissionResponse>>>,

    // Track current request ID for event emission
    current_request_id: Arc<Mutex<Option<u64>>>,
}

impl ThinkingSpaceClient {
    pub fn new() -> (Self, mpsc::UnboundedSender<FrontendPermissionResponse>) {
        let (permission_tx, _internal_permission_rx) =
            mpsc::unbounded_channel::<FrontendPermissionRequest>();
        let (external_permission_tx, permission_rx) =
            mpsc::unbounded_channel::<FrontendPermissionResponse>();

        let client = Self {
            app_handle: Arc::new(Mutex::new(None)),
            permission_tx,
            permission_rx: Arc::new(Mutex::new(permission_rx)),
            current_request_id: Arc::new(Mutex::new(None)),
        };

        (client, external_permission_tx)
    }

    pub fn set_app_handle(&self, handle: AppHandle) {
        *self.app_handle.lock() = Some(handle);
    }

    pub fn set_current_request_id(&self, request_id: u64) {
        *self.current_request_id.lock() = Some(request_id);
    }

    fn emit_event(&self, event: &str, payload: impl Serialize + Clone) {
        if let Some(handle) = self.app_handle.lock().as_ref() {
            println!("[ACP V2] Emitting event: {}", event);
            let _ = handle.emit(event, payload);
        } else {
            println!(
                "[ACP V2] WARNING: Cannot emit event '{}' - no app handle!",
                event
            );
        }
    }
}

#[async_trait(?Send)]
impl Client for ThinkingSpaceClient {
    /// REQUIRED: Handle permission requests from the agent
    async fn request_permission(
        &self,
        args: RequestPermissionRequest,
    ) -> Result<RequestPermissionResponse, Error> {
        let request_id = uuid::Uuid::new_v4().to_string();

        println!(
            "[ACP V2] Permission request for tool call: {}",
            args.tool_call.id.0
        );

        // Extract fields from ToolCallUpdate
        let title = args.tool_call.fields.title.clone().unwrap_or_default();
        let kind = args
            .tool_call
            .fields
            .kind
            .map(|k| format!("{:?}", k))
            .unwrap_or_default();
        let raw_input = args.tool_call.fields.raw_input.clone().unwrap_or_default();

        let current_request_id = self.current_request_id.lock().clone();

        // Convert to frontend format
        let mut frontend_request_json = serde_json::to_value(FrontendPermissionRequest {
            request_id: request_id.clone(),
            session_id: args.session_id.0.to_string(),
            tool_call_id: args.tool_call.id.0.to_string(),
            title,
            kind,
            raw_input,
            options: args
                .options
                .iter()
                .map(|opt| FrontendPermissionOption {
                    option_id: opt.id.0.to_string(),
                    name: opt.name.clone(),
                    kind: format!("{:?}", opt.kind),
                })
                .collect(),
        })
        .unwrap();

        // Add current_request_id to the payload
        if let serde_json::Value::Object(ref mut map) = frontend_request_json {
            map.insert(
                "currentRequestId".to_string(),
                serde_json::json!(current_request_id),
            );
        }

        // Send to frontend
        self.emit_event("permission-request", frontend_request_json);

        // Wait for user response
        let response = self
            .permission_rx
            .lock()
            .recv()
            .await
            .ok_or_else(|| Error::internal_error())?;

        // Convert response
        if response.cancelled {
            Ok(RequestPermissionResponse {
                outcome: RequestPermissionOutcome::Cancelled,
                meta: None,
            })
        } else if let Some(option_id) = response.option_id {
            Ok(RequestPermissionResponse {
                outcome: RequestPermissionOutcome::Selected {
                    option_id: PermissionOptionId(Arc::from(option_id.as_str())),
                },
                meta: None,
            })
        } else {
            Err(Error::internal_error())
        }
    }

    /// REQUIRED: Handle session notifications from the agent
    async fn session_notification(&self, args: SessionNotification) -> Result<(), Error> {
        let session_id = args.session_id.0.to_string();

        match args.update {
            SessionUpdate::AgentMessageChunk { content } => {
                println!("[ACP V2] Agent message chunk received");
                // Stream agent text to frontend
                if let agent_client_protocol_schema::ContentBlock::Text(text) = content {
                    println!(
                        "[ACP V2] Emitting chunk: {}",
                        text.text.chars().take(50).collect::<String>()
                    );

                    let request_id = self.current_request_id.lock().clone();

                    self.emit_event(
                        "agent-message-chunk",
                        serde_json::json!({
                            "sessionId": session_id,
                            "requestId": request_id,
                            "text": text.text,
                        }),
                    );
                } else {
                    println!("[ACP V2] Agent chunk was not text: {:?}", content);
                }
            }

            SessionUpdate::UserMessageChunk { content } => {
                // User message chunk (usually for history replay)
                if let agent_client_protocol_schema::ContentBlock::Text(text) = content {
                    self.emit_event(
                        "user-message-chunk",
                        serde_json::json!({
                            "sessionId": session_id,
                            "text": text.text,
                        }),
                    );
                }
            }

            SessionUpdate::ToolCall(tool_call) => {
                println!(
                    "[ACP V2] Tool call: {} - {}",
                    tool_call.id.0, tool_call.title
                );

                let request_id = self.current_request_id.lock().clone();

                // Send tool call to frontend
                self.emit_event(
                    "tool-call",
                    serde_json::json!({
                        "sessionId": session_id,
                        "requestId": request_id,
                        "toolCallId": tool_call.id.0.to_string(),
                        "title": tool_call.title,
                        "status": format!("{:?}", tool_call.status),
                        "kind": format!("{:?}", tool_call.kind),
                        "rawInput": tool_call.raw_input,
                        "locations": tool_call.locations.iter().map(|loc| {
                            serde_json::json!({
                                "path": loc.path.display().to_string(),
                                "line": loc.line,
                            })
                        }).collect::<Vec<_>>(),
                    }),
                );
            }

            SessionUpdate::ToolCallUpdate(update) => {
                println!("[ACP V2] Tool call update: {}", update.id.0);

                let request_id = self.current_request_id.lock().clone();

                // Send tool call update to frontend
                self.emit_event(
                    "tool-call-update",
                    serde_json::json!({
                        "sessionId": session_id,
                        "requestId": request_id,
                        "toolCallId": update.id.0.to_string(),
                        "status": update.fields.status.map(|s| format!("{:?}", s)),
                        "content": update.fields.content,
                    }),
                );
            }

            SessionUpdate::CurrentModeUpdate { current_mode_id } => {
                println!("[ACP V2] Mode update: {}", current_mode_id);
                self.emit_event(
                    "mode-update",
                    serde_json::json!({
                        "sessionId": session_id,
                        "mode": current_mode_id.to_string(),
                    }),
                );
            }

            // Handle new variants we don't care about yet
            SessionUpdate::AgentThoughtChunk { .. } => {
                println!("[ACP V2] Agent thought chunk (not displayed)");
            }
            SessionUpdate::Plan(_) => {
                println!("[ACP V2] Plan update (not displayed)");
            }
            SessionUpdate::AvailableCommandsUpdate { .. } => {
                println!("[ACP V2] Available commands update (not displayed)");
            }
        }

        Ok(())
    }

    /// OPTIONAL: Read text file for the agent
    async fn read_text_file(
        &self,
        args: ReadTextFileRequest,
    ) -> Result<ReadTextFileResponse, Error> {
        println!("[ACP V2] Reading file: {}", args.path.display());

        std::fs::read_to_string(&args.path)
            .map(|content| ReadTextFileResponse {
                content,
                meta: None,
            })
            .map_err(|_| Error::internal_error())
    }

    /// OPTIONAL: Write text file for the agent
    async fn write_text_file(
        &self,
        args: WriteTextFileRequest,
    ) -> Result<WriteTextFileResponse, Error> {
        println!("[ACP V2] Writing file: {}", args.path.display());

        std::fs::write(&args.path, &args.content)
            .map(|_| WriteTextFileResponse { meta: None })
            .map_err(|_| Error::internal_error())
    }

    // Terminal methods - not implemented yet
    async fn create_terminal(
        &self,
        _args: agent_client_protocol_schema::CreateTerminalRequest,
    ) -> Result<agent_client_protocol_schema::CreateTerminalResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn terminal_output(
        &self,
        _args: agent_client_protocol_schema::TerminalOutputRequest,
    ) -> Result<agent_client_protocol_schema::TerminalOutputResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn kill_terminal_command(
        &self,
        _args: agent_client_protocol_schema::KillTerminalCommandRequest,
    ) -> Result<agent_client_protocol_schema::KillTerminalCommandResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn release_terminal(
        &self,
        _args: agent_client_protocol_schema::ReleaseTerminalRequest,
    ) -> Result<agent_client_protocol_schema::ReleaseTerminalResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn wait_for_terminal_exit(
        &self,
        _args: agent_client_protocol_schema::WaitForTerminalExitRequest,
    ) -> Result<agent_client_protocol_schema::WaitForTerminalExitResponse, Error> {
        Err(Error::method_not_found())
    }

    // Extension methods - not implemented
    async fn ext_method(&self, _args: ExtRequest) -> Result<ExtResponse, Error> {
        Err(Error::method_not_found())
    }

    async fn ext_notification(&self, _args: ExtNotification) -> Result<(), Error> {
        Ok(())
    }
}
