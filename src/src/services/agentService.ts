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

export interface PermissionRequest {
  request_id: string;
  currentRequestId?: number;
  session_id: string;
  tool_call_id: string;
  title: string;
  kind: string;
  raw_input: any;
  options: Array<{
    option_id: string;
    name: string;
    kind: string;
  }>;
}

export interface ToolCall {
  sessionId: string;
  requestId?: number;
  toolCallId: string;
  title: string;
  status: string;
  kind: string;
  rawInput: any;
  locations: Array<{ path: string; line?: number }>;
  content?: string;
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
  private isAgentReady = false;
  private readyPromise: Promise<void>;
  private readyResolve?: () => void;

  // Permission and tool call tracking
  private pendingPermissions = new Map<string, PermissionRequest>();
  private activeToolCalls = new Map<string, ToolCall>();

  // Callbacks for UI
  public onPermissionRequest?: (request: PermissionRequest) => void;
  public onToolCall?: (toolCall: ToolCall) => void;
  public onToolCallUpdate?: (toolCall: ToolCall) => void;

  // Settings cache
  private settingsCache: { always_allow_tool_actions: boolean } | null = null;

  // Token usage tracking (approximate)
  private sessionTokens = {
    inputChars: 0,
    outputChars: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
  };

  /**
   * Estimate token count from text (rough approximation: 1 token ≈ 4 characters)
   * This is a simplified estimate - actual tokenization is more complex
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get current session token usage
   */
  public getTokenUsage() {
    return { ...this.sessionTokens };
  }

  /**
   * Reset token usage tracking (e.g., when starting a new session)
   */
  public resetTokenUsage() {
    this.sessionTokens = {
      inputChars: 0,
      outputChars: 0,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
    };
  }

  /**
   * Check if a permission request is for a safe, read-only operation
   * that should be automatically approved
   */
  private isSafeOperation(request: PermissionRequest): boolean {
    const title = request.title.toLowerCase();
    const kind = request.kind.toLowerCase();
    const rawInput = request.raw_input;

    // Web search operations - always safe
    if (
      kind.includes("websearch") ||
      title.includes("search") ||
      kind.includes("web_search")
    ) {
      console.log("[FRONTEND V2] Auto-approving web search:", title || kind);
      return true;
    }

    // Check if raw_input suggests web search (has query field)
    if (
      rawInput &&
      typeof rawInput === "object" &&
      "query" in rawInput &&
      kind.includes("mcp")
    ) {
      console.log(
        "[FRONTEND V2] Auto-approving MCP web search with query:",
        rawInput.query,
      );
      return true;
    }

    // Check raw_input for specific tool types
    if (rawInput && typeof rawInput === "object") {
      // Read operations
      if ("file_path" in rawInput || "path" in rawInput) {
        // Only approve if it's clearly a read operation (not write/edit)
        if (
          !("content" in rawInput) &&
          !("new_string" in rawInput) &&
          !("old_string" in rawInput)
        ) {
          console.log("[FRONTEND V2] Auto-approving file read:", title);
          return true;
        }
      }

      // Bash commands - only safe read-only commands
      if ("command" in rawInput) {
        const command = String(rawInput.command).toLowerCase().trim();

        // Expanded list of safe read-only commands
        const safeCommands = [
          "ls",
          "pwd",
          "cat",
          "head",
          "tail",
          "grep",
          "find",
          "tree",
          "wc",
          "diff",
          "stat",
          "file",
          "du",
          "df",
          "echo",
          "date",
          "whoami",
          "which",
          "whereis",
          "env",
          "printenv",
          "hostname",
          "uname",
          "arch",
          "uptime",
          "w",
          "who",
          "id",
          "groups",
          "git status",
          "git log",
          "git diff",
          "git show",
          "git branch",
          "git remote",
          "npm list",
          "npm ls",
          "npm outdated",
          "npm view",
          "cargo tree",
          "cargo search",
          "python --version",
          "node --version",
          "rustc --version",
          "java -version",
          "mvn --version",
        ];

        // Check if command starts with any safe command
        const commandStart = command.split(/[\s|&;]/)[0];

        // Also check for safe multi-word commands like "git status"
        const isSafeCommand = safeCommands.some(
          (safe) =>
            command.startsWith(safe) || commandStart === safe.split(" ")[0],
        );

        if (isSafeCommand) {
          console.log(
            "[FRONTEND V2] Auto-approving safe bash command:",
            command,
          );
          return true;
        }
      }

      // Glob/pattern matching operations
      if ("pattern" in rawInput || "glob" in rawInput) {
        console.log("[FRONTEND V2] Auto-approving glob/pattern search:", title);
        return true;
      }

      // Grep/search operations
      if ("search" in rawInput || "query" in rawInput) {
        console.log("[FRONTEND V2] Auto-approving search operation:", title);
        return true;
      }

      // Screenshot/snapshot operations (read-only visual inspection)
      if ("screenshot" in rawInput || "snapshot" in rawInput) {
        console.log("[FRONTEND V2] Auto-approving screenshot/snapshot:", title);
        return true;
      }

      // Browser navigation (read-only)
      if (
        "url" in rawInput &&
        !("text" in rawInput) &&
        !("value" in rawInput)
      ) {
        console.log(
          "[FRONTEND V2] Auto-approving browser navigation:",
          rawInput.url,
        );
        return true;
      }

      // File/directory listing operations
      if (
        "limit" in rawInput &&
        "offset" in rawInput &&
        "file_path" in rawInput
      ) {
        console.log("[FRONTEND V2] Auto-approving paginated file read:", title);
        return true;
      }
    }

    // If tool title suggests it's read-only
    const readOnlyKeywords = [
      "read",
      "search",
      "find",
      "list",
      "show",
      "view",
      "get",
      "fetch",
      "load",
      "grep",
      "glob",
      "navigate",
      "snapshot",
      "screenshot",
      "console",
      "network",
      "inspect",
      "check",
      "verify",
      "validate",
      "analyze",
      "parse",
      "extract",
      "browse",
      "open",
    ];
    if (readOnlyKeywords.some((keyword) => title.includes(keyword))) {
      console.log("[FRONTEND V2] Auto-approving based on title:", title);
      return true;
    }

    // Check kind for read-only patterns
    if (
      kind.includes("read") ||
      kind.includes("get") ||
      kind.includes("fetch")
    ) {
      console.log("[FRONTEND V2] Auto-approving based on kind:", kind);
      return true;
    }

    return false;
  }

