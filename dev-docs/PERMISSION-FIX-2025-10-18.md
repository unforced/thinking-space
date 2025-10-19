# Permission Request UI Fix - October 18, 2025

## Problem Description

User reported a critical bug where permission requests were not showing in the UI, causing the app to hang with a "..." loading state.

**Symptoms:**

- Console logs showed permission requests being emitted from backend
- Frontend received the events successfully
- Permission callbacks were being triggered
- **BUT** the UI never displayed the permission dialog
- User was left stuck in a loading state with no way to proceed

**Console Evidence:**

```
[FRONTEND V2] Tool call: "Write /Users/.../protest.md"
[FRONTEND V2] Permission request: ""
[FRONTEND V2] Permission request details: Object
[FRONTEND V2] Not auto-approved, showing to user
[ChatArea] Permission request received: ""
```

## Root Cause Analysis

The bug was in **ChatArea.tsx** line ~330. The permission dialog was only rendered when:

```tsx
{streaming && currentStreamingMessage && (
  // PermissionDialog here
)}
```

**The Problem:** Permission requests often arrive **before** any message content is streamed. The flow is:

1. User sends message
2. Claude starts processing
3. Claude wants to use a tool (e.g., Write)
4. **Permission request is emitted** ← At this point, `currentStreamingMessage` is still empty
5. Permission needs approval before proceeding
6. Only after approval does Claude stream response text

Since `currentStreamingMessage` was empty, the entire block (including the PermissionDialog) wasn't rendered, so the user never saw the permission request.

## Solution

Changed the rendering condition to show the streaming message block if **any** of these conditions are true:

```tsx
{streaming && (currentStreamingMessage || toolCalls.size > 0 || permissionRequest) && (
  // Now renders if there's a permission request, even without message content
)}
```

Also wrapped the message content rendering conditionally:

```tsx
{
  currentStreamingMessage && (
    <div className="prose...">
      <ReactMarkdown>{currentStreamingMessage}</ReactMarkdown>
    </div>
  );
}
```

## Additional Improvements

### 1. Enhanced Debugging

Added comprehensive logging throughout the permission flow:

**agentService.ts:**

- Full payload logging for permission requests
- Detailed auto-approval decision logging
- Request/response correlation tracking

**ChatArea.tsx:**

- Permission queue state tracking
- Streaming state logging
- Component state debugging

**PermissionDialog.tsx:**

- Render confirmation logging
- Request data validation

### 2. Debug UI Components

Added temporary debug tools for development:

**Debug Info Panel** (`ChatArea.tsx`):

```tsx
<div className="bg-yellow-100...">
  Debug: streaming={...} | hasMessage={...} |
  toolCalls={...} | permissionRequest={...} | queueLength={...}
</div>
```

**PermissionTestPanel** (`PermissionTestPanel.tsx`):

- Standalone test component
- Triggers mock permission requests
- Verifies callback wiring
- Useful for testing without triggering full AI flow

### 3. Better Error Handling

- Added null checks in PermissionDialog
- Better logging of permission request structure
- Options array validation

## Files Modified

1. **src/src/components/ChatArea.tsx**
   - Fixed rendering condition (critical fix)
   - Added debug panel
   - Enhanced logging in callbacks
   - Added PermissionTestPanel import

2. **src/src/services/agentService.ts**
   - Added full payload logging
   - Enhanced permission request details logging

3. **src/src/components/PermissionDialog.tsx**
   - Added render confirmation logging
   - Better null handling

4. **src/src/components/PermissionTestPanel.tsx** (NEW)
   - Test panel for manual permission testing
   - Simulates permission requests without AI

5. **src/src/components/ChatArea.test.tsx**
   - Fixed test data to match updated PermissionRequest interface
   - Added `session_id` and `kind` fields
   - Fixed options array to include `kind` field

## Testing Strategy

### Manual Testing

1. **Use the Debug Panel:**
   - Start the app in dev mode
   - Click the "🧪 Debug" button in bottom-right
   - Click "Trigger Test Permission"
   - Verify permission dialog appears
   - Check console logs

2. **Test with Real AI Interaction:**
   - Send a message that will trigger a Write operation
   - Example: "Write a file called protest.md with some content"
   - Verify permission dialog appears immediately
   - Verify you can approve/deny
   - Verify app doesn't hang

