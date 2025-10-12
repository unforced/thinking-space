import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  metadata?: {
    toolCalls?: any[]
    files?: string[]
  }
}

interface ChatState {
  messages: Message[]
  streaming: boolean
  error: string | null

  // Actions
  sendMessage: (content: string, files?: string[]) => Promise<void>
  clearMessages: () => void
  addMessage: (message: Message) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  streaming: false,
  error: null,

  sendMessage: async (content: string, files?: string[]) => {
    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: Date.now(),
      metadata: files ? { files } : undefined
    }

    set({ streaming: true, error: null })
    get().addMessage(userMessage)

    try {
      // TODO: Call Tauri command to send to Agent SDK
      // For now, just add a placeholder response
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'This is a placeholder response. Agent SDK integration coming soon!',
        timestamp: Date.now()
      }

      // Simulate streaming delay
      await new Promise(resolve => setTimeout(resolve, 500))
      get().addMessage(assistantMessage)
      set({ streaming: false })
    } catch (error) {
      set({ error: String(error), streaming: false })
    }
  },

  clearMessages: () => {
    set({ messages: [] })
  },

  addMessage: (message: Message) => {
    set(state => ({
      messages: [...state.messages, message]
    }))
  }
}))
