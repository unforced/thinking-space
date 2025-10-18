import type { Space } from '../../stores/spacesStore'

export const mockSpace: Space = {
  id: 'test-space-123',
  name: 'Test Space',
  path: '/tmp/thinking-space-tests/spaces/test-space-123',
  claude_md_path: '/tmp/thinking-space-tests/spaces/test-space-123/CLAUDE.md',
  created_at: 1697500000000,
  last_accessed_at: 1697500000000,
  template: 'quick-start',
}

export const mockSpaces: Space[] = [
  mockSpace,
  {
    id: 'test-space-456',
    name: 'Another Space',
    path: '/tmp/thinking-space-tests/spaces/test-space-456',
    claude_md_path: '/tmp/thinking-space-tests/spaces/test-space-456/CLAUDE.md',
    created_at: 1697400000000,
    last_accessed_at: 1697400000000,
    template: 'custom',
  },
]