3. **Test Auto-Approval:**
   - Send message that triggers safe operations (web search, file read)
   - Verify these auto-approve without showing dialog
   - Send message that triggers Write operation
   - Verify this shows permission dialog

### Automated Testing

The existing test suite in `ChatArea.test.tsx` covers:

- Multiple simultaneous permission requests
- Sequential processing of permission queue
- Queue state management

## Before/After Behavior

### Before (Broken)

```
User: "Write a file"
→ streaming = true
→ currentStreamingMessage = ""
→ permissionRequest arrives
→ Condition: streaming && currentStreamingMessage
→ FALSE (because currentStreamingMessage is empty)
→ Dialog never renders
→ User sees "..." forever
```

### After (Fixed)

```
User: "Write a file"
→ streaming = true
→ currentStreamingMessage = ""
→ permissionRequest arrives
→ Condition: streaming && (currentStreamingMessage || permissionRequest)
→ TRUE (because permissionRequest exists)
→ Dialog renders
→ User can approve/deny
→ AI continues
```

## Known Issues & Future Work

1. **Remove Debug Components:**
   - PermissionTestPanel should be removed in production
   - Debug info panel should be removed
   - Excessive console.log statements should be cleaned up

2. **Test Coverage:**
   - Some test files have unrelated TypeScript errors (test infrastructure)
   - Need to add vitest-dom matchers for `toBeInTheDocument`
   - Should add integration tests for permission flow

3. **UI Polish:**
   - Permission dialog styling could be refined
   - Loading states could be more informative
   - Error states need better UX

## Performance Impact

**Minimal:** The change only affects the rendering condition check, which is already being evaluated. No new expensive operations added.

## Deployment Notes

This is a **critical bug fix** that should be deployed ASAP. Users currently cannot use Write operations or any non-auto-approved tools.

**Before deploying:**

1. Test with actual AI interactions
2. Verify auto-approval still works
3. Test permission queue handling
4. Remove debug components (or make them dev-only)

## Related Issues

- Permission requests with empty title (seen in logs) - investigate if title extraction is working correctly in backend
- Multiple simultaneous permissions may need better UX (currently queued, but could be confusing)

## Learning

This bug highlights the importance of:

1. **Testing edge cases** - Permission before message content is a common flow
2. **Conditional rendering logic** - Need to think through all possible states
3. **Observable debugging** - The debug panel made this much easier to diagnose
4. **Event flow understanding** - Understanding the full lifecycle of permission requests

---

**Summary:** Fixed critical bug where permission dialogs weren't rendering due to incorrect conditional logic. Added comprehensive debugging tools and logging to prevent similar issues in the future.

## Session Recovery Fix (Same Session)

While testing the permission fix, discovered another critical bug: **stale session IDs causing "Session not found" errors**.

### Problem

When the app restarts or the ACP adapter restarts, the session ID stored in SQLite becomes invalid. The app would try to reuse it and fail with:

```
Error: Internal error: { "details": "Session not found" }
```

### Solution (manager.rs)

Added automatic session recovery:

1. **Try to reuse cached session** - Attempt prompt with stored session ID
2. **Detect "Session not found" error** - Check if error message contains this string
3. **Clear invalid cache** - Remove stale session ID from memory
4. **Create new session** - Call `new_session()` with current workspace
5. **Retry prompt** - Resend the prompt with new session ID
6. **Update cache** - Store new session ID for future requests

**Code Flow:**

```rust
// Try with cached session (if exists)
let mut prompt_result = conn.prompt(cached_session).await;

// If session not found, recover
if error.contains("Session not found") || session_id.is_none() {
    // Clear stale cache
    *session_id_arc.lock() = None;

    // Create new session
    let session = conn.new_session(...).await?;

    // Retry with new session
    prompt_result = conn.prompt(new_session).await;
}
```

### Impact

- **Before:** App would hang forever on stale sessions
- **After:** App automatically recovers and creates new sessions
- **User Experience:** Seamless - users don't see "Session not found" errors

---

**Summary:** Fixed TWO critical bugs:

1. Permission dialogs not rendering (conditional logic bug)
2. Session recovery not working (stale session IDs)

Both were completely blocking user workflows with tool operations.
