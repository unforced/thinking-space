import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { authService } from "./authService";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface SendMessageOptions {
  spaceId: string;
  spacePath: string;
  claudeMdContent: string;
  conversationHistory?: ConversationMessage[];
}

interface SidecarMessage {
  jsonrpc: string;
  id?: number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Agent Service
 * Handles communication with Claude Agent SDK via Tauri sidecar
 */
export class AgentService {
  private requestId = 1;
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: void) => void;
      reject: (error: Error) => void;
      onStream?: (chunk: string) => void;
    }
  >();

  constructor() {
    this.setupSidecarListener();
  }

  private setupSidecarListener() {
    // Listen for messages from sidecar
    listen<SidecarMessage>("sidecar-message", (event) => {
      const message = event.payload;
      console.log("[FRONTEND] Received sidecar message:", message);

      // Handle notifications (streaming events)
      if (message.method === "streamEvent" && message.params) {
        const { sessionId, event: sdkEvent } = message.params;

        // Extract request ID from session ID (format: "session-{requestId}")
        const match = sessionId.match(/session-(\d+)/);
        if (match) {
          const requestId = parseInt(match[1]);
          const pending = this.pendingRequests.get(requestId);

          if (pending && pending.onStream) {
            const text = this.extractTextFromEvent(sdkEvent);
            if (text) {
              pending.onStream(text);
            }
          }
        }
      }
      // Handle responses
      else if (message.id !== undefined) {
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          if (message.error) {
            pending.reject(new Error(message.error.message));
          } else {
            pending.resolve();
          }
          this.pendingRequests.delete(message.id);
        }
      }
    }).catch(console.error);
  }

  private extractTextFromEvent(event: any): string | null {
    if (!event) return null;

    // Handle assistant messages
    if (event.type === "assistant" && event.message?.content) {
      let text = "";
      for (const block of event.message.content) {
        if (block.type === "text") {
          text += block.text;
        } else if (block.type === "tool_use") {
          // Add visual indicator for tool use with input details
          text += `\n\n🔧 Using tool: **${block.name}**\n`;

          // Show relevant input parameters
          if (block.input) {
            if (block.name === "WebSearch" && block.input.query) {
              text += `   Query: "${block.input.query}"\n`;
            } else if (block.name === "Read" && block.input.path) {
              text += `   Reading: ${block.input.path}\n`;
            } else if (block.name === "Write" && block.input.path) {
              text += `   Writing to: ${block.input.path}\n`;
            } else if (block.name === "Bash" && block.input.command) {
              text += `   Command: \`${block.input.command}\`\n`;
            } else if (block.name === "Grep" && block.input.pattern) {
              text += `   Pattern: "${block.input.pattern}"${block.input.path ? ` in ${block.input.path}` : ""}\n`;
            } else {
              // For other tools, show the full input (formatted)
              const inputStr = JSON.stringify(block.input, null, 2);
              if (inputStr.length < 200) {
                text += `   Input: ${inputStr}\n`;
              }
            }
          }
        }
      }
      return text;
    }

    // Handle system messages (like tool results)
    if (event.type === "system" && event.subtype === "tool_result") {
      return `\n✓ Tool ${event.tool_result?.tool_name} completed\n\n`;
    }

    // Handle streaming events
    if (event.type === "stream_event" && event.event) {
      if (
        event.event.type === "content_block_delta" &&
        event.event.delta?.type === "text_delta"
      ) {
        return event.event.delta.text;
      }
    }

    return null;
  }

  /**
   * Send a message and get streaming response
   */
  async *sendMessage(
    message: string,
    options: SendMessageOptions,
  ): AsyncGenerator<string, void, unknown> {
    const { claudeMdContent, spacePath, conversationHistory } = options;

    try {
      // Get authentication credentials (OAuth or API key)
      const credentials = await authService.getCredentials();

      if (!credentials) {
        throw new Error(
          "No authentication found. Please either:\n" +
            "1. Authenticate with Claude Code using the /login command, or\n" +
            "2. Add an API key in Settings",
        );
      }

      console.log(`Using ${credentials.type} authentication`);

      const requestId = this.requestId++;
      let streamBuffer: string[] = [];
      let streamComplete = false;
      let streamError: Error | null = null;

      // Set up promise to track completion
      const completionPromise = new Promise<void>((resolve, reject) => {
        this.pendingRequests.set(requestId, {
          resolve: () => {
            streamComplete = true;
            resolve();
          },
          reject: (error) => {
            streamError = error;
            streamComplete = true;
            reject(error);
          },
          onStream: (chunk: string) => {
            streamBuffer.push(chunk);
          },
        });
      });

      // Send message to sidecar
      console.log("[FRONTEND] Sending message with requestId:", requestId);
      console.log(
        "[FRONTEND] Including",
        conversationHistory?.length || 0,
        "previous messages",
      );
      await invoke("agent_send_message", {
        params: {
          request_id: requestId,
          message,
          api_key: credentials.token,
          working_directory: spacePath,
          system_prompt: claudeMdContent || null,
          model: "claude-sonnet-4-20250514",
          allowed_tools: ["Read", "Write", "Grep", "Bash", "WebSearch"],
          max_turns: 10,
          conversation_history: conversationHistory || null,
        },
      });
      console.log("[FRONTEND] Message sent, waiting for stream...");

      // Yield chunks as they arrive
      while (!streamComplete) {
        if (streamBuffer.length > 0) {
          const chunk = streamBuffer.shift()!;
          yield chunk;
        } else {
          // Wait a bit before checking again
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      // Yield any remaining buffered chunks
      while (streamBuffer.length > 0) {
        yield streamBuffer.shift()!;
      }

      // Check for errors
      if (streamError) {
        throw streamError;
      }

      // Wait for completion
      await completionPromise;
    } catch (error) {
      console.error("Agent service error:", error);
      throw error;
    }
  }

  /**
   * Send a message and get complete response (non-streaming)
   */
  async sendMessageSync(
    message: string,
    options: SendMessageOptions,
  ): Promise<string> {
    let fullResponse = "";

    for await (const chunk of this.sendMessage(message, options)) {
      fullResponse += chunk;
    }

    return fullResponse;
  }
}

// Singleton instance
export const agentService = new AgentService();
