# Frontend Display Fix - Request ID Tracking

**Date:** October 15, 2024
**Status:** ✅ Fixed - Ready for testing

---

## The Problem

After fixing authentication, the backend was successfully:
- ✅ Connecting to Claude
- ✅ Sending prompts
- ✅ Receiving responses
- ✅ Emitting events to frontend

**But the UI wasn't displaying the responses.**

Console showed:
```
[ACP V2] Agent message chunk received
[ACP V2] Emitting chunk: Hello! 👋 How can I help you today?
[ACP V2] Emitting event: agent-message-chunk
```

But nothing appeared in the UI.

---

## Root Cause

**The frontend couldn't match events to pending requests.**

The frontend was looking for `requestId` by parsing it from `sessionId`:

```typescript
// Frontend expected sessionId format: "session-{requestId}"
const match = sessionId.match(/session-(\d+)/);
if (match) {
  const requestId = parseInt(match[1]);
  // Find pending request and call onStream
}
```

But the backend was sending the **ACP session UUID**:
```json
{
  "sessionId": "0199ea4b-e21e-76bd-8733-558d81c9882f",  // UUID, not "session-123"
  "text": "Hello! 👋 How can I help you today?"
}
```

The regex didn't match, so the frontend never called `onStream()`, and chunks were silently dropped.

---

## The Solution

**Include `requestId` directly in the event payload.**

### Backend Changes

**1. Track current request ID in ThinkingSpaceClient**

**File:** `src-tauri/src/acp_v2/client.rs`

```rust
pub struct ThinkingSpaceClient {
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    permission_tx: mpsc::UnboundedSender<FrontendPermissionRequest>,
    permission_rx: Arc<Mutex<mpsc::UnboundedReceiver<FrontendPermissionResponse>>>,

    // NEW: Track current request ID for event emission
    current_request_id: Arc<Mutex<Option<u64>>>,
}

// NEW: Method to set current request ID
pub fn set_current_request_id(&self, request_id: u64) {
    *self.current_request_id.lock() = Some(request_id);
}
```

**2. Include requestId in chunk events**

```rust
SessionUpdate::AgentMessageChunk { content } => {
    if let agent_client_protocol_schema::ContentBlock::Text(text) = content {
        let request_id = self.current_request_id.lock().clone();

        self.emit_event(
            "agent-message-chunk",
            serde_json::json!({
                "sessionId": session_id,
                "requestId": request_id,  // ← NEW
                "text": text.text,
            }),
        );
    }
}
```

**3. Set request ID before sending prompt**

**File:** `src-tauri/src/acp_v2/manager.rs`

```rust
pub fn agent_v2_send_message(...) -> Result<(), String> {
    // Clone client to pass into thread
    let client = state.client.clone();
    let request_id = params.request_id;

    std::thread::spawn(move || {
        // ... async setup ...

        // Set the current request ID so client can include it in events
        client.set_current_request_id(request_id);

        // Send the prompt
        conn.prompt(...).await?;
    });
}
```

### Frontend Changes

**File:** `src/src/services/agentService.ts`

**Before:**
```typescript
listen<{ sessionId: string; text: string }>("agent-message-chunk", (event) => {
  const { sessionId, text } = event.payload;

  // Try to extract requestId from sessionId
  const match = sessionId.match(/session-(\d+)/);
  if (match) {
    const requestId = parseInt(match[1]);
    const pending = this.pendingRequests.get(requestId);
    if (pending && pending.onStream) {
      pending.onStream(text);
    }
  }
});
```

**After:**
```typescript
listen<{ sessionId: string; requestId?: number; text: string }>(
  "agent-message-chunk",
  (event) => {
    const { requestId, text } = event.payload;

    if (requestId !== undefined) {
      const pending = this.pendingRequests.get(requestId);
      if (pending && pending.onStream) {
        pending.onStream(text);  // ✓ This will now be called!
      }
    }
  }
);
```

---

## How It Works Now

### Flow Diagram

