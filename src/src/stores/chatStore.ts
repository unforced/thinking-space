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

interface ChatState {
  messages: Message[];
  streaming: boolean;
  error: string | null;
  currentStreamingMessage: string;

  // Actions
  sendMessage: (content: string, files?: string[]) => Promise<void>;
  clearMessages: () => void;
  addMessage: (message: Message) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  error: null,
  currentStreamingMessage: "",

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
    set((state) => ({
      messages: [...state.messages, message],
    }));
  },
}));
