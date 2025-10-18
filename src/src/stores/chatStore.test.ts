import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from './chatStore'
import { mockMessages, mockUserMessage } from '../tests/fixtures/messages'

describe('ChatStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useChatStore.getState()
    store.clearMessages()

    // Clear all mocks
    vi.clearAllMocks()
  })

  describe('Message Management', () => {
    it('should initialize with empty messages', () => {
      const { messages } = useChatStore.getState()
      expect(messages).toEqual([])
    })

    it('should add a message', () => {
      const { addMessage, messages } = useChatStore.getState()

      addMessage(mockUserMessage)

      expect(messages).toHaveLength(1)
      expect(messages[0]).toEqual(mockUserMessage)
    })

    it('should clear all messages', () => {
      const { addMessage, clearMessages, messages: initialMessages } = useChatStore.getState()

      // Add some messages
      mockMessages.forEach(msg => addMessage(msg))
      expect(useChatStore.getState().messages).toHaveLength(mockMessages.length)

      // Clear them
      clearMessages()
      expect(useChatStore.getState().messages).toHaveLength(0)
    })
  })

  describe('Streaming State', () => {
    it('should track streaming state', () => {
      const store = useChatStore.getState()
      expect(store.streaming).toBe(false)
      expect(store.currentStreamingMessage).toBe('')
    })

    it('should handle streaming errors', () => {
      const store = useChatStore.getState()
      expect(store.error).toBeNull()
    })
  })

  describe('Save Conversation', () => {
    it('should call Tauri save_conversation command', async () => {
      const { invoke } = require('@tauri-apps/api/core')
      invoke.mockResolvedValueOnce(undefined)

      const { addMessage, saveCurrentConversation } = useChatStore.getState()

      // Add messages
      mockMessages.forEach(msg => addMessage(msg))

      // Save conversation
      await saveCurrentConversation('test-space-123', 'Test Space')

      expect(invoke).toHaveBeenCalledWith('save_conversation', {
        spaceId: 'test-space-123',
        spaceName: 'Test Space',
        messages: expect.arrayContaining([
          expect.objectContaining({ role: 'user' }),
          expect.objectContaining({ role: 'assistant' }),
        ]),
      })
    })

    it('should handle save errors gracefully', async () => {
      const { invoke } = require('@tauri-apps/api/core')
      invoke.mockRejectedValueOnce(new Error('Database error'))

      const { saveCurrentConversation } = useChatStore.getState()

      // Should not throw
      await expect(
        saveCurrentConversation('test-space-123', 'Test Space')
      ).resolves.not.toThrow()
    })
  })

  describe('Load Messages', () => {
    it('should load messages for a space', async () => {
      const { invoke } = require('@tauri-apps/api/core')
      invoke.mockResolvedValueOnce(mockMessages)

      const { loadMessagesForSpace, messages } = useChatStore.getState()

      await loadMessagesForSpace('test-space-123')

      const updatedMessages = useChatStore.getState().messages
      expect(updatedMessages).toEqual(mockMessages)
      expect(invoke).toHaveBeenCalledWith('load_conversation', {
        spaceId: 'test-space-123',
      })
    })

    it('should handle empty conversation', async () => {
      const { invoke } = require('@tauri-apps/api/core')
      invoke.mockResolvedValueOnce([])

      const { loadMessagesForSpace } = useChatStore.getState()

      await loadMessagesForSpace('test-space-123')

      const messages = useChatStore.getState().messages
      expect(messages).toEqual([])
    })

    it('should handle load errors', async () => {
      const { invoke } = require('@tauri-apps/api/core')
      invoke.mockRejectedValueOnce(new Error('Failed to load'))

      const { loadMessagesForSpace } = useChatStore.getState()

      await loadMessagesForSpace('test-space-123')

      // Should still have empty messages
      const messages = useChatStore.getState().messages
      expect(messages).toEqual([])
    })
  })
})
