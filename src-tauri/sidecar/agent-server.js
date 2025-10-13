#!/usr/bin/env node

/**
 * Thinking Space Agent Sidecar
 *
 * Node.js process that runs the Claude Agent SDK and communicates
 * with the Rust backend via stdin/stdout using JSON-RPC protocol.
 *
 * This is necessary because the Agent SDK requires Node.js APIs
 * that aren't available in the browser environment.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { createInterface } from "readline";

// JSON-RPC protocol
// Request:  { jsonrpc: "2.0", id: number, method: string, params: object }
// Response: { jsonrpc: "2.0", id: number, result: any } | { jsonrpc: "2.0", id: number, error: object }
// Event:    { jsonrpc: "2.0", method: string, params: object } (no id = notification)

class AgentSidecar {
  constructor() {
    this.sessions = new Map(); // sessionId -> AsyncGenerator
    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });

    // Disable stdout buffering if possible
    if (process.stdout.setEncoding) {
      process.stdout.setEncoding("utf8");
    }

    this.setupHandlers();
  }

  setupHandlers() {
    this.rl.on("line", (line) => {
      try {
        const request = JSON.parse(line);
        this.handleRequest(request).catch((error) => {
          this.sendError(request.id, -32603, error.message);
        });
      } catch (error) {
        this.sendError(null, -32700, "Parse error");
      }
    });

    process.on("SIGTERM", () => {
      this.cleanup();
      process.exit(0);
    });

    process.on("SIGINT", () => {
      this.cleanup();
      process.exit(0);
    });

    // Send ready notification
    this.sendNotification("ready", { pid: process.pid });
  }

  async handleRequest(request) {
    const { id, method, params } = request;

    try {
      switch (method) {
        case "ping":
          this.sendResult(id, { pong: true });
          break;

        case "startSession":
          await this.startSession(id, params);
          break;

        case "sendMessage":
          await this.sendMessage(id, params);
          break;

        case "stopSession":
          await this.stopSession(id, params);
          break;

        default:
          this.sendError(id, -32601, `Method not found: ${method}`);
      }
    } catch (error) {
      this.sendError(id, -32603, error.message);
    }
  }

  async startSession(id, params) {
    const {
      sessionId,
      apiKey,
      workingDirectory,
      systemPrompt,
      model,
      allowedTools,
      maxTurns,
    } = params;

    if (this.sessions.has(sessionId)) {
      this.sendError(id, -32000, `Session ${sessionId} already exists`);
      return;
    }

    try {
      // Set API key in environment
      if (apiKey) {
        process.env.ANTHROPIC_API_KEY = apiKey;
      }

      // Create query session
      const session = query({
        prompt: "", // Will be set in sendMessage
        options: {
          model: model || "claude-sonnet-4-20250514",
          systemPrompt: systemPrompt || undefined,
          cwd: workingDirectory,
          allowedTools: allowedTools || ["Read", "Write", "Grep", "Bash"],
          maxTurns: maxTurns || 10,
        },
      });

      this.sessions.set(sessionId, session);
      this.sendResult(id, { success: true, sessionId });
    } catch (error) {
      this.sendError(id, -32000, `Failed to start session: ${error.message}`);
    }
  }

  async sendMessage(id, params) {
    const { sessionId, message } = params;

    const session = this.sessions.get(sessionId);
    if (!session) {
      this.sendError(id, -32000, `Session ${sessionId} not found`);
      return;
    }

    try {
      // For simplicity, create a new query for each message
      // In a production system, you might want to maintain conversation history
      const {
        apiKey,
        workingDirectory,
        systemPrompt,
        model,
        allowedTools,
        maxTurns,
      } = params;

      if (apiKey) {
        process.env.ANTHROPIC_API_KEY = apiKey;
      }

      const querySession = query({
        prompt: message,
        options: {
          model: model || "claude-sonnet-4-20250514",
          systemPrompt: systemPrompt || undefined,
          cwd: workingDirectory,
          allowedTools: allowedTools || ["Read", "Write", "Grep", "Bash"],
          maxTurns: maxTurns || 10,
        },
      });

      // Stream events back to parent process
      for await (const event of querySession) {
        // Send streaming events as notifications
        this.sendNotification("streamEvent", {
          sessionId,
          event: this.serializeEvent(event),
        });
      }

      // Send final success result
      this.sendResult(id, { success: true });
    } catch (error) {
      this.sendError(id, -32000, `Message error: ${error.message}`);
    }
  }

  serializeEvent(event) {
    // Serialize SDK event for transmission
    // Some events may have non-serializable data, so we extract key info
    const serialized = {
      type: event.type,
      timestamp: Date.now(),
    };

    if (event.type === "assistant") {
      serialized.message = {
        content: event.message.content.map((block) => {
          if (block.type === "text") {
            return { type: "text", text: block.text };
          } else if (block.type === "tool_use") {
            return {
              type: "tool_use",
              name: block.name,
              input: block.input,
            };
          }
          return block;
        }),
      };
    } else if (event.type === "stream_event") {
      serialized.event = {
        type: event.event.type,
        delta: event.event.delta,
      };
    } else if (event.type === "result") {
      serialized.result = {
        num_turns: event.num_turns,
        duration_ms: event.duration_ms,
        total_cost_usd: event.total_cost_usd,
        is_error: event.is_error,
      };
    }

    return serialized;
  }

  async stopSession(id, params) {
    const { sessionId } = params;

    if (this.sessions.has(sessionId)) {
      this.sessions.delete(sessionId);
      this.sendResult(id, { success: true });
    } else {
      this.sendError(id, -32000, `Session ${sessionId} not found`);
    }
  }

  sendResult(id, result) {
    this.send({ jsonrpc: "2.0", id, result });
  }

  sendError(id, code, message) {
    this.send({ jsonrpc: "2.0", id, error: { code, message } });
  }

  sendNotification(method, params) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  send(message) {
    console.log(JSON.stringify(message));
  }

  cleanup() {
    this.sessions.clear();
  }
}

// Start the sidecar
const sidecar = new AgentSidecar();
