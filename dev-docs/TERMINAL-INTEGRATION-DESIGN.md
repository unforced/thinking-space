# Terminal Integration Design

**Status:** 🚧 In Progress
**Priority:** High (Priority #3 from roadmap)
**Estimated Time:** 1 week
**Started:** October 18, 2025

## Overview

Implement embedded terminal support using ACP's built-in terminal protocol. This allows Claude to run commands directly in integrated terminals, similar to Zed's implementation.

## ACP Terminal Types (Already Available!)

The `agent-client-protocol-schema` crate (v0.4.9) already includes all terminal types:

### Request/Response Types

```rust
// From agent-client-protocol-schema-0.4.9/rust/client.rs

pub struct CreateTerminalRequest {
    pub session_id: SessionId,
    pub command: String,
    pub args: Vec<String>,
    pub env: Vec<EnvVariable>,
    pub cwd: Option<PathBuf>,
    pub max_output_bytes: Option<usize>,
    pub meta: Option<serde_json::Value>,
}

pub struct CreateTerminalResponse {
    pub terminal_id: TerminalId,
    pub meta: Option<serde_json::Value>,
}

pub struct TerminalOutputRequest {
    pub session_id: SessionId,
    pub terminal_id: TerminalId,
    pub meta: Option<serde_json::Value>,
}

pub struct TerminalOutputResponse {
    pub output: String,
    pub exit_status: Option<i32>,
    pub meta: Option<serde_json::Value>,
}

pub struct KillTerminalCommandRequest {
    pub session_id: SessionId,
    pub terminal_id: TerminalId,
    pub meta: Option<serde_json::Value>,
}

pub struct KillTerminalCommandResponse {
    pub meta: Option<serde_json::Value>,
}

pub struct ReleaseTerminalRequest {
    pub session_id: SessionId,
    pub terminal_id: TerminalId,
    pub meta: Option<serde_json::Value>,
}

pub struct ReleaseTerminalResponse {
    pub meta: Option<serde_json::Value>,
}

pub struct WaitForTerminalExitRequest {
    pub session_id: SessionId,
    pub terminal_id: TerminalId,
    pub meta: Option<serde_json::Value>,
}

pub struct WaitForTerminalExitResponse {
    pub exit_status: i32,
    pub meta: Option<serde_json::Value>,
}
```

### Client Trait Methods (To Implement)

```rust
#[async_trait(?Send)]
pub trait Client {
    // ... other methods ...

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
}
```

## Architecture

### Backend (Rust)

#### New Module: `terminal.rs`

Manages terminal processes and captures output.

```rust
use std::collections::HashMap;
use std::process::Stdio;
use tokio::process::{Child, Command};
use tokio::io::{AsyncReadExt, BufReader};
use parking_lot::Mutex;
use std::sync::Arc;

pub struct TerminalId(pub Arc<str>);

pub struct Terminal {
    id: TerminalId,
    process: Child,
    output: String,
    exit_status: Option<i32>,
    max_output_bytes: usize,
}

pub struct TerminalManager {
    terminals: Arc<Mutex<HashMap<String, Terminal>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn create_terminal(
        &self,
        command: String,
        args: Vec<String>,
        env: Vec<(String, String)>,
        cwd: Option<PathBuf>,
        max_output_bytes: Option<usize>,
    ) -> Result<TerminalId, String> {
        // Generate unique ID
        let terminal_id = TerminalId(Arc::from(uuid::Uuid::new_v4().to_string()));

        // Spawn process
        let mut cmd = Command::new(&command);
        cmd.args(&args);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());

        for (key, value) in env {
            cmd.env(key, value);
        }

        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
        }

        let mut child = cmd.spawn()
            .map_err(|e| format!("Failed to spawn terminal: {}", e))?;

        // Store terminal
        let terminal = Terminal {
            id: terminal_id.clone(),
            process: child,
            output: String::new(),
            exit_status: None,
            max_output_bytes: max_output_bytes.unwrap_or(1_000_000), // 1MB default
        };

        self.terminals.lock().insert(terminal_id.0.to_string(), terminal);

        // Start output capture task
        self.start_output_capture(terminal_id.clone());

        Ok(terminal_id)
    }

    pub async fn get_output(&self, terminal_id: &str) -> Result<(String, Option<i32>), String> {
        let terminals = self.terminals.lock();
        let terminal = terminals.get(terminal_id)
            .ok_or_else(|| "Terminal not found".to_string())?;

        Ok((terminal.output.clone(), terminal.exit_status))
    }

    pub async fn kill(&self, terminal_id: &str) -> Result<(), String> {
        let mut terminals = self.terminals.lock();
        if let Some(terminal) = terminals.get_mut(terminal_id) {
            terminal.process.kill().await
                .map_err(|e| format!("Failed to kill terminal: {}", e))?;
        }
        Ok(())
    }

    pub async fn release(&self, terminal_id: &str) -> Result<(), String> {
        let mut terminals = self.terminals.lock();
        terminals.remove(terminal_id);
        Ok(())
    }

    pub async fn wait_for_exit(&self, terminal_id: &str) -> Result<i32, String> {
        // Poll until exit status is available
        loop {
            {
                let terminals = self.terminals.lock();
                if let Some(terminal) = terminals.get(terminal_id) {
                    if let Some(status) = terminal.exit_status {
                        return Ok(status);
                    }
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    }

    fn start_output_capture(&self, terminal_id: TerminalId) {
        let terminals = self.terminals.clone();

        tokio::spawn(async move {
            // Capture stdout and stderr
            // Update terminal.output
            // Set exit_status when process exits
        });
    }
}
```

#### Update `client.rs` - Implement Terminal Methods

```rust
use crate::terminal::TerminalManager;

pub struct ThinkingSpaceClient {
    // ... existing fields ...
    terminal_manager: Arc<TerminalManager>,
}

impl ThinkingSpaceClient {
    pub fn new() -> (Self, mpsc::UnboundedSender<FrontendPermissionResponse>) {
        // ... existing code ...

        let terminal_manager = Arc::new(TerminalManager::new());

        (
            Self {
                // ... existing fields ...
                terminal_manager,
            },
            permission_response_tx,
        )
    }
}

#[async_trait(?Send)]
impl Client for ThinkingSpaceClient {
    // ... existing methods ...

    async fn create_terminal(
        &self,
        args: CreateTerminalRequest,
    ) -> Result<CreateTerminalResponse, Error> {
        println!("[ACP TERMINAL] Creating terminal: {} {:?}", args.command, args.args);

        let env = args.env.into_iter()
            .map(|e| (e.name, e.value))
            .collect();

        let terminal_id = self.terminal_manager
            .create_terminal(
                args.command,
                args.args,
                env,
                args.cwd,
                args.max_output_bytes,
            )
            .await
            .map_err(|e| Error::internal_error(&e))?;

        // Emit event to frontend
        if let Some(handle) = self.app_handle.lock().as_ref() {
            let _ = handle.emit(
                "terminal-created",
                serde_json::json!({
                    "sessionId": args.session_id.0,
                    "terminalId": terminal_id.0,
                    "command": format!("{}", args.command),
                }),
            );
        }

        Ok(CreateTerminalResponse {
            terminal_id,
            meta: None,
        })
    }

    async fn terminal_output(
        &self,
        args: TerminalOutputRequest,
    ) -> Result<TerminalOutputResponse, Error> {
        let (output, exit_status) = self.terminal_manager
            .get_output(&args.terminal_id.0)
            .await
            .map_err(|e| Error::internal_error(&e))?;

        Ok(TerminalOutputResponse {
            output,
            exit_status,
            meta: None,
        })
    }

    async fn kill_terminal_command(
        &self,
        args: KillTerminalCommandRequest,
    ) -> Result<KillTerminalCommandResponse, Error> {
        self.terminal_manager
            .kill(&args.terminal_id.0)
            .await
            .map_err(|e| Error::internal_error(&e))?;

        Ok(KillTerminalCommandResponse { meta: None })
    }

    async fn release_terminal(
        &self,
        args: ReleaseTerminalRequest,
    ) -> Result<ReleaseTerminalResponse, Error> {
        self.terminal_manager
            .release(&args.terminal_id.0)
            .await
            .map_err(|e| Error::internal_error(&e))?;

        Ok(ReleaseTerminalResponse { meta: None })
    }

    async fn wait_for_terminal_exit(
        &self,
        args: WaitForTerminalExitRequest,
    ) -> Result<WaitForTerminalExitResponse, Error> {
        let exit_status = self.terminal_manager
            .wait_for_exit(&args.terminal_id.0)
            .await
            .map_err(|e| Error::internal_error(&e))?;

        Ok(WaitForTerminalExitResponse {
            exit_status,
            meta: None,
        })
    }
}
```

#### Update `manager.rs` - Enable Terminal Capability

```rust
// In agent_v2_start, update initialize to advertise terminal support:

let init_response = conn
    .initialize(InitializeRequest {
        protocol_version: VERSION,
        client_capabilities: ClientCapabilities {
            fs: Some(FsCapabilities {
                read_text_file: Some(true),
                write_text_file: Some(true),
            }),
            terminal: Some(true), // ← Enable terminal support
        },
        meta: None,
    })
    .await
    .map_err(|e| format!("Failed to initialize: {}", e))?;
```

### Frontend (React/TypeScript)

#### New Component: `TerminalView.tsx`

Uses xterm.js to display terminal output.

```typescript
import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalViewProps {
  terminalId: string;
  sessionId: string;
  command: string;
  onClose?: () => void;
}

export function TerminalView({ terminalId, sessionId, command, onClose }: TerminalViewProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);

    terminal.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Write command
    terminal.writeln(`$ ${command}`);
    terminal.writeln('');

    // Cleanup
    return () => {
      terminal.dispose();
    };
  }, [terminalId, command]);

  return (
    <div className="terminal-container">
      <div className="terminal-header">
        <span className="terminal-title">{command}</span>
        <button onClick={onClose} className="terminal-close">×</button>
      </div>
      <div ref={terminalRef} className="terminal-body" />
    </div>
  );
}
```

#### Update `agentService.ts` - Handle Terminal Events

```typescript
export interface TerminalInfo {
  terminalId: string;
  sessionId: string;
  command: string;
  output: string;
  exitStatus: number | null;
}

export class AgentService {
  // ... existing fields ...

  private activeTerminals = new Map<string, TerminalInfo>();

  // Callbacks for UI
  public onTerminalCreated?: (terminal: TerminalInfo) => void;
  public onTerminalOutput?: (terminalId: string, output: string) => void;
  public onTerminalExit?: (terminalId: string, exitStatus: number) => void;

  private setupSidecarListener() {
    // ... existing listeners ...

    // Listen for terminal created event
    listen<{ sessionId: string; terminalId: string; command: string }>(
      "terminal-created",
      (event) => {
        const { sessionId, terminalId, command } = event.payload;
        console.log("[FRONTEND V2] Terminal created:", terminalId, command);

        const terminal: TerminalInfo = {
          terminalId,
          sessionId,
          command,
          output: '',
          exitStatus: null,
        };

        this.activeTerminals.set(terminalId, terminal);

        if (this.onTerminalCreated) {
          this.onTerminalCreated(terminal);
        }
      }
    ).catch(console.error);

    // Listen for terminal output updates
    listen<{ terminalId: string; output: string; exitStatus: number | null }>(
      "terminal-output",
      (event) => {
        const { terminalId, output, exitStatus } = event.payload;

        const terminal = this.activeTerminals.get(terminalId);
        if (terminal) {
          terminal.output = output;
          terminal.exitStatus = exitStatus;

          if (this.onTerminalOutput) {
            this.onTerminalOutput(terminalId, output);
          }

          if (exitStatus !== null && this.onTerminalExit) {
            this.onTerminalExit(terminalId, exitStatus);
          }
        }
      }
    ).catch(console.error);
  }
}
```

#### Update `ChatArea.tsx` - Show Terminals

```typescript
import { TerminalView } from './TerminalView';

export function ChatArea() {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);

  useEffect(() => {
    // Register terminal callbacks
    agentService.onTerminalCreated = (terminal) => {
      setTerminals(prev => [...prev, terminal]);
    };

    agentService.onTerminalOutput = (terminalId, output) => {
      setTerminals(prev =>
        prev.map(t =>
          t.terminalId === terminalId ? { ...t, output } : t
        )
      );
    };

    return () => {
      agentService.onTerminalCreated = undefined;
      agentService.onTerminalOutput = undefined;
    };
  }, []);

  return (
    <div className="chat-area">
      {/* ... existing message display ... */}

      {/* Show active terminals */}
      {terminals.map(terminal => (
        <TerminalView
          key={terminal.terminalId}
          terminalId={terminal.terminalId}
          sessionId={terminal.sessionId}
          command={terminal.command}
          onClose={() => {
            setTerminals(prev => prev.filter(t => t.terminalId !== terminal.terminalId));
          }}
        />
      ))}
    </div>
  );
}
```

## User Experience Flow

1. **User asks Claude to run a command:**
   ```
   User: "Run `npm test` in the project directory"
   ```

2. **Claude creates a terminal:**
   - Agent calls `create_terminal` with command="npm", args=["test"]
   - Backend spawns process and captures output
   - Backend emits `terminal-created` event to frontend
   - Frontend displays terminal panel with xterm.js

3. **Terminal output streams:**
   - Backend captures stdout/stderr continuously
   - Updates are sent via `terminal-output` events
   - Frontend appends to xterm.js terminal

4. **Process completes:**
   - Backend detects exit
   - Sets exit_status
   - Emits final `terminal-output` event with exit status
   - Frontend shows completion (green/red based on status)

5. **User can close terminal:**
   - Click × button in terminal header
   - Frontend calls `release_terminal` to clean up

## Implementation Plan

### Phase 1: Backend Foundation (Day 1-2)
- [x] Research ACP terminal types ✅
- [ ] Create `terminal.rs` module
- [ ] Implement `TerminalManager`
- [ ] Add terminal methods to `ThinkingSpaceClient`
- [ ] Enable terminal capability in initialization
- [ ] Test with simple commands (echo, ls)

### Phase 2: Frontend UI (Day 3-4)
- [ ] Install xterm.js dependencies
- [ ] Create `TerminalView` component
- [ ] Add terminal event listeners to `agentService`
- [ ] Integrate terminals into `ChatArea`
- [ ] Style terminal panels

### Phase 3: Integration & Testing (Day 5)
- [ ] End-to-end testing
- [ ] Test with various commands
- [ ] Test long-running processes
- [ ] Test kill/release functionality
- [ ] Handle edge cases (failures, timeouts)

### Phase 4: Polish (Day 6-7)
- [ ] Add terminal panel resizing
- [ ] Add terminal search functionality
- [ ] Terminal persistence across app restarts
- [ ] Documentation

## Dependencies

### Backend
```toml
[dependencies]
uuid = { version = "1.0", features = ["v4"] }  # For terminal IDs
tokio = { version = "1", features = ["process", "io-util"] }
```

### Frontend
```json
{
  "dependencies": {
    "@xterm/xterm": "^5.3.0",
    "@xterm/addon-fit": "^0.8.0"
  }
}
```

## Future Enhancements

1. **Interactive Terminals**
   - Allow user to type input
   - Send stdin to process
   - Support Ctrl+C, Ctrl+D

2. **Terminal History**
   - Save terminal sessions
   - Replay terminal output

3. **Multiple Terminals**
   - Tabs for multiple terminals
   - Split view

4. **Advanced Features**
   - Terminal themes
   - Copy/paste support
   - Search in output
   - Save output to file

## References

- ACP Terminal Specification: https://agentclientprotocol.com/
- xterm.js Documentation: https://xtermjs.org/
- Zed Terminal Implementation: (reference from Zed codebase)
