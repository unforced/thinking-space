import { describe, it, expect, beforeEach, vi } from 'vitest'
import { agentService } from './agentService'
import type { PermissionRequest } from './agentService'

describe('AgentService', () => {
  beforeEach(() => {
    // Reset settings before each test
    agentService.resetTokenUsage()
  })

  describe('Token Usage Tracking', () => {
    it('should initialize with zero tokens', () => {
      const usage = agentService.getTokenUsage()

      expect(usage.inputChars).toBe(0)
      expect(usage.outputChars).toBe(0)
      expect(usage.estimatedInputTokens).toBe(0)
      expect(usage.estimatedOutputTokens).toBe(0)
    })

    it('should reset token usage', () => {
      // Manually set some usage (would normally happen during message sending)
      agentService.resetTokenUsage()
      const usage = agentService.getTokenUsage()

      expect(usage.inputChars).toBe(0)
      expect(usage.outputChars).toBe(0)
    })
  })

  describe('Safe Operation Detection', () => {
    it('should identify web search as safe', () => {
      const request: PermissionRequest = {
        request_id: 'test-1',
        session_id: 'session-1',
        tool_call_id: 'tool-1',
        title: 'Search the web',
        kind: 'websearch',
        raw_input: { query: 'test query' },
        options: [
          { option_id: 'allow', name: 'Allow', kind: 'allow' },
          { option_id: 'deny', name: 'Deny', kind: 'deny' },
        ],
      }

      // Access private method via type assertion for testing
      const isSafe = (agentService as any).isSafeOperation(request)
      expect(isSafe).toBe(true)
    })

    it('should identify file reads as safe', () => {
      const request: PermissionRequest = {
        request_id: 'test-2',
        session_id: 'session-1',
        tool_call_id: 'tool-2',
        title: 'Read file',
        kind: 'file_read',
        raw_input: { file_path: '/home/user/test.txt' },
        options: [
          { option_id: 'allow', name: 'Allow', kind: 'allow' },
        ],
      }

      const isSafe = (agentService as any).isSafeOperation(request)
      expect(isSafe).toBe(true)
    })

    it('should identify file writes as unsafe', () => {
      const request: PermissionRequest = {
        request_id: 'test-3',
        session_id: 'session-1',
        tool_call_id: 'tool-3',
        title: 'Write file',
        kind: 'file_write',
        raw_input: {
          file_path: '/home/user/test.txt',
          content: 'new content',
        },
        options: [
          { option_id: 'allow', name: 'Allow', kind: 'allow' },
        ],
      }

      const isSafe = (agentService as any).isSafeOperation(request)
      expect(isSafe).toBe(false)
    })

    it('should identify safe bash commands', () => {
      const safeCommands = ['ls', 'pwd', 'cat test.txt', 'git status', 'npm list']

      safeCommands.forEach((command) => {
        const request: PermissionRequest = {
          request_id: `test-${command}`,
          session_id: 'session-1',
          tool_call_id: `tool-${command}`,
          title: `Run command: ${command}`,
          kind: 'bash',
          raw_input: { command },
          options: [
            { option_id: 'allow', name: 'Allow', kind: 'allow' },
          ],
        }

        const isSafe = (agentService as any).isSafeOperation(request)
        expect(isSafe).toBe(true)
      })
    })

    it('should identify unsafe bash commands', () => {
      const unsafeCommands = ['rm -rf /', 'sudo rm -rf /', 'dd if=/dev/zero', 'chmod 777']

      unsafeCommands.forEach((command) => {
        const request: PermissionRequest = {
          request_id: `test-${command}`,
          session_id: 'session-1',
          tool_call_id: `tool-${command}`,
          title: `Run command: ${command}`,
          kind: 'bash',
          raw_input: { command },
          options: [
            { option_id: 'allow', name: 'Allow', kind: 'allow' },
          ],
        }

        const isSafe = (agentService as any).isSafeOperation(request)
        expect(isSafe).toBe(false)
      })
    })

    it('should identify glob/grep operations as safe', () => {
      const request: PermissionRequest = {
        request_id: 'test-grep',
        session_id: 'session-1',
        tool_call_id: 'tool-grep',
        title: 'Search files',
        kind: 'grep',
        raw_input: { pattern: '*.ts', search: 'function' },
        options: [
          { option_id: 'allow', name: 'Allow', kind: 'allow' },
        ],
      }

      const isSafe = (agentService as any).isSafeOperation(request)
      expect(isSafe).toBe(true)
    })

    it('should identify browser navigation as safe', () => {
      const request: PermissionRequest = {
        request_id: 'test-nav',
        session_id: 'session-1',
        tool_call_id: 'tool-nav',
        title: 'Navigate to URL',
        kind: 'browser',
        raw_input: { url: 'https://example.com' },
        options: [
          { option_id: 'allow', name: 'Allow', kind: 'allow' },
        ],
      }

      const isSafe = (agentService as any).isSafeOperation(request)
      expect(isSafe).toBe(true)
    })

    it('should identify browser form filling as unsafe', () => {
      const request: PermissionRequest = {
        request_id: 'test-form',
        session_id: 'session-1',
        tool_call_id: 'tool-form',
        title: 'Fill form',
        kind: 'browser',
        raw_input: { url: 'https://example.com', text: 'input value' },
        options: [
          { option_id: 'allow', name: 'Allow', kind: 'allow' },
        ],
      }

      const isSafe = (agentService as any).isSafeOperation(request)
      expect(isSafe).toBe(false)
    })
  })

  describe('Settings Management', () => {
    it('should load settings', async () => {
      // Mock the invoke function
      const { invoke } = require('@tauri-apps/api/core')
      invoke.mockResolvedValueOnce({
        always_allow_tool_actions: true,
      })

      await agentService.loadSettings()

      // Settings should be cached
      const shouldAutoApprove = (agentService as any).shouldAutoApproveAll()
      expect(shouldAutoApprove).toBe(true)
    })

    it('should handle settings load failure', async () => {
      const { invoke } = require('@tauri-apps/api/core')
      invoke.mockRejectedValueOnce(new Error('Failed to load'))

      await agentService.loadSettings()

      // Should default to false
      const shouldAutoApprove = (agentService as any).shouldAutoApproveAll()
      expect(shouldAutoApprove).toBe(false)
    })
  })
})
