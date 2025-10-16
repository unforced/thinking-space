# OAuth Authentication Fix

**Date:** October 15, 2024
**Status:** ✅ Fixed - Ready for testing

---

## The Problem

After fixing the LocalSet lifecycle and race condition issues, messages were being sent successfully but Claude was returning an error:

```
Invalid API key · Fix external API key
```

Even though the user was authenticated with Claude Code subscription (OAuth).

---

## Root Cause

**We were passing OAuth access tokens as if they were API keys.**

The `@zed-industries/claude-code-acp` adapter uses the Claude Code SDK internally, which has two authentication modes:

1. **API Key** - Set via `ANTHROPIC_API_KEY` environment variable
2. **OAuth** - Automatically uses Claude Code's stored credentials from the system

When the user is authenticated with Claude Code (OAuth), we were incorrectly:
1. Getting the OAuth `accessToken` from Claude Code credentials
2. Passing it to the backend as `apiKey`
3. Setting it as `ANTHROPIC_API_KEY` environment variable
4. Claude's API rejected it because **OAuth tokens are not API keys**

---

## The Solution

**Don't pass OAuth tokens to the adapter - let it use Claude Code's stored credentials automatically.**

### Frontend Changes

**File:** `src/src/services/agentService.ts`

```typescript
// Before (WRONG):
await invoke("agent_v2_start", { apiKey: credentials.token });
// This passed OAuth token as API key ❌

// After (CORRECT):
const apiKey = credentials.type === "api-key" ? credentials.token : null;
console.log(`[FRONTEND V2] Auth type: ${credentials.type}`);
await invoke("agent_v2_start", { apiKey });
// Only pass API key for API key auth, null for OAuth ✓
```

### Backend Changes

**File:** `src-tauri/src/acp_v2/manager.rs`

**1. Don't require API key (allow OAuth)**

```rust
// Before (WRONG):
let api_key_value = api_key
    .or_else(|| std::env::var("ANTHROPIC_API_KEY").ok())
    .unwrap_or_default();

if api_key_value.is_empty() {
    return Err("No API key provided".to_string());
}

// After (CORRECT):
let api_key_value = api_key.or_else(|| std::env::var("ANTHROPIC_API_KEY").ok());
// No error if empty - adapter will use OAuth ✓
```

**2. Conditionally set environment variable**

```rust
// Before (WRONG):
let mut child = tokio::process::Command::new("npx")
    .arg("@zed-industries/claude-code-acp")
    .env("ANTHROPIC_API_KEY", api_key_value)  // Always set ❌
    .spawn()?;

// After (CORRECT):
let mut cmd = tokio::process::Command::new("npx");
cmd.arg("@zed-industries/claude-code-acp")
    .stdin(std::process::Stdio::piped())
    .stdout(std::process::Stdio::piped())
    .stderr(std::process::Stdio::inherit());

// Only set ANTHROPIC_API_KEY if we have one
if let Some(key) = api_key_value {
    println!("[ACP V2] Using API key authentication");
    cmd.env("ANTHROPIC_API_KEY", key);
} else {
    println!("[ACP V2] Using Claude Code OAuth credentials");
}

let mut child = cmd.spawn()?;
```

---

## How It Works Now

### OAuth Flow (Claude Code Subscription)

```
1. User authenticated with Claude Code ✓
2. Frontend: credentials.type = "oauth"
3. Frontend: Pass apiKey = null to backend
4. Backend: Don't set ANTHROPIC_API_KEY env var
5. Adapter: Uses Claude Code's stored OAuth credentials ✓
6. Claude API: Authenticates successfully ✓
```

### API Key Flow (Manual API Key)

```
1. User entered API key in settings ✓
2. Frontend: credentials.type = "api-key"
3. Frontend: Pass apiKey = "sk-ant-..." to backend
4. Backend: Set ANTHROPIC_API_KEY env var
5. Adapter: Uses environment variable API key ✓
6. Claude API: Authenticates successfully ✓
```

