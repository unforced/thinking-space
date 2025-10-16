# Permission Dialog & Tool Call Display Implementation

**Date:** October 16, 2024
**Status:** ✅ Complete - Ready for testing

---

## What We Implemented

### 1. Permission Dialog (CRITICAL)
**Problem Solved:** App was hanging when Claude needed permission to use tools.

**Before:**
```
User: "Read myfile.txt"
→ Backend emits permission-request
→ Frontend logs to console
→ Backend waits forever ⏳
→ App hangs
```

**After:**
```
User: "Read myfile.txt"
→ Backend emits permission-request
→ Frontend shows dialog
→ User clicks "Allow" or "Deny"
→ Backend receives response
→ Operation continues ✓
```

### 2. Tool Call Display
**Problem Solved:** Users couldn't see what Claude was doing.

**Before:**
```
Claude uses Read, Write, Bash tools
→ Backend emits tool-call events
→ Frontend logs to console
→ UI shows nothing
```

**After:**
```
Claude uses Read tool
→ Backend emits tool-call event
→ Frontend displays: "Reading file.txt ✓"
→ Users can see progress in real-time ✓
```

---

## Implementation Details

### Backend Changes

**File:** `src-tauri/src/acp_v2/client.rs`

1. **Added requestId to all events:**
```rust
// In session_notification()
SessionUpdate::AgentMessageChunk { content } => {
    let request_id = self.current_request_id.lock().clone();
    self.emit_event("agent-message-chunk", json!({
        "requestId": request_id,  // ← Added
        "text": text,
    }));
}

SessionUpdate::ToolCall(tool_call) => {
    let request_id = self.current_request_id.lock().clone();
    self.emit_event("tool-call", json!({
        "requestId": request_id,  // ← Added
        "toolCallId": tool_call.id,
        "title": tool_call.title,
        // ... etc
    }));
}

// In request_permission()
let current_request_id = self.current_request_id.lock().clone();
// Add to permission request payload
map.insert("currentRequestId", json!(current_request_id));
```

2. **Permission response already implemented:**
```rust
// Command already existed - just needed UI!
#[tauri::command]
pub fn agent_v2_send_permission_response(
    state: tauri::State<'_, Arc<AcpManager>>,
    response: FrontendPermissionResponse,
) -> Result<(), String> {
    state.send_permission_response(response)
}
```

### Frontend Changes

**File:** `src/src/services/agentService.ts`

1. **Added interfaces:**
```typescript
export interface PermissionRequest {
  request_id: string;
  currentRequestId?: number;
  tool_call_id: string;
  title: string;
  kind: string;
  raw_input: any;
  options: Array<{
    option_id: string;
    name: string;
    kind: string;
  }>;
}

export interface ToolCall {
  requestId?: number;
  toolCallId: string;
  title: string;
  status: string;
  kind: string;
  rawInput: any;
  locations: Array<{ path: string; line?: number }>;
  content?: string;
}
```

2. **Added tracking:**
```typescript
private pendingPermissions = new Map<string, PermissionRequest>();
private activeToolCalls = new Map<string, ToolCall>();

public onPermissionRequest?: (request: PermissionRequest) => void;
public onToolCall?: (toolCall: ToolCall) => void;
public onToolCallUpdate?: (toolCall: ToolCall) => void;
```

3. **Updated event listeners:**
```typescript
listen<PermissionRequest>("permission-request", (event) => {
  const request = event.payload;
  this.pendingPermissions.set(request.request_id, request);

  if (this.onPermissionRequest) {
    this.onPermissionRequest(request);
  }
});

listen<ToolCall>("tool-call", (event) => {
  const toolCall = event.payload;
  this.activeToolCalls.set(toolCall.toolCallId, toolCall);

  if (this.onToolCall) {
    this.onToolCall(toolCall);
  }
});
```

4. **Added response method:**
```typescript
async respondToPermission(
  request_id: string,
  option_id: string | null,
  cancelled: boolean,
): Promise<void> {
  await invoke("agent_v2_send_permission_response", {
    response: { request_id, option_id, cancelled },
  });

  this.pendingPermissions.delete(request_id);
}
```

### UI Components

**File:** `src/src/components/PermissionDialog.tsx`

Beautiful modal dialog with:
- Permission details (title, type, raw input)
- Actionable options (buttons for each option)
- Deny button
- JSON preview of tool input
- Dark mode support

**File:** `src/src/components/ToolCallDisplay.tsx`

Inline tool display with:
- Status indicator (⏳ Running, ✓ Success, ✗ Failed)
- Tool title and kind
- File locations
- Expandable output
- Color-coded by status
- Dark mode support

**File:** `src/src/components/ChatArea.tsx`

