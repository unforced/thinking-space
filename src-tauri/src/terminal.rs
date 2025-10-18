// Terminal management for ACP terminal integration
// Handles spawning, managing, and capturing output from terminal processes

use agent_client_protocol_schema::TerminalId;
use parking_lot::Mutex;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

/// Represents a single terminal instance
pub struct Terminal {
    pub id: String,
    pub process: Option<Child>,
    pub output: String,
    pub exit_status: Option<i32>,
    pub max_output_bytes: usize,
}

impl Terminal {
    fn new(id: String, process: Child, max_output_bytes: usize) -> Self {
        Self {
            id,
            process: Some(process),
            output: String::new(),
            exit_status: None,
            max_output_bytes,
        }
    }

    /// Append output while respecting max_output_bytes limit
    /// Truncates from the beginning if limit exceeded
    fn append_output(&mut self, new_output: &str) {
        self.output.push_str(new_output);

        // Truncate from beginning if exceeds limit
        if self.output.len() > self.max_output_bytes {
            let excess = self.output.len() - self.max_output_bytes;
            // Find a character boundary to truncate at
            let mut truncate_at = excess;
            while truncate_at < self.output.len() && !self.output.is_char_boundary(truncate_at) {
                truncate_at += 1;
            }
            self.output = self.output[truncate_at..].to_string();
        }
    }
}

/// Manages multiple terminal instances
pub struct TerminalManager {
    terminals: Arc<Mutex<HashMap<String, Terminal>>>,
}

impl TerminalManager {
    pub fn new() -> Self {
        Self {
            terminals: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Create a new terminal and start capturing output
    pub async fn create_terminal(
        &self,
        command: String,
        args: Vec<String>,
        env: Vec<(String, String)>,
        cwd: Option<PathBuf>,
        max_output_bytes: Option<usize>,
    ) -> Result<TerminalId, String> {
        // Generate unique ID
        let terminal_id = uuid::Uuid::new_v4().to_string();

        println!(
            "[TERMINAL] Creating terminal {}: {} {:?}",
            terminal_id, command, args
        );

        // Build command
        let mut cmd = Command::new(&command);
        cmd.args(&args);
        cmd.stdout(Stdio::piped());
        cmd.stderr(Stdio::piped());
        cmd.kill_on_drop(true);

        // Set environment variables
        for (key, value) in env {
            cmd.env(key, value);
        }

        // Set working directory
        if let Some(cwd) = cwd {
            cmd.current_dir(cwd);
        }

        // Spawn process
        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Failed to spawn terminal: {}", e))?;

        // Take stdout and stderr for capture
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Failed to capture stdout".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Failed to capture stderr".to_string())?;

        // Store terminal
        let terminal = Terminal::new(
            terminal_id.clone(),
            child,
            max_output_bytes.unwrap_or(1_000_000), // 1MB default
        );

        self.terminals.lock().insert(terminal_id.clone(), terminal);

        // Start output capture tasks
        self.start_output_capture(terminal_id.clone(), stdout, stderr);

        Ok(TerminalId(Arc::from(terminal_id)))
    }

    /// Get current output and exit status for a terminal
    pub fn get_output(&self, terminal_id: &str) -> Result<(String, Option<i32>), String> {
        let terminals = self.terminals.lock();
        let terminal = terminals
            .get(terminal_id)
            .ok_or_else(|| "Terminal not found".to_string())?;

        Ok((terminal.output.clone(), terminal.exit_status))
    }

    /// Kill a running terminal process
    pub async fn kill(&self, terminal_id: &str) -> Result<(), String> {
        println!("[TERMINAL] Killing terminal: {}", terminal_id);

        let mut terminals = self.terminals.lock();
        if let Some(terminal) = terminals.get_mut(terminal_id) {
            if let Some(ref mut process) = terminal.process {
                process
                    .kill()
                    .await
                    .map_err(|e| format!("Failed to kill terminal: {}", e))?;
            }
        }
        Ok(())
    }

    /// Release (remove) a terminal from management
    pub fn release(&self, terminal_id: &str) -> Result<(), String> {
        println!("[TERMINAL] Releasing terminal: {}", terminal_id);

        let mut terminals = self.terminals.lock();
        terminals.remove(terminal_id);
        Ok(())
    }

    /// Wait for a terminal to exit and return its exit status
    pub async fn wait_for_exit(&self, terminal_id: &str) -> Result<i32, String> {
        println!("[TERMINAL] Waiting for terminal to exit: {}", terminal_id);

        // Poll until exit status is available
        loop {
            {
                let terminals = self.terminals.lock();
                if let Some(terminal) = terminals.get(terminal_id) {
                    if let Some(status) = terminal.exit_status {
                        println!(
                            "[TERMINAL] Terminal {} exited with status: {}",
                            terminal_id, status
                        );
                        return Ok(status);
                    }
                }
            }
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        }
    }

    /// Start async tasks to capture stdout and stderr
    fn start_output_capture(
        &self,
        terminal_id: String,
        stdout: tokio::process::ChildStdout,
        stderr: tokio::process::ChildStderr,
    ) {
        let terminals_stdout = self.terminals.clone();
        let terminals_stderr = self.terminals.clone();
        let terminals_exit = self.terminals.clone();
        let terminal_id_stdout = terminal_id.clone();
        let terminal_id_stderr = terminal_id.clone();
        let terminal_id_exit = terminal_id.clone();

        // Capture stdout
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();

            while let Ok(Some(line)) = reader.next_line().await {
                let mut terminals = terminals_stdout.lock();
                if let Some(terminal) = terminals.get_mut(&terminal_id_stdout) {
                    terminal.append_output(&line);
                    terminal.append_output("\n");
                }
            }

            println!(
                "[TERMINAL] Stdout capture ended for: {}",
                terminal_id_stdout
            );
        });

