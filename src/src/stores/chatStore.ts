import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { agentService } from "../services/agentService";
import { useSpacesStore } from "./spacesStore";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  metadata?: {
    toolCalls?: any[];
    files?: string[];
  };
}

// Rough token estimation: ~4 characters per token (Claude's approximation)
const CHARS_PER_TOKEN = 4;
const CONTEXT_WARNING_THRESHOLD = 150000; // Warn at 150K tokens (~200K limit)
const CONTEXT_LIMIT = 200000; // Hard limit

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateConversationTokens(messages: Message[]): number {
  return messages.reduce((total, msg) => {
    return total + estimateTokens(msg.content);
  }, 0);
}

interface ChatState {
  messages: Message[];
  streaming: boolean;
  error: string | null;
  currentStreamingMessage: string;
  contextTokens: number; // Estimated tokens in current conversation

  // Actions
  sendMessage: (content: string, files?: string[]) => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: Message) => void;
  loadMessagesForSpace: (spaceId: string) => Promise<void>;
  saveCurrentConversation: (
    spaceId: string,
    spaceName: string,
  ) => Promise<void>;
  getContextInfo: () => {
    tokens: number;
    approachingLimit: boolean;
    atLimit: boolean;
    percentUsed: number;
  };
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  error: null,
  currentStreamingMessage: "",
  contextTokens: 0,

  sendMessage: async (content: string, files?: string[]) => {
    console.log("[CHAT STORE] sendMessage called with:", content);
    const currentSpace = useSpacesStore.getState().currentSpace;

    if (!currentSpace) {
      console.error("[CHAT STORE] No space selected");
      set({ error: "No space selected" });
      return;
    }

    console.log("[CHAT STORE] Current space:", currentSpace);

    // Read attached file contents if any
    let fileContext = "";
    if (files && files.length > 0) {
      console.log("[CHAT STORE] Reading", files.length, "attached files...");
      try {
        const fileContents = await Promise.all(
          files.map(async (filePath) => {
            try {
              const content = await invoke<string>("read_file_content", {
                path: filePath,
              });
              return { path: filePath, content };
            } catch (error) {
              console.error(`Failed to read ${filePath}:`, error);
              return {
                path: filePath,
                content: `[Error reading file: ${error}]`,
              };
            }
          }),
        );

        // Format file context like Zed does
        fileContext = fileContents
          .map(({ path, content }) => {
            return `<file path="${path}">\n${content}\n</file>`;
          })
          .join("\n\n");

        console.log(
          "[CHAT STORE] File context prepared, length:",
          fileContext.length,
        );
      } catch (error) {
        console.error("[CHAT STORE] Error reading file attachments:", error);
      }
    }

    // Add user message (display content only, not file context)
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: Date.now(),
      metadata: files ? { files } : undefined,
    };

    set({ streaming: true, error: null, currentStreamingMessage: "" });
    get().addMessage(userMessage);

    try {
      // Read CLAUDE.md for context
      console.log("[CHAT STORE] Reading CLAUDE.md...");
      const claudeMdContent = await invoke<string>("read_claude_md", {
        spaceId: currentSpace.id,
      });
      console.log(
        "[CHAT STORE] CLAUDE.md read, length:",
        claudeMdContent?.length || 0,
      );

      // Start streaming response
      const assistantMessageId = crypto.randomUUID();
      let fullResponse = "";

      // Build conversation history (exclude the current user message we just added)
      const conversationHistory = get()
        .messages.slice(0, -1)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      // Prepare the actual message to send to the model
      // Include file context before the user's message
      const messageWithContext = fileContext
        ? `${fileContext}\n\n${content}`
        : content;

      // Stream from agent (auth handled automatically by agentService)
      console.log("[CHAT STORE] Calling agentService.sendMessage...");
      console.log(
        "[CHAT STORE] Message with context length:",
        messageWithContext.length,
      );
      console.log(
        "[CHAT STORE] Message preview:",
        messageWithContext.substring(0, 200),
      );
      console.log(
        "[CHAT STORE] Conversation history:",
        conversationHistory.length,
        "messages",
      );
      for await (const chunk of agentService.sendMessage(messageWithContext, {
        spaceId: currentSpace.id,
        spacePath: currentSpace.path,
        claudeMdContent,
        conversationHistory,
      })) {
        console.log("[CHAT STORE] Received chunk:", chunk.substring(0, 50));
        // Add newline between chunks if the previous chunk didn't end with one
        // This ensures proper formatting when Claude sends multiple thinking parts
        if (
          fullResponse.length > 0 &&
          !fullResponse.endsWith("\n") &&
          !chunk.startsWith("\n")
        ) {
          fullResponse += "\n";
        }
        fullResponse += chunk;
        set({ currentStreamingMessage: fullResponse });
      }

      // Add complete assistant message
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: "assistant",
        content: fullResponse,
        timestamp: Date.now(),
      };

      get().addMessage(assistantMessage);
      set({ streaming: false, currentStreamingMessage: "" });

      // Save conversation to database
      await get().saveCurrentConversation(currentSpace.id, currentSpace.name);
    } catch (error) {
      console.error("Failed to send message:", error);
      set({
        error: error instanceof Error ? error.message : String(error),
        streaming: false,
        currentStreamingMessage: "",
      });
    }
  },

  clearMessages: () => {
    set({ messages: [], currentStreamingMessage: "" });
  },

  addMessage: (message: Message) => {
    set((state) => {
      const newMessages = [...state.messages, message];
      return {
        messages: newMessages,
        contextTokens: estimateConversationTokens(newMessages),
      };
    });
  },

  loadMessagesForSpace: async (spaceId: string) => {
    try {
      console.log("[CHAT STORE] Loading messages for space:", spaceId);
      const messages = await invoke<Message[]>("load_conversation", {
        spaceId,
      });
      console.log("[CHAT STORE] Loaded", messages.length, "messages");
      const contextTokens = estimateConversationTokens(messages);
      console.log("[CHAT STORE] Estimated tokens:", contextTokens);
      set({ messages, contextTokens, error: null });
    } catch (error) {
      console.error("[CHAT STORE] Failed to load messages:", error);
      set({
        error: error instanceof Error ? error.message : String(error),
        messages: [],
        contextTokens: 0,
      });
    }
  },

  saveCurrentConversation: async (spaceId: string, spaceName: string) => {
    try {
      const messages = get().messages;
      console.log(
        "[CHAT STORE] Saving",
        messages.length,
        "messages for space:",
        spaceId,
      );
      await invoke("save_conversation", { spaceId, spaceName, messages });
      console.log("[CHAT STORE] Conversation saved successfully");
    } catch (error) {
      console.error("[CHAT STORE] Failed to save conversation:", error);
      // Don't set error state for save failures - they're not critical to UX
    }
  },

  getContextInfo: () => {
    const tokens = get().contextTokens;
    return {
      tokens,
      approachingLimit: tokens >= CONTEXT_WARNING_THRESHOLD,
      atLimit: tokens >= CONTEXT_LIMIT,
      percentUsed: Math.round((tokens / CONTEXT_LIMIT) * 100),
    };
  },
}));
