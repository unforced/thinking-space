import { query } from '@anthropic-ai/claude-agent-sdk'

export interface AgentMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface SendMessageOptions {
  spaceId: string
  spacePath: string
  claudeMdContent: string
  apiKey: string
}

/**
 * Agent Service
 * Handles communication with Claude Agent SDK
 */
export class AgentService {
  /**
   * Send a message and get streaming response
   */
  async *sendMessage(
    message: string,
    options: SendMessageOptions
  ): AsyncGenerator<string, void, unknown> {
    const { claudeMdContent, apiKey, spacePath } = options

    try {
      // Set API key in environment
      if (apiKey) {
        process.env.ANTHROPIC_API_KEY = apiKey
      }

      // Create query with context from CLAUDE.md
      const session = query({
        prompt: message,
        options: {
          model: 'claude-sonnet-4-20250514',
          systemPrompt: claudeMdContent || undefined,
          workingDirectory: spacePath,
          allowedTools: ['Read', 'Write', 'Grep', 'Bash'],
          maxTurns: 10
        }
      })

      // Stream response
      for await (const event of session) {
        if (event.type === 'text') {
          yield event.text
        } else if (event.type === 'result') {
          // Final result
          if (typeof event.result === 'string') {
            yield event.result
          }
        } else if (event.type === 'error') {
          throw new Error(event.error.message || 'Agent error')
        }
      }
    } catch (error) {
      console.error('Agent service error:', error)
      throw error
    }
  }

  /**
   * Send a message and get complete response (non-streaming)
   */
  async sendMessageSync(
    message: string,
    options: SendMessageOptions
  ): Promise<string> {
    let fullResponse = ''

    for await (const chunk of this.sendMessage(message, options)) {
      fullResponse += chunk
    }

    return fullResponse
  }
}

// Singleton instance
export const agentService = new AgentService()