Integration:
```typescript
// State
const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
const [toolCalls, setToolCalls] = useState<Map<string, ToolCall>>(new Map());

// Wire up callbacks
useEffect(() => {
  agentService.onPermissionRequest = setPermissionRequest;
  agentService.onToolCall = (tc) => setToolCalls(prev => new Map(prev).set(tc.toolCallId, tc));
  agentService.onToolCallUpdate = (tc) => setToolCalls(prev => new Map(prev).set(tc.toolCallId, tc));
}, []);

// Handlers
const handlePermissionApprove = async (optionId: string) => {
  await agentService.respondToPermission(permissionRequest.request_id, optionId, false);
  setPermissionRequest(null);
};

// Render tool calls
{toolCalls.size > 0 && (
  <div className="mb-3">
    {Array.from(toolCalls.values()).map(tc => (
      <ToolCallDisplay key={tc.toolCallId} toolCall={tc} />
    ))}
  </div>
)}

// Render dialog
<PermissionDialog
  request={permissionRequest}
  onApprove={handlePermissionApprove}
  onDeny={handlePermissionDeny}
/>
```

---

## How It Works Now

### Permission Flow

```
1. User: "Read myfile.txt"
2. Backend: Sends prompt to Claude
3. Claude: Wants to use Read tool
4. Backend: Emits permission-request event
   {
     request_id: "uuid-123",
     currentRequestId: 1,
     title: "Read File",
     options: [{ option_id: "allow", name: "Allow" }]
   }
5. Frontend: Shows PermissionDialog
6. User: Clicks "Allow"
7. Frontend: Calls respondToPermission("uuid-123", "allow", false)
8. Backend: Receives response via agent_v2_send_permission_response
9. Backend: Resolves permission, continues operation
10. Claude: Reads file, returns content ✓
```

### Tool Call Flow

```
1. Claude: Starts using Read tool
2. Backend: Emits tool-call event
   {
     requestId: 1,
     toolCallId: "tool-xyz",
     title: "Reading file.txt",
     status: "Running",
     locations: [{ path: "/path/to/file.txt" }]
   }
3. Frontend: Displays ToolCallDisplay component
   UI shows: "⏳ Reading file.txt"
4. Tool completes
5. Backend: Emits tool-call-update event
   {
     toolCallId: "tool-xyz",
     status: "Success",
     content: "File contents..."
   }
6. Frontend: Updates display
   UI shows: "✓ Reading file.txt" (with expandable output)
```

---

## Testing Guide

### Test Permission Dialog

1. **Start app and send message that needs permission:**
   ```
   "Read the file myfile.txt"
   ```

2. **Expected behavior:**
   - Dialog appears with "Permission Required"
   - Shows tool details (Read File)
   - Shows file path in JSON preview
   - Has "Allow" and "Deny" buttons

3. **Click "Allow":**
   - Dialog closes
   - Operation continues
   - File content appears in chat

4. **Try again and click "Deny":**
   - Dialog closes
   - Operation is cancelled
   - Error message in chat

### Test Tool Call Display

1. **Send message that uses multiple tools:**
   ```
   "Read package.json, then create a summary file"
   ```

2. **Expected behavior:**
   - See "⏳ Reading package.json" while running
   - Changes to "✓ Reading package.json" when complete
   - See "⏳ Writing to summary.txt" for write
   - Changes to "✓ Writing to summary.txt" when done

3. **Check tool details:**
   - Click "Show output" to see file contents
   - See file paths under each tool
   - Status colors match tool state

### Test Multiple Permissions

1. **Send message that needs multiple permissions:**
   ```
   "Read file1.txt and file2.txt, then write summary.txt"
   ```

2. **Expected behavior:**
   - First permission dialog for reading file1.txt
   - After approval, second dialog for file2.txt
   - After approval, third dialog for writing
   - All permissions handled sequentially

---

## Files Modified

### Backend
- `src-tauri/src/acp_v2/client.rs` - Added requestId to events

### Frontend
- `src/src/services/agentService.ts` - Event handling and response method
- `src/src/components/PermissionDialog.tsx` - NEW FILE
- `src/src/components/ToolCallDisplay.tsx` - NEW FILE
- `src/src/components/ChatArea.tsx` - Integration

---

## What's Next (Future Enhancements)

### High Priority
1. **Message queueing** - Type new message while agent is working
2. **Keyboard shortcuts** - Enter to approve, Esc to deny
3. **Remember choices** - "Always allow Read for this session"

### Medium Priority
4. **Tool call grouping** - Collapse multiple similar tools
5. **Progress indicators** - Show percentage for long operations
6. **Tool output preview** - Show first few lines without expanding

### Low Priority
7. **Agent thoughts** - Display what Claude is thinking
8. **Plan display** - Show multi-step plans
9. **Mode indicator** - Show current agent mode
10. **Tool call search** - Filter/search tool history

---

## Summary

We've implemented **critical infrastructure** that was blocking the app:

✅ **Permission dialogs** - No more hanging!
✅ **Tool call displays** - Visibility into what Claude is doing
✅ **Full event flow** - Backend → Frontend → UI → Backend
✅ **Beautiful UI** - Tailwind-styled, dark mode support
✅ **Type-safe** - TypeScript interfaces for all events

The app should now work smoothly with full transparency into Claude's tool usage and proper permission handling.

**Status:** Ready for testing! 🎉