  constructor() {
    // Create promise that resolves when agent is ready
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.setupSidecarListener();
    this.loadSettings();
  }

  /**
   * Load settings from backend
   */
  public async loadSettings() {
    try {
      const settings = await invoke<{ always_allow_tool_actions: boolean }>(
        "load_settings",
      );
      this.settingsCache = settings;
      console.log("[FRONTEND V2] Settings loaded:", settings);
    } catch (error) {
      console.error("[FRONTEND V2] Failed to load settings:", error);
      this.settingsCache = { always_allow_tool_actions: false };
    }
  }

  /**
   * Check if global auto-approval is enabled
   */
  private shouldAutoApproveAll(): boolean {
    return this.settingsCache?.always_allow_tool_actions ?? false;
  }

  private setupSidecarListener() {
    // Listen for agent ready event
    listen("agent-ready", () => {
      console.log("[FRONTEND V2] Agent is ready!");
      this.isAgentReady = true;
      if (this.readyResolve) {
        this.readyResolve();
      }
    }).catch(console.error);

    // Listen for streaming message chunks (ACP V2)
    listen<{ sessionId: string; requestId?: number; text: string }>(
      "agent-message-chunk",
      (event) => {
        const { requestId, text } = event.payload;
        console.log(
          "[FRONTEND V2] Received message chunk (requestId: {}):",
          requestId,
          text.substring(0, 50),
        );

        // Track output tokens
        this.sessionTokens.outputChars += text.length;
        this.sessionTokens.estimatedOutputTokens = this.estimateTokens(
          String(this.sessionTokens.outputChars),
        );

        if (requestId !== undefined) {
          const pending = this.pendingRequests.get(requestId);

          if (pending && pending.onStream) {
            pending.onStream(text);
          }
        } else {
          console.warn("[FRONTEND V2] Received chunk without requestId");
        }
      },
    ).catch(console.error);

    // Listen for tool calls (ACP V2)
    listen<ToolCall>("tool-call", (event) => {
      const toolCall = event.payload;
      console.log("[FRONTEND V2] Tool call:", toolCall.title);

      this.activeToolCalls.set(toolCall.toolCallId, toolCall);

      if (this.onToolCall) {
        this.onToolCall(toolCall);
      }
    }).catch(console.error);

    // Listen for tool call updates (ACP V2)
    listen<{
      requestId?: number;
      toolCallId: string;
      status?: string;
      content?: string;
    }>("tool-call-update", (event) => {
      const { toolCallId, status, content } = event.payload;
      console.log("[FRONTEND V2] Tool call update:", toolCallId, status);

      const toolCall = this.activeToolCalls.get(toolCallId);
      if (toolCall) {
        if (status) toolCall.status = status;
        if (content) toolCall.content = content;

        if (this.onToolCallUpdate) {
          this.onToolCallUpdate(toolCall);
        }
      }
    }).catch(console.error);

    // Listen for permission requests (ACP V2)
    listen<PermissionRequest>("permission-request", async (event) => {
      const request = event.payload;
      console.log("[FRONTEND V2] Permission request:", request.title);
      console.log("[FRONTEND V2] Permission request details:", {
        request_id: request.request_id,
        kind: request.kind,
        raw_input: request.raw_input,
      });

      this.pendingPermissions.set(request.request_id, request);

      try {
        // Check if we should auto-approve based on:
        // 1. Global setting (always_allow_tool_actions)
        // 2. Safe operation detection (web search, file reads, etc.)
        const globalAutoApprove = this.shouldAutoApproveAll();
        const isSafe = this.isSafeOperation(request);

        if (globalAutoApprove || isSafe) {
          const reason = globalAutoApprove
            ? "global setting enabled"
            : "detected as safe operation";
          console.log(`[FRONTEND V2] Auto-approving: ${reason}`);

          // Find "allow_once" option (prefer over "allow_always" following Zed's pattern)
          // This ensures toggling the setting off immediately affects future requests
          const allowOnceOption = request.options.find(
            (opt) =>
              opt.option_id === "allow_once" || opt.option_id === "allow",
          );

          const allowOption =
            allowOnceOption ||
            request.options.find(
              (opt) =>
                opt.option_id === "allow_always" ||
                opt.name.toLowerCase().includes("allow"),
            );

          if (allowOption) {
            console.log(
              "[FRONTEND V2] Found allow option:",
              allowOption.option_id,
            );
            // Automatically approve
            await this.respondToPermission(
              request.request_id,
              allowOption.option_id,
              false,
            );
            console.log("[FRONTEND V2] Auto-approval sent successfully");
            return;
          } else {
            console.warn(
              "[FRONTEND V2] Should auto-approve but no allow option found!",
              request.options,
            );
          }
        } else {
          console.log("[FRONTEND V2] Not auto-approved, showing to user");
        }

        // For non-safe operations, show to user
        if (this.onPermissionRequest) {
          this.onPermissionRequest(request);
        }
      } catch (error) {
        console.error(
          "[FRONTEND V2] Error handling permission request:",
          error,
        );
        // On error, still show to user rather than hanging
        if (this.onPermissionRequest) {
          this.onPermissionRequest(request);
        }
      }
    }).catch((error) => {
      console.error("[FRONTEND V2] Permission request listener error:", error);
    });

    // Listen for message completion (ACP V2)
    listen<{ requestId: number; stopReason: string }>(
      "agent-message-complete",
      (event) => {
        const { requestId } = event.payload;
        console.log("[FRONTEND V2] Message complete:", requestId);

        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          pending.resolve();
          this.pendingRequests.delete(requestId);
        }
      },
    ).catch(console.error);

