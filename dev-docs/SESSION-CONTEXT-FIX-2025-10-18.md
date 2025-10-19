# Session Context Management Fix - October 18, 2025

## Problem Description

User reported that when reopening a previous conversation after closing and reopening the app, the conversation history was displayed but Claude had no context from previous messages. It would respond as if starting a fresh conversation.

**Symptoms:**
- Previous messages visible in UI ✅
- Previous messages stored in SQLite ✅
- New messages sent to Claude have no context from history ❌

## Root Cause Analysis

### The Fundamental Misunderstanding

We were treating ACP sessions like database records that could be persisted and restored. **This is wrong.**

**How ACP Sessions Actually Work:**
1. Sessions exist only in the running ACP adapter process
2. Each `prompt()` call adds to that session's conversation history
3. When the ACP adapter restarts (or app restarts), all sessions are gone
4. Session IDs don't persist across process restarts

**Our Broken Approach:**
1. Create session → Get session ID
2. Save session ID to SQLite
3. On app restart, restore session ID from SQLite
4. Try to reuse that session ID (fails or creates confusion)
5. Fallback: Create new session and put history in system prompt ❌

**Why System Prompt Approach is Wrong:**
- System prompts are for instructions, not conversation history
- ACP expects history to be built through sequential `prompt()` calls
- The model sees history in system prompt as "instructions about past conversations" not actual conversation context

### The Correct Approach (How Zed Does It)

**Zed's approach (and now ours):**
1. Don't try to persist sessions across app restarts
2. When restoring a conversation:
   - Create a NEW session
   - Replay ALL previous user messages through `prompt()` calls
   - This rebuilds the conversation context properly
3. The model builds its understanding through actual prompt/response cycles

## Solution Implementation

### Backend Changes (`src-tauri/src/acp_v2/manager.rs`)

**Old Logic:**
```rust
// Try to reuse cached session
if let Some(session_id) = cached_session_id {
    // Send message with this session
} else {
    // Create new session
    // Put history in system prompt ❌
}
```

**New Logic:**
```rust
// Determine if we need a new session
let need_new_session = cached_session_id.is_none()
    || conversation_history.is_some();

if need_new_session {
    // Create new session
    let session = conn.new_session(...).await?;

    // Replay conversation history
    if let Some(history) = conversation_history {
        for msg in history {
            if msg.role == "user" {
                // Send each previous user message
                conn.prompt(session_id, msg.content).await?;
                // Agent responds to each, building context
            }
        }
    }
}

// Send current message
conn.prompt(session_id, current_message).await?;
```

### Key Changes

1. **Session Creation Logic:**
   - Create new session if: (a) no cached session, OR (b) have conversation history
   - Having conversation history means we're restoring, so start fresh

2. **History Replay:**
   - Only replay user messages (not assistant messages)
   - Agent generates its own responses during replay
   - Each replay builds context naturally

3. **Removed Fallback Code:**
   - Deleted the "Session not found" recovery logic
   - Deleted the system prompt history injection
   - Cleaner, more straightforward flow

## Impact

### Before (Broken)
```
User opens previous chat
→ UI shows: "What's the capital of France?"
→ UI shows: "The capital of France is Paris."
→ User asks: "What about its population?"
→ Claude responds: "What city are you asking about?"
  (No context - doesn't know we're talking about Paris)
```

### After (Fixed)
```
User opens previous chat
→ UI shows: "What's the capital of France?"
→ UI shows: "The capital of France is Paris."
→ Backend replays: "What's the capital of France?" to ACP
→ ACP responds (invisible to user, builds context)
→ User asks: "What about its population?"
→ Claude responds: "Paris has a population of approximately 2.1 million..."
  (Has full context from replayed conversation)
```

## Performance Considerations

**Concern:** Replaying conversations might be slow for long chats.

**Reality:**
- ACP adapter is local, responses are fast
- Only user messages are replayed (roughly half the conversation)
- Agent generates minimal responses during replay (context building, not full responses)
- This is how Zed does it - proven to work well

**Optimization Ideas (Future):**
- Cache the last N messages only
- Summarize very old conversations
- Stream replay in background while showing UI

## Testing

### Manual Test Cases

1. **Fresh conversation:**
   - Start app
   - Send message "Hello, I'm working on a Rust project"
   - Send message "Can you help me with error handling?"
   - ✅ Should have context from first message

2. **Restored conversation:**
   - Start app, send messages
   - Close app
   - Reopen app, switch to space
   - Send new message
   - ✅ Should have context from ALL previous messages

3. **Long conversation:**
   - Have a 20+ message conversation
   - Close and reopen app
   - Send new message
   - ✅ Should still have full context (may take a moment to replay)

### Console Output to Watch For

**Good signs:**
```
[ACP V2] Creating new session for conversation...
[ACP V2] New session created: abc123
[ACP V2] Replaying 5 previous messages to rebuild context...
[ACP V2] Replaying message 1/5: user (42 chars)
[ACP V2] Replaying message 2/5: user (58 chars)
...
[ACP V2] Finished replaying conversation history
[ACP V2] Sending current prompt...
```

**Bad signs:**
```
[ACP V2] Session not found
[ACP V2] Putting history in system prompt
```

## Files Modified

1. **src-tauri/src/acp_v2/manager.rs**
   - Removed session restoration logic
   - Added history replay logic
   - Removed system prompt history injection
   - Simplified session creation flow

## Known Limitations

1. **First message after app restart is slower:**
   - Takes time to replay history
   - Acceptable tradeoff for correct context
   - Could show "Restoring context..." UI (future)

2. **Very long conversations (100+ messages):**
   - Replay takes longer
   - Might hit token limits
   - Future: Implement summarization or truncation

3. **No session persistence across adapter restarts:**
   - This is by design - ACP sessions don't persist
   - SQLite still stores conversation history for UI
   - Session IDs are transient, don't rely on them

## Comparison with Previous Approach

| Aspect | Old (Broken) | New (Fixed) |
|--------|-------------|-------------|
| Session reuse | Tried to reuse across restarts | Always create new for restores |
| History method | System prompt injection | Replay through prompt() calls |
| Context accuracy | ❌ Model confused | ✅ Perfect context |
| ACP compliance | ❌ Misusing system prompt | ✅ Following protocol |
| Code complexity | High (fallback logic) | Lower (straightforward) |
| Performance | Fast but wrong | Slightly slower but correct |

## Related Documentation

- ACP Protocol: https://agentclientprotocol.com/
- Zed's implementation: `~/Symbols/Codes/zed/crates/acp_thread/`
- Our implementation: `src-tauri/src/acp_v2/manager.rs`

---

**Summary:** Fixed context loss issue by properly replaying conversation history through ACP's `prompt()` calls instead of incorrectly stuffing it into system prompts. Sessions are now treated as transient (as intended by ACP), and conversations are restored by replaying messages to rebuild context naturally.
