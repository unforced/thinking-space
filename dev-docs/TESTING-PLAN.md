# Thinking Space Testing Plan

**Created:** October 17, 2024
**Status:** Implementation In Progress
**Goal:** Achieve 70%+ test coverage with comprehensive integration testing

---

## Current State

### Testing Coverage: 0% ❌

**What We Have:**
- ❌ No test files
- ❌ No testing frameworks
- ❌ No test scripts
- ❌ No CI/CD pipeline

**Critical Gap:** The app has zero automated testing, relying entirely on manual testing.

---

## Testing Strategy

### 1. Unit Tests (Target: 60% coverage)

**Frontend (TypeScript/React)**
- **Framework:** Vitest + React Testing Library
- **Why Vitest:** Fast, Vite-native, TypeScript support, ESM compatible
- **Scope:**
  - Components (11 components)
  - Services (agentService, authService)
  - Stores (chatStore, spacesStore, settingsStore)
  - Utilities and helpers

**Backend (Rust)**
- **Framework:** Built-in `cargo test`
- **Scope:**
  - Tauri commands (all public functions)
  - ACP client implementation
  - Database operations
  - File system operations
  - Settings management

### 2. Integration Tests (Target: Critical paths covered)

**ACP Integration Tests**
- **Authentication:** Both OAuth (.claude.json) and API key flows
- **Message Flow:** Send message → receive stream → tool calls → permissions
- **File Operations:** Read/write within temp directory
- **Session Management:** Create/destroy sessions
- **Error Handling:** Network failures, invalid responses

**Database Integration Tests**
- **Conversations:** Save/load/delete with SQLite
- **Spaces:** CRUD operations
- **Migrations:** Timestamp migration logic

**File System Integration Tests**
- **Security:** Path traversal prevention
- **CLAUDE.md:** Read/write operations
- **Space Files:** List/read operations

### 3. End-to-End Tests (Target: Happy path + critical errors)

**Framework:** Playwright (future - not in initial implementation)
- **User Flows:**
  - Onboarding → Create space → Send message → Receive response
  - File attachment → Send with context → Verify in message
  - Permission request → Approve → Tool execution
  - Settings → Enable auto-approve → Verify behavior
- **Error Scenarios:**
  - No authentication → Error message → Settings prompt
  - Network failure → Graceful degradation
  - Invalid space → Error handling

---

## Testing with Claude Code ACP

### Authentication Testing

**Option 1: Claude Subscription (.claude.json)**
- ✅ **Recommended for development/CI**
- Uses existing Claude Pro/Max subscription
- No API token consumption
- File location: `~/.claude.json`
- Structure:
  ```json
  {
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": "..."
  }
  ```

**Option 2: API Key**
- For testing fallback behavior
- Requires `ANTHROPIC_API_KEY` env var
- Consumes API credits

### Test Environment Setup

**Temporary Directory Strategy:**
```
/tmp/thinking-space-tests/
├── spaces/
│   └── test-space-{uuid}/
│       ├── CLAUDE.md
│       └── .space-metadata.json
├── conversations.db (test database)
└── settings.json (test settings)
```

**Benefits:**
- Isolated from user data
- Clean slate for each test
- Easy cleanup
- No risk of corrupting real data

### Safe Test Operations

**Read-Only Operations (Safe in any environment):**
- List spaces
- Read CLAUDE.md
- Load conversations
- Get settings

**Write Operations (MUST use temp directory):**
- Create/delete spaces
- Write CLAUDE.md
- Save conversations
- Modify settings

**ACP Operations (Safe - uses test session):**
- Send messages (short prompts to minimize cost)
- Tool call execution (mocked or sandboxed)
- Permission requests (automated approval in tests)
- Session lifecycle

---

## Test Implementation Plan

### Phase 1: Foundation (Week 1) ✅ IN PROGRESS

**1.1 Install Testing Dependencies**
```bash
# Frontend
npm install -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom

# No additional Rust deps needed (cargo test built-in)
```

**1.2 Configuration Files**
- `vitest.config.ts` - Frontend test config
- Test helpers and utilities
- Mock factories

**1.3 Test Scripts**
```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:rust": "cd src-tauri && cargo test",
    "test:all": "npm run test && npm run test:rust"
  }
}
```

### Phase 2: Unit Tests (Week 1-2)

**Priority 1: Critical Path Components**
- [ ] `agentService.ts` - Message sending, permission handling
- [ ] `authService.ts` - Credential management
- [ ] `chatStore.ts` - Message state management
- [ ] `PermissionDialog.tsx` - User interactions
- [ ] `ToolCallDisplay.tsx` - Status rendering

**Priority 2: Rust Backend**
- [ ] `spaces.rs` - CRUD operations, security validation
- [ ] `conversations.rs` - Database operations
- [ ] `settings.rs` - Settings persistence
- [ ] `auth.rs` - Credential loading

**Priority 3: Remaining Components**
- [ ] All other React components
- [ ] Stores (spaces, settings)
- [ ] Utility functions

### Phase 3: Integration Tests (Week 2-3)