    // Listen for message errors (ACP V2)
    listen<{ requestId: number; error: string }>(
      "agent-message-error",
      (event) => {
        const { requestId, error } = event.payload;
        console.log("[FRONTEND V2] Message error:", error);

        const pending = this.pendingRequests.get(requestId);
        if (pending) {
          pending.reject(new Error(error));
          this.pendingRequests.delete(requestId);
        }
      },
    ).catch(console.error);
  }

  /**
   * Send a message and get streaming response
   */
  async *sendMessage(
    message: string,
    options: SendMessageOptions,
  ): AsyncGenerator<string, void, unknown> {
    const { claudeMdContent, spacePath, conversationHistory } = options;

    console.log("[FRONTEND V2] sendMessage called");

    // Track input tokens (message + context + history)
    const inputText =
      message +
      (claudeMdContent || "") +
      (conversationHistory?.map((m) => m.content).join("") || "");
    this.sessionTokens.inputChars += inputText.length;
    this.sessionTokens.estimatedInputTokens = this.estimateTokens(
      String(this.sessionTokens.inputChars),
    );

    try {
      // Get authentication credentials (OAuth or API key)
      console.log("[FRONTEND V2] Getting credentials...");
      const credentials = await authService.getCredentials();

      if (!credentials) {
        throw new Error(
          "No authentication found. Please either:\n" +
            "1. Authenticate with Claude Code using the /login command, or\n" +
            "2. Add an API key in Settings",
        );
      }

      console.log(`[FRONTEND V2] Using ${credentials.type} authentication`);

      const requestId = this.requestId++;
      console.log("[FRONTEND V2] Assigned requestId:", requestId);

      let streamBuffer: string[] = [];
      let streamComplete = false;
      let streamError: Error | null = null;

      // Set up completion tracking
      console.log(
        "[FRONTEND V2] Setting up completion tracking for requestId:",
        requestId,
      );
      this.pendingRequests.set(requestId, {
        resolve: () => {
          console.log("[FRONTEND V2] Request", requestId, "marked complete");
          streamComplete = true;
        },
        reject: (error) => {
          console.log(
            "[FRONTEND V2] Request",
            requestId,
            "marked as error:",
            error,
          );
          streamError = error;
          streamComplete = true;
        },
        onStream: (chunk: string) => {
          console.log(
            "[FRONTEND V2] Buffering chunk for requestId",
            requestId,
            ":",
            chunk.substring(0, 30),
          );
          streamBuffer.push(chunk);
        },
      });

      console.log(
        "[FRONTEND V2] Pending requests map size:",
        this.pendingRequests.size,
      );

      // Start the ACP adapter if not already started
      if (!this.isAgentReady) {
        console.log("[FRONTEND V2] Agent not ready, starting ACP adapter...");
        try {
          // Only pass API key if using API key auth, not OAuth
          // For OAuth, adapter will use Claude Code's stored credentials
          const apiKey =
            credentials.type === "api-key" ? credentials.token : null;
          console.log(`[FRONTEND V2] Auth type: ${credentials.type}`);

          await invoke("agent_v2_start", { apiKey });
          console.log("[FRONTEND V2] Waiting for agent to be ready...");
          await this.readyPromise;
          console.log("[FRONTEND V2] Agent is ready!");
        } catch (e) {
          console.error("[FRONTEND V2] Failed to start adapter:", e);
          this.pendingRequests.delete(requestId);
          throw new Error(`Failed to start agent: ${e}`);
        }
      } else {
        console.log("[FRONTEND V2] Agent already ready, skipping start");
      }

      // Send message to sidecar
      console.log("[FRONTEND V2] Sending message with requestId:", requestId);
      console.log(
        "[FRONTEND V2] Including",
        conversationHistory?.length || 0,
        "previous messages",
      );

      try {
        await invoke("agent_v2_send_message", {
          params: {
            request_id: requestId,
            message,
            working_directory: spacePath,
            system_prompt: claudeMdContent || null,
            conversation_history: conversationHistory || null,
          },
        });
        console.log(
          "[FRONTEND V2] Message sent successfully, waiting for stream...",
        );
      } catch (e) {
        console.error("[FRONTEND V2] Failed to send message:", e);
        this.pendingRequests.delete(requestId);
        throw e;
      }

      // Yield chunks as they arrive
      console.log(
        "[FRONTEND V2] Starting stream loop for requestId:",
        requestId,
      );
      let chunkCount = 0;
      while (!streamComplete) {
        if (streamBuffer.length > 0) {
          const chunk = streamBuffer.shift()!;
          chunkCount++;
          console.log(
            "[FRONTEND V2] Yielding chunk",
            chunkCount,
            "for requestId",
            requestId,
          );
          yield chunk;
        } else {
          // Wait a bit before checking again
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }

      console.log(
        "[FRONTEND V2] Stream complete for requestId:",
        requestId,
        "total chunks:",
        chunkCount,
      );

      // Yield any remaining buffered chunks
      while (streamBuffer.length > 0) {
        const chunk = streamBuffer.shift()!;
        chunkCount++;
        console.log("[FRONTEND V2] Yielding remaining chunk", chunkCount);
        yield chunk;
      }

      // Check for errors
      if (streamError) {
        console.error("[FRONTEND V2] Stream had error:", streamError);
        throw streamError;
      }

      // Note: completionPromise is already resolved when streamComplete becomes true
      // The while loop above only exits when streamComplete is set by resolve() or reject()
      // So we don't need to await it again, but we do for safety
      console.log(
        "[FRONTEND V2] sendMessage fully completed for requestId:",
        requestId,
      );
    } catch (error) {
      console.error("[FRONTEND V2] Agent service error:", error);
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

  /**
   * Respond to a permission request
   */
  async respondToPermission(
    request_id: string,
    option_id: string | null,
    cancelled: boolean,
  ): Promise<void> {
    console.log(
      "[FRONTEND V2] Responding to permission:",
      request_id,
      option_id,
      cancelled,
    );

    try {
      await invoke("agent_v2_send_permission_response", {
        response: {
          request_id,
          option_id,
          cancelled,
        },
      });

      this.pendingPermissions.delete(request_id);
    } catch (e) {
      console.error("[FRONTEND V2] Failed to send permission response:", e);
      throw e;
    }
  }
}

// Singleton instance
export const agentService = new AgentService();