---

## Expected Console Output

### OAuth Authentication
```
[FRONTEND V2] Auth type: oauth
[ACP V2] Starting claude-code-acp adapter...
[ACP V2] Using Claude Code OAuth credentials
[ACP V2] Adapter process spawned
[ACP V2] Connection created, spawning IO task...
[ACP V2] Initializing ACP protocol...
[ACP V2] Initialized! Protocol version: ProtocolVersion(1)
[ACP V2] Emitted agent-ready event
[ACP V2] Session created: 0199ea48-...
[ACP V2] Sending prompt...
[ACP V2] Agent message chunk received
[ACP V2] Emitting chunk: Hello! How can I help you today?
```

### API Key Authentication
```
[FRONTEND V2] Auth type: api-key
[ACP V2] Starting claude-code-acp adapter...
[ACP V2] Using API key authentication
[ACP V2] Adapter process spawned
[ACP V2] Connection created, spawning IO task...
[ACP V2] Initializing ACP protocol...
[ACP V2] Initialized! Protocol version: ProtocolVersion(1)
[ACP V2] Emitted agent-ready event
[ACP V2] Session created: 0199ea48-...
[ACP V2] Sending prompt...
[ACP V2] Agent message chunk received
[ACP V2] Emitting chunk: Hello! How can I help you today?
```

---

## Testing Checklist

### OAuth Authentication (Claude Code Subscription)
- [ ] Console shows: "Auth type: oauth"
- [ ] Console shows: "Using Claude Code OAuth credentials"
- [ ] No "Invalid API key" error
- [ ] Messages receive proper responses (not errors)
- [ ] Streaming works

### API Key Authentication (Manual API Key)
- [ ] Console shows: "Auth type: api-key"
- [ ] Console shows: "Using API key authentication"
- [ ] Messages receive proper responses
- [ ] Streaming works

---

## Files Modified

### Frontend
- **`src/src/services/agentService.ts`**
  - Check `credentials.type` before passing to backend
  - Only pass token if `type === "api-key"`
  - Pass `null` for OAuth authentication

### Backend
- **`src-tauri/src/acp_v2/manager.rs`**
  - Remove requirement for API key
  - Conditionally set `ANTHROPIC_API_KEY` environment variable
  - Add debug logging for auth type

---

## Key Learnings

### 1. OAuth Tokens ≠ API Keys

OAuth access tokens and API keys are completely different:
- **API Keys**: Static credentials like `sk-ant-api03-...`
- **OAuth Tokens**: Time-limited JWT tokens from OAuth flow
- They are **not interchangeable**

### 2. The Claude Code SDK Has Built-in Auth

The `@anthropic-ai/claude-agent-sdk` (used by `claude-code-acp`) automatically:
- Looks for `ANTHROPIC_API_KEY` environment variable
- Falls back to Claude Code's stored OAuth credentials
- Handles token refresh automatically

We don't need to manage OAuth ourselves - the SDK does it!

### 3. Environment Variable Presence Matters

Setting `ANTHROPIC_API_KEY=""` (empty) is different from **not setting it at all**:
- Empty string: "Use this empty key" → Error
- Not set: "Find credentials yourself" → Uses OAuth ✓

---

## Summary

The fix is simple but critical:

**Before:** We were treating OAuth tokens as API keys ❌
**After:** We let the adapter use Claude Code's OAuth automatically ✓

This allows users to:
1. ✅ Use their Claude Code subscription (OAuth)
2. ✅ Use a manual API key (if preferred)
3. ✅ Switch between them seamlessly

---

## What's Fixed Now

| Issue | Status |
|-------|--------|
| LocalSet lifecycle (UI freeze) | ✅ Fixed |
| Race condition (Not connected) | ✅ Fixed |
| OAuth authentication (Invalid API key) | ✅ Fixed |
| Message streaming | ✅ Should work |
| Event emission | ✅ Working |

Ready for final testing! 🎉