        // Capture stderr
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();

            while let Ok(Some(line)) = reader.next_line().await {
                let mut terminals = terminals_stderr.lock();
                if let Some(terminal) = terminals.get_mut(&terminal_id_stderr) {
                    terminal.append_output(&line);
                    terminal.append_output("\n");
                }
            }

            println!(
                "[TERMINAL] Stderr capture ended for: {}",
                terminal_id_stderr
            );
        });

        // Wait for process exit and capture exit status
        tokio::spawn(async move {
            // Wait for process to exit
            tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

            loop {
                let exit_status = {
                    let mut terminals = terminals_exit.lock();
                    if let Some(terminal) = terminals.get_mut(&terminal_id_exit) {
                        if let Some(ref mut process) = terminal.process {
                            match process.try_wait() {
                                Ok(Some(status)) => {
                                    let exit_code = status.code().unwrap_or(-1);
                                    terminal.exit_status = Some(exit_code);
                                    Some(exit_code)
                                }
                                Ok(None) => None, // Still running
                                Err(e) => {
                                    eprintln!("[TERMINAL] Error checking process status: {}", e);
                                    terminal.exit_status = Some(-1);
                                    Some(-1)
                                }
                            }
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                };

                if exit_status.is_some() {
                    println!(
                        "[TERMINAL] Process exited for {}: {:?}",
                        terminal_id_exit, exit_status
                    );
                    break;
                }

                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_terminal_manager_creation() {
        let manager = TerminalManager::new();
        assert!(manager.terminals.lock().is_empty());
    }

    #[tokio::test]
    async fn test_create_simple_terminal() {
        let manager = TerminalManager::new();

        let terminal_id = manager
            .create_terminal(
                "echo".to_string(),
                vec!["Hello, Terminal!".to_string()],
                vec![],
                None,
                None,
            )
            .await
            .expect("Failed to create terminal");

        // Wait a bit for output
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        let (output, exit_status) = manager
            .get_output(&terminal_id.0)
            .expect("Failed to get output");

        assert!(output.contains("Hello, Terminal!"));
        assert!(exit_status.is_some());
    }

    #[tokio::test]
    async fn test_terminal_output_truncation() {
        let manager = TerminalManager::new();

        // Create terminal with small max output (100 bytes)
        let terminal_id = manager
            .create_terminal(
                "echo".to_string(),
                vec!["A".repeat(200)],
                vec![],
                None,
                Some(100), // Max 100 bytes
            )
            .await
            .expect("Failed to create terminal");

        // Wait for output
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        let (output, _) = manager
            .get_output(&terminal_id.0)
            .expect("Failed to get output");

        // Output should be truncated to <= 100 bytes
        assert!(output.len() <= 100);
    }
}