**3.1 ACP Integration Tests**
```rust
#[cfg(test)]
mod acp_tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_send_message_with_oauth() {
        let temp_dir = TempDir::new().unwrap();
        // Setup test environment
        // Send simple message
        // Verify response stream
        // Cleanup
    }

    #[tokio::test]
    async fn test_tool_call_execution() {
        // Test tool call flow
        // Verify tool call events emitted
        // Verify status updates
    }

    #[tokio::test]
    async fn test_permission_request_flow() {
        // Test permission request
        // Auto-approve
        // Verify continuation
    }
}
```

**3.2 Database Integration Tests**
```rust
#[cfg(test)]
mod db_tests {
    #[test]
    fn test_save_and_load_conversation() {
        let temp_db = TempFile::new().unwrap();
        // Create conversation
        // Save to DB
        // Load from DB
        // Verify integrity
    }

    #[test]
    fn test_conversation_index_performance() {
        // Insert many conversations
        // Query with ORDER BY updated_at
        // Verify index is used (EXPLAIN QUERY PLAN)
    }
}
```

**3.3 File System Integration Tests**
```rust
#[cfg(test)]
mod fs_tests {
    #[test]
    fn test_path_traversal_prevention() {
        let result = read_file_content("../../../etc/passwd".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Access denied"));
    }

    #[test]
    fn test_sensitive_file_blocking() {
        let result = read_file_content("/home/user/.ssh/id_rsa".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("sensitive files"));
    }
}
```

### Phase 4: CI/CD Pipeline (Week 3)

**GitHub Actions Workflow**
```yaml
name: CI

on: [push, pull_request]

jobs:
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: cd src && npm ci
      - run: cd src && npm run test
      - run: cd src && npm run typecheck
      - run: cd src && npm run lint

  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: dtolnay/rust-toolchain@stable
      - run: cd src-tauri && cargo test
      - run: cd src-tauri && cargo clippy -- -D warnings

  integration-tests:
    runs-on: ubuntu-latest
    # Only if OAuth credentials available (not required for PRs)
    if: github.event_name == 'push'
    steps:
      - uses: actions/checkout@v3
      - name: Setup test environment
        run: |
          mkdir -p /tmp/thinking-space-tests
      - run: npm run test:integration
```

---

## Test Coverage Goals

### Minimum Viable Coverage
- **Frontend:** 60% line coverage
- **Backend:** 70% line coverage
- **Integration:** All critical paths covered

### Priority Areas (Must have 80%+ coverage)
1. Security functions (path validation, auth)
2. Data persistence (database operations)
3. ACP communication (message sending, tool calls)
4. Permission system (auto-approval, user approval)

### Lower Priority (40-60% acceptable)
- UI component edge cases
- Error message formatting
- Styling logic

---

## Testing Best Practices

### 1. Test Isolation
- Each test creates its own temp directory
- Database tests use separate SQLite file
- No shared state between tests
- Cleanup in `afterEach`/Drop impl

### 2. Descriptive Test Names
```typescript
// ✅ Good
test('should auto-approve web search tool calls when global setting enabled')

// ❌ Bad
test('auto approve')
```

### 3. Arrange-Act-Assert Pattern
```typescript
test('should save conversation to database', async () => {
  // Arrange
  const messages = [{ id: '1', role: 'user', content: 'test' }]
  const spaceId = 'test-space'

  // Act
  await saveConversation(spaceId, 'Test', messages)

  // Assert
  const loaded = await loadConversation(spaceId)
  expect(loaded).toEqual(messages)
})
```

### 4. Mock External Dependencies
- Mock Tauri `invoke` calls
- Mock file system in unit tests
- Mock ACP adapter in frontend tests
- Use real implementations in integration tests

### 5. Test Error Paths
- Not just happy path
- Test validation failures
- Test network errors
- Test malformed data

---

## Specific Test Cases

### Critical Security Tests

```rust
#[test]
fn test_path_traversal_attack_vectors() {
    let attacks = vec![
        "../../../etc/passwd",
        "..\\..\\..\\Windows\\System32",
        "/etc/shadow",
        "~/.ssh/id_rsa",
        "${HOME}/.aws/credentials",
    ];

    for attack in attacks {
        let result = read_file_content(attack.to_string());
        assert!(result.is_err(), "Failed to block: {}", attack);
    }
}

#[test]
fn test_allowed_paths() {
    let temp_file = TempFile::new().unwrap();
    std::fs::write(&temp_file, "test content").unwrap();

    let result = read_file_content(temp_file.path().to_string());
    assert!(result.is_ok());
    assert_eq!(result.unwrap(), "test content");
}
```

### ACP Integration Tests

```typescript
describe('ACP Message Flow', () => {
  it('should send message and receive streaming response', async () => {
    const { agentService } = await setupTestACP()

    const chunks: string[] = []
    for await (const chunk of agentService.sendMessage('Hello', testOptions)) {
      chunks.push(chunk)
    }

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks.join('')).toContain('Hello') // Echo or response
  })

  it('should emit tool call events', async () => {
    const toolCalls: ToolCall[] = []
    agentService.onToolCall = (tc) => toolCalls.push(tc)

    // Send message that triggers tool use
    for await (const _ of agentService.sendMessage('What files are here?', testOptions)) {
      // Collect chunks
    }

    expect(toolCalls.length).toBeGreaterThan(0)
    expect(toolCalls[0].kind).toBe('bash')
  })
})
```

