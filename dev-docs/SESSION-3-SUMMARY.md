# Session 3: OAuth Authentication Implementation

## Summary

This session focused on implementing OAuth-based authentication for Claude subscriptions (Claude Pro/Max) as the primary authentication method, with API key as a fallback option, per user request.

## User Request

> "I would prefer our default not to be to use anthropic key, but to rather be using the Claude Agent SDK which leverages an existing Claude subscription; this is how Zed does it."

## Research Findings

1. **Zed's Approach**: Zed runs Claude Code CLI as a subprocess and communicates via ACP (Agent Context Protocol). The `/login` command triggers browser OAuth flow.

2. **Claude Code Authentication**:
   - OAuth credentials stored in macOS Keychain or `~/.claude/.credentials.json`
   - Format: `{ accessToken, refreshToken, expiresAt, scopes }`
   - Token prefix: `sk-ant-oat01-...` (OAuth Access Token)

3. **Critical Discovery**: The Claude Agent SDK is Node.js-only and cannot run directly in the browser (Tauri's renderer process).

## Implementation Completed

### 1. Authentication Service (`src/src/services/authService.ts`)

Created a service that prioritizes authentication sources:

```typescript
export class AuthService {
  async getCredentials(): Promise<AuthCredentials | null> {
    // 1. Try Claude Code OAuth credentials (from Keychain or file)
    // 2. Fall back to API key from settings
    // 3. Return null if neither available
  }
}
```

**Features**:
- 1-minute credential cache for performance
- Automatic OAuth token refresh (placeholder for now)
- Clear error messages guiding users to authenticate

### 2. Rust Backend Auth Module (`src-tauri/src/auth.rs`)

Implemented Tauri commands for credential access:

```rust
// Load from macOS Keychain (service: "ClaudeCode", account: "oauth")
#[tauri::command]
pub fn load_claude_credentials() -> Result<Option<OAuthCredentials>, String>

// Load from ~/.claude/.credentials.json
#[tauri::command]
pub fn load_claude_credentials_file() -> Result<Option<OAuthCredentials>, String>

// Load/save API key from ~/.thinking-space/config.json
#[tauri::command]
pub fn load_api_key() -> Result<Option<String>, String>

#[tauri::command]
pub fn save_api_key(api_key: String) -> Result<(), String>

// Open setup instructions in browser
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String>
```

**Dependencies Added**:
- `security-framework = "3"` (macOS Keychain access)
- `opener = "0.7"` (open URLs in browser)

### 3. Updated Agent Service (`src/src/services/agentService.ts`)

Modified to use `authService` for automatic credential detection:

```typescript
async *sendMessage(message: string, options: SendMessageOptions) {
  // Get credentials (OAuth preferred, API key fallback)
  const credentials = await authService.getCredentials();

  if (!credentials) {
    throw new Error("No authentication found...");
  }

  process.env.ANTHROPIC_API_KEY = credentials.token;
  console.log(`Using ${credentials.type} authentication`);

  // ... rest of implementation
}
```

### 4. Enhanced Settings Panel (`src/src/components/SettingsPanel.tsx`)

Complete redesign with authentication status display:

**Features**:
- **Authentication Status Section**: Shows current auth method (OAuth vs API key) with visual indicators
- **Option 1 - Claude Subscription (Recommended)**:
  - Purple highlighted section explaining Claude Pro/Max usage
  - Step-by-step setup instructions
  - Button to open Claude Code documentation
- **Option 2 - API Key (Alternative)**:
  - Traditional API key input (as fallback)
  - Links to Anthropic Console
- **Visual Status Indicators**:
  - Green checkmark for OAuth (subscription)
  - Blue key icon for API key
  - Yellow warning for no authentication
  - Token expiration display

### 5. Removed API Key Requirement from Chat Store

`chatStore.ts` no longer checks for API key - all authentication handled by `agentService`:

```typescript
sendMessage: async (content: string) => {
  // No more apiKey parameter - handled automatically
  for await (const chunk of agentService.sendMessage(content, {
    spaceId, spacePath, claudeMdContent
  })) {
    // ...
  }
}
```

## Architectural Issue Discovered

**Problem**: The Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`) is a Node.js library that requires:
- `fs`, `path`, `child_process`, `readline`, `os`, `crypto` modules
- Cannot run in browser environment (Tauri renderer process)

**Build Error**:
```
Module "path" has been externalized for browser compatibility...
"setMaxListeners" is not exported by "__vite-browser-external"
```

**Solution Required**: Move Agent SDK to a Node.js sidecar process (similar to how Zed does it):

```
┌─────────────────────────────────────┐
│   Frontend (Browser/Tauri)          │
│   - UI                               │
│   - State Management                 │
└──────────────┬──────────────────────┘
               │ Tauri IPC
┌──────────────┴──────────────────────┐
│   Backend (Rust)                     │
│   - File System                      │
│   - Settings                         │
│   - Spawns Node.js Sidecar ─────────┐
└─────────────────────────────────────┘│
                                       │
               ┌───────────────────────┘
               │
┌──────────────┴──────────────────────┐
│   Node.js Sidecar Process            │
│   - Claude Agent SDK                 │
│   - Streaming responses              │
│   - Tool handlers                    │
└─────────────────────────────────────┘
```

## Files Modified

### New Files
- `src/src/services/authService.ts` - Authentication abstraction layer
- `src-tauri/src/auth.rs` - Credential loading backend
- `dev-docs/SESSION-3-SUMMARY.md` - This file

### Modified Files
- `src/src/services/agentService.ts` - Use authService, fix SDK API usage
- `src/src/stores/chatStore.ts` - Remove API key requirement
- `src/src/components/SettingsPanel.tsx` - Complete redesign with OAuth focus
- `src-tauri/src/main.rs` - Register auth commands
- `src-tauri/Cargo.toml` - Add dependencies
- `src/tsconfig.app.json` - Add node types
- `package.json` (in src/) - Add @types/node

## Current State

### ✅ Completed
- Authentication service layer with OAuth priority
- Backend credential loading (Keychain + file)
- Settings UI with OAuth-first design
- All TypeScript compilation errors fixed
- Rust backend builds successfully

### ❌ Blocked
- Frontend build fails due to Node.js modules in browser
- Agent SDK cannot run in current architecture

## Next Steps

To complete this implementation, we need to:

1. **Create Node.js Sidecar**:
   - Create `src-tauri/sidecar/agent-server.js`
   - Implement JSON-RPC server over stdin/stdout
   - Handle Agent SDK query sessions
   - Manage streaming responses

2. **Update Rust Backend**:
   - Spawn Node.js sidecar process on startup
   - Implement IPC communication (stdin/stdout)
   - Create Tauri command to send messages to sidecar
   - Handle streaming responses from sidecar

3. **Update Frontend**:
   - Remove direct Agent SDK import
   - Update agentService to call Tauri commands
   - Keep all authentication logic as-is

4. **Bundle for Distribution**:
   - Include Node.js sidecar script in Tauri bundle
   - Configure Tauri to bundle Node.js runtime (or require system Node.js)

## User Experience Goals Met

✅ **Primary authentication via Claude subscription** (OAuth)
✅ **Fallback to API key** for users without subscription
✅ **Clear setup instructions** in Settings panel
✅ **Visual status indicators** showing auth state
✅ **Automatic credential detection** (Keychain + file)
✅ **No breaking changes** to existing Spaces or data

## Technical Debt

1. **OAuth Token Refresh**: Placeholder implementation - needs actual Anthropic OAuth API call
2. **Node.js Sidecar**: Required architecture change to support Agent SDK
3. **Error Handling**: Need better user-facing errors for auth failures
4. **Token Expiration**: Should proactively refresh before expiration

## Lessons Learned

1. **Browser vs Node.js**: Always check if libraries can run in target environment before integrating
2. **Zed's Architecture**: Their sidecar approach is necessary, not just a design choice
3. **Authentication Complexity**: OAuth + token refresh + credential storage is non-trivial
4. **User Experience**: Clear guidance is essential when multiple auth options exist

---

**Session Duration**: ~2 hours
**Commits**: Pending (blocked on build issues)
**LOC Added**: ~800 lines
**LOC Modified**: ~200 lines
