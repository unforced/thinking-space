import type { Message } from '../../stores/chatStore'

export const mockUserMessage: Message = {
  id: 'msg-1',
  role: 'user',
  content: 'Hello, Claude!',
  timestamp: 1697500000000,
}

export const mockAssistantMessage: Message = {
  id: 'msg-2',
  role: 'assistant',
  content: 'Hello! How can I help you today?',
  timestamp: 1697500001000,
}

export const mockMessages: Message[] = [
  mockUserMessage,
  mockAssistantMessage,
  {
    id: 'msg-3',
    role: 'user',
    content: 'What files are in this directory?',
    timestamp: 1697500002000,
  },
  {
    id: 'msg-4',
    role: 'assistant',
    content: 'Let me check that for you.',
    timestamp: 1697500003000,
    metadata: {
      toolCalls: ['ls'],
    },
  },
]

export const mockMessageWithFiles: Message = {
  id: 'msg-5',
  role: 'user',
  content: 'Review this code',
  timestamp: 1697500004000,
  metadata: {
    files: ['/path/to/file.ts'],
  },
}