### Permission System Tests

```typescript
describe('Permission Auto-Approval', () => {
  beforeEach(() => {
    // Reset settings
    agentService.resetSettings()
  })

  it('should auto-approve when global setting enabled', async () => {
    await setSettings({ always_allow_tool_actions: true })

    const request = createPermissionRequest('ls', 'bash')
    const wasAutoApproved = await agentService.handlePermission(request)

    expect(wasAutoApproved).toBe(true)
  })

  it('should auto-approve safe operations even when setting disabled', async () => {
    await setSettings({ always_allow_tool_actions: false })

    const request = createPermissionRequest('ls', 'bash')
    const wasAutoApproved = await agentService.handlePermission(request)

    expect(wasAutoApproved).toBe(true) // ls is safe
  })

  it('should request approval for unsafe operations', async () => {
    await setSettings({ always_allow_tool_actions: false })

    const request = createPermissionRequest('rm -rf /', 'bash')
    const wasAutoApproved = await agentService.handlePermission(request)

    expect(wasAutoApproved).toBe(false)
  })
})
```

---

## Test Data Management

### Fixtures
```typescript
// tests/fixtures/spaces.ts
export const mockSpace = {
  id: 'test-space-123',
  name: 'Test Space',
  path: '/tmp/thinking-space-tests/spaces/test-space-123',
  claude_md_path: '/tmp/thinking-space-tests/spaces/test-space-123/CLAUDE.md',
  created_at: Date.now(),
  last_accessed_at: Date.now(),
}

// tests/fixtures/messages.ts
export const mockMessages = [
  {
    id: '1',
    role: 'user' as const,
    content: 'Hello',
    timestamp: Date.now(),
  },
  {
    id: '2',
    role: 'assistant' as const,
    content: 'Hi there!',
    timestamp: Date.now() + 1000,
  },
]
```

### Test Helpers
```typescript
// tests/helpers/setup.ts
export async function setupTestEnvironment() {
  const tempDir = await fs.mkdtemp('/tmp/thinking-space-tests-')
  process.env.TEST_TEMP_DIR = tempDir

  return {
    tempDir,
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true })
    }
  }
}

export async function setupTestACP() {
  // Check for .claude.json
  const hasOAuth = await checkClaudeAuth()

  if (!hasOAuth) {
    throw new Error('No Claude OAuth found. Run: claude login')
  }

  const agentService = new AgentService()
  await agentService.loadSettings()

  return { agentService }
}
```

---

## Running Tests

### Local Development
```bash
# Run all tests
npm run test:all

# Run frontend tests only
npm test

# Run with UI (interactive)
npm run test:ui

# Run with coverage
npm run test:coverage

# Run Rust tests
npm run test:rust

# Run specific test file
npm test -- agentService.test.ts

# Watch mode
npm test -- --watch
```

### Before Committing
```bash
# Check everything passes
npm run test:all
npm run typecheck
npm run lint
cd src-tauri && cargo clippy
```

---

## Success Metrics

### Week 1 (Foundation)
- ✅ Testing frameworks installed
- ✅ First 10 unit tests passing
- ✅ CI pipeline running

### Week 2 (Coverage)
- ✅ 40% frontend coverage
- ✅ 50% backend coverage
- ✅ Integration tests for ACP

### Week 3 (Hardening)
- ✅ 60% frontend coverage
- ✅ 70% backend coverage
- ✅ All critical paths tested

### Production Ready
- ✅ 70%+ overall coverage
- ✅ Zero high-severity bugs in tests
- ✅ All security tests passing
- ✅ CI/CD green on main branch

---

## Resources

### Testing Guides
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Rust Testing Guide](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Tauri Testing Guide](https://tauri.app/v1/guides/testing/mocking/)

### ACP Documentation
- [Agent Client Protocol Spec](https://github.com/anthropics/agent-protocol)
- [Zed Testing Patterns](https://github.com/zed-industries/zed/tree/main/crates/agent2)

### Security Testing
- [OWASP Path Traversal](https://owasp.org/www-community/attacks/Path_Traversal)
- [Rust Security Guidelines](https://anssi-fr.github.io/rust-guide/)

---

## Conclusion

This testing plan provides a comprehensive strategy for achieving production-quality test coverage. The phased approach allows for incremental progress while prioritizing the most critical functionality.

**Key Principles:**
1. Test isolation (temp directories, no shared state)
2. Use real Claude Code OAuth (no API token waste)
3. Comprehensive security testing
4. Integration tests for ACP flow
5. CI/CD automation

**Next Steps:**
1. Install testing dependencies
2. Create test configuration
3. Write first 10 critical tests
4. Set up CI pipeline
5. Iterate to coverage goals
