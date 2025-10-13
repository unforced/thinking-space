import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { agentService } from "../services/agentService";
import { useSpacesStore } from "./spacesStore";
import { useSettingsStore } from "./settingsStore";

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
    const currentSpace = useSpacesStore.getState().currentSpace;
    const apiKey = useSettingsStore.getState().apiKey;

    if (!currentSpace) {
      set({ error: "No space selected" });
      return;
    }

    if (!apiKey) {
      set({ error: "No API key configured. Please add one in Settings." });
      return;
    }

    // Add user message
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
      const claudeMdContent = await invoke<string>("read_claude_md", {
        spaceId: currentSpace.id,
      });

      // Start streaming response
      const assistantMessageId = crypto.randomUUID();
      let fullResponse = "";

      // Stream from agent
      for await (const chunk of agentService.sendMessage(content, {
        spaceId: currentSpace.id,
        spacePath: currentSpace.path,
        claudeMdContent,
        apiKey,
      })) {
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