```
1. Frontend: sendMessage() with requestId=1
2. Backend: agent_v2_send_message receives request_id=1
3. Backend: client.set_current_request_id(1)
4. Backend: Send prompt to Claude
5. Claude: Streams response chunks
6. Backend: session_notification() called with chunk
7. Backend: Get current_request_id (1) from client
8. Backend: Emit event with { requestId: 1, text: "Hello!" }
9. Frontend: Receive event with requestId=1
10. Frontend: Find pendingRequests.get(1)
11. Frontend: Call pending.onStream("Hello!")
12. UI: Display "Hello!" ✓
```

### Event Payload Structure

**Before (broken):**
```json
{
  "sessionId": "0199ea4b-e21e-76bd-8733-558d81c9882f",
  "text": "Hello! 👋"
}
```
❌ Frontend couldn't extract requestId from UUID

**After (fixed):**
```json
{
  "sessionId": "0199ea4b-e21e-76bd-8733-558d81c9882f",
  "requestId": 1,
  "text": "Hello! 👋"
}
```
✅ Frontend uses requestId directly

---

## Expected Console Output

### Backend
```
[ACP V2] Sending prompt...
[ACP V2] Agent message chunk received
[ACP V2] Emitting chunk: Hello! 👋 How can I help you today?
[ACP V2] Emitting event: agent-message-chunk
[ACP V2] Prompt completed with stop reason: EndTurn
```

### Frontend
```
[FRONTEND V2] Sending message with requestId: 1
[FRONTEND V2] Received message chunk (requestId: 1): Hello! 👋 How can I help you today?
[FRONTEND V2] Message complete: 1
```

### UI
```
User: hello
Assistant: Hello! 👋 How can I help you today?
```

---

## Testing Checklist

- [ ] Send a message
- [ ] Console shows: "Received message chunk (requestId: X)"
- [ ] Console shows chunks with correct text
- [ ] **UI displays the response text** ✓
- [ ] Streaming works (text appears progressively)
- [ ] Multiple messages work (requestId increments)
- [ ] No "Received chunk without requestId" warnings

---

## Files Modified

### Backend
- **`src-tauri/src/acp_v2/client.rs`**
  - Added `current_request_id` field
  - Added `set_current_request_id()` method
  - Include `requestId` in agent-message-chunk events

- **`src-tauri/src/acp_v2/manager.rs`**
  - Clone client to pass into thread
  - Call `client.set_current_request_id()` before sending prompt

### Frontend
- **`src/src/services/agentService.ts`**
  - Update event type to include `requestId`
  - Use `requestId` directly instead of parsing from `sessionId`
  - Add warning for chunks without requestId

---

## Why This Approach?

### Alternative Approaches Considered

**1. Store session_id → request_id mapping**
```rust
// Would need to maintain a HashMap
session_to_request: Arc<Mutex<HashMap<String, u64>>>
```
❌ More complex, needs cleanup when sessions end

**2. Change session ID to include request ID**
```rust
// Can't do this - ACP controls session ID format
```
❌ Not possible, session IDs come from ACP library

**3. Current approach: Track in client**
```rust
current_request_id: Arc<Mutex<Option<u64>>>
```
✅ Simple, works because we have one session shared across requests

### Limitations

**Concurrency:** This assumes one request at a time. If we send multiple messages concurrently, they would all use the same request_id.

**Workaround if needed:**
- Use a `HashMap<SessionId, u64>` to track request_id per session
- Create new sessions for each request instead of reusing
- For now, single request at a time is fine

---

## Summary

The fix was straightforward once we identified the problem:

**Problem:** Frontend couldn't match events to requests
**Cause:** Tried to parse requestId from sessionId UUID
**Fix:** Include requestId directly in event payload
**Result:** Frontend can now match chunks to pending requests ✓

This completes the full flow:
1. ✅ LocalSet lifecycle (no UI freeze)
2. ✅ Race condition (agent-ready event)
3. ✅ OAuth authentication (don't pass OAuth token as API key)
4. ✅ Frontend display (include requestId in events)

**The app should now work end-to-end!** 🎉
