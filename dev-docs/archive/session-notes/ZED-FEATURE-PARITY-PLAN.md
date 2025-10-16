# Zed Feature Parity Implementation Plan

**Date:** October 15, 2024
**Status:** Planning - Ready to implement

---

## Current State

### ✅ What Works
- Message streaming (text chunks display in UI)
- OAuth authentication (Claude Code subscription)
- API key authentication (manual API key)
- Backend emits all necessary events
- Frontend listens for all events
- Basic chat functionality

### ⚠️ What's Missing (High Priority)
1. **Tool call display** - Backend emits, frontend logs, but UI doesn't show
2. **Permission dialogs** - Backend emits, frontend logs, **but doesn't respond** → hangs
3. **Follow-up messages** - Can't type while agent is thinking

### 📋 What's Missing (Lower Priority)
4. Agent thoughts display (we log but don't show)
5. Plan display (we log but don't show)
6. Mode updates (we handle but don't display)

---

## Priority 1: Permission Dialog (CRITICAL)

**Why Critical:** Without this, the app **hangs when tools need approval**.

### Current Flow (Broken)
```
1. User: "Read myfile.txt"
2. Backend: Sends prompt to Claude
3. Claude: Wants to use Read tool
4. Backend: Emits "permission-request" event
5. Frontend: Logs to console, does nothing
6. Backend: Waits forever for response ⏳
7. App: Hangs
```

### Implementation

**Backend Status:** ✅ Already implemented
- Emits `permission-request` event
- Has `agent_v2_send_permission_response` command
- Waits for frontend response via channel

**Frontend Needed:**
```typescript
// In agentService.ts
interface PermissionRequest {
  request_id: string;
  session_id: string;
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

// Store pending permission requests
private pendingPermissions = new Map<string, PermissionRequest>();

// Update listener
listen<PermissionRequest>("permission-request", (event) => {
  const request = event.payload;
  this.pendingPermissions.set(request.request_id, request);

  // Emit to UI layer for dialog
  this.onPermissionRequest?.(request);
});

// Method to respond
async respondToPermission(request_id: string, option_id: string | null, cancelled: boolean) {
  await invoke("agent_v2_send_permission_response", {
    response: {
      request_id,
      option_id,
      cancelled,
    },
  });

  this.pendingPermissions.delete(request_id);
}
```

**UI Component Needed:**
```tsx
// components/PermissionDialog.tsx
interface PermissionDialogProps {
  request: PermissionRequest;
  onApprove: (optionId: string) => void;
  onDeny: () => void;
}

export function PermissionDialog({ request, onApprove, onDeny }: PermissionDialogProps) {
  return (
    <Dialog>
      <DialogTitle>Permission Required</DialogTitle>
      <DialogContent>
        <p>Claude wants to use: <strong>{request.title}</strong></p>
        <pre>{JSON.stringify(request.raw_input, null, 2)}</pre>

        <div>
          {request.options.map(opt => (
            <Button key={opt.option_id} onClick={() => onApprove(opt.option_id)}>
              {opt.name}
            </Button>
          ))}
          <Button onClick={onDeny}>Deny</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Integration in Chat.tsx:**
```tsx
const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);

useEffect(() => {
  agentService.onPermissionRequest = setPermissionRequest;
}, []);

const handlePermissionResponse = async (optionId: string | null, cancelled: boolean) => {
  if (permissionRequest) {
    await agentService.respondToPermission(
      permissionRequest.request_id,
      optionId,
      cancelled
    );
    setPermissionRequest(null);
  }
};

// In render
{permissionRequest && (
  <PermissionDialog
    request={permissionRequest}
    onApprove={(optionId) => handlePermissionResponse(optionId, false)}
    onDeny={() => handlePermissionResponse(null, true)}
  />
)}
```

---

## Priority 2: Tool Call Display

**Why Important:** Users need to see what Claude is doing (transparency).

### Current Flow (Incomplete)
```
1. Claude: Uses Read tool
2. Backend: Emits "tool-call" event
3. Frontend: Logs to console, does nothing
4. UI: Shows nothing
```

### Implementation

**Backend Status:** ✅ Already implemented
- Emits `tool-call` with full details
- Emits `tool-call-update` for status changes

**Data Structure:**
```typescript
interface ToolCall {
  sessionId: string;
  requestId?: number;  // Need to add this
  toolCallId: string;
  title: string;
  status: "Pending" | "Running" | "Success" | "Failed";
  kind: string;
  rawInput: any;
  locations: Array<{ path: string; line?: number }>;
  content?: string;  // From updates
}
```

**Frontend Needed:**
```typescript
// In agentService.ts
private activeToolCalls = new Map<string, ToolCall>();

listen<ToolCall>("tool-call", (event) => {
  const toolCall = event.payload;
  this.activeToolCalls.set(toolCall.toolCallId, toolCall);

  // Emit to UI
  this.onToolCall?.(toolCall);
});

listen<{ toolCallId: string; status?: string; content?: string }>(
  "tool-call-update",
  (event) => {
    const { toolCallId, status, content } = event.payload;
    const toolCall = this.activeToolCalls.get(toolCallId);

    if (toolCall) {
      if (status) toolCall.status = status;
      if (content) toolCall.content = content;

      this.onToolCallUpdate?.(toolCall);
    }
  }
);
```

**UI Component Needed:**
```tsx
// components/ToolCallDisplay.tsx
interface ToolCallDisplayProps {
  toolCall: ToolCall;
}

export function ToolCallDisplay({ toolCall }: ToolCallDisplayProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Running": return "⏳";
      case "Success": return "✓";
      case "Failed": return "✗";
      default: return "○";
    }
  };

  return (
    <div className="tool-call">
      <div className="tool-call-header">
        <span className="status-icon">{getStatusIcon(toolCall.status)}</span>
        <span className="tool-title">{toolCall.title}</span>
      </div>

      {toolCall.locations.map(loc => (
        <div key={loc.path} className="tool-location">
          📄 {loc.path}{loc.line ? `:${loc.line}` : ''}
        </div>
      ))}

      {toolCall.content && (
        <pre className="tool-output">{toolCall.content}</pre>
      )}
    </div>
  );
}
```

**Integration in Chat.tsx:**
```tsx
const [toolCalls, setToolCalls] = useState<Map<string, ToolCall>>(new Map());

useEffect(() => {
  agentService.onToolCall = (toolCall) => {
    setToolCalls(prev => new Map(prev).set(toolCall.toolCallId, toolCall));
  };

  agentService.onToolCallUpdate = (toolCall) => {
    setToolCalls(prev => new Map(prev).set(toolCall.toolCallId, toolCall));
  };
}, []);

// In message rendering
<div className="message assistant">
  <div className="message-text">{message.content}</div>
  {Array.from(toolCalls.values()).map(tc => (
    <ToolCallDisplay key={tc.toolCallId} toolCall={tc} />
  ))}
</div>
```

---

## Priority 3: Follow-up Messages (Queued Prompts)

**Why Important:** Better UX - Zed's killer feature for rapid iteration.

### Zed's Behavior
```
User: "Create a todo app"
[Agent starts working]
User: "Use TypeScript" (types while agent is working)
[Agent finishes first task]
[Agent automatically starts second task with context from first]
```

### Implementation Strategy

**Option A: Queue on Frontend**
```typescript
// In agentService.ts
private messageQueue: Array<{message: string, options: SendMessageOptions}> = [];
private isProcessing = false;

async sendMessage(message: string, options: SendMessageOptions) {
  // Add to queue
  this.messageQueue.push({ message, options });

  // Process queue if not already processing
  if (!this.isProcessing) {
    await this.processQueue();
  }
}

private async processQueue() {
  this.isProcessing = true;

  while (this.messageQueue.length > 0) {
    const { message, options } = this.messageQueue.shift()!;

    // Send message and wait for completion
    await this.sendMessageInternal(message, options);
  }

  this.isProcessing = false;
}
```

**Option B: ACP's Built-in Support**

ACP has a concept of "follow-up prompts" that we should investigate. The protocol might handle this for us.

**UI Changes:**
```tsx
// Chat.tsx - Allow input while processing
const [isProcessing, setIsProcessing] = useState(false);
const [queuedMessages, setQueuedMessages] = useState<number>(0);

const handleSendMessage = async (message: string) => {
  if (isProcessing) {
    setQueuedMessages(prev => prev + 1);
  }

  await agentService.sendMessage(message, options);
};

// Show queue indicator
{queuedMessages > 0 && (
  <div className="queue-indicator">
    {queuedMessages} message{queuedMessages > 1 ? 's' : ''} queued
  </div>
)}
```

---

## Additional Features (Lower Priority)

### 4. Agent Thoughts Display

**Status:** Backend emits, frontend ignores

```rust
SessionUpdate::AgentThoughtChunk { .. } => {
    println!("[ACP V2] Agent thought chunk (not displayed)");
}
```

**Implementation:**
Similar to message chunks, but display in a different style (greyed out, italic, collapsible).

### 5. Plan Display

**Status:** Backend emits, frontend ignores

```rust
SessionUpdate::Plan(_) => {
    println!("[ACP V2] Plan update (not displayed)");
}
```

**Implementation:**
Show as a collapsible "Plan" section with steps/tasks.

### 6. Mode Updates

**Status:** Backend emits, frontend ignores

```rust
SessionUpdate::CurrentModeUpdate { current_mode_id } => {
    println!("[ACP V2] Mode update: {}", current_mode_id);
}
```

**Implementation:**
Show current mode in UI header (e.g., "Agent Mode: Code")

---

## Implementation Order

### Phase 1: Critical (This Session)
1. ✅ Fix requestId in tool-call events (add like we did for chunks)
2. 🔨 **Implement Permission Dialog** (most critical - app hangs without it)
3. 🔨 **Implement Tool Call Display** (transparency, debugging)

### Phase 2: User Experience (Next Session)
4. Implement Follow-up Message Queue
5. Polish permission dialog (keyboard shortcuts, better UI)
6. Add tool call collapsing/expanding

### Phase 3: Advanced (Future)
7. Agent thoughts display
8. Plan display
9. Mode indicator
10. Tool call filtering/search

---

## Quick Wins

### Fix requestId in Tool Events

Just like we did for message chunks, we need to add `requestId` to tool events:

**Backend:**
```rust
// In session_notification
SessionUpdate::ToolCall(tool_call) => {
    let request_id = self.current_request_id.lock().clone();

    self.emit_event(
        "tool-call",
        serde_json::json!({
            "sessionId": session_id,
            "requestId": request_id,  // ← ADD THIS
            "toolCallId": tool_call.id.0.to_string(),
            // ... rest
        }),
    );
}
```

**Frontend:**
```typescript
interface ToolCall {
  sessionId: string;
  requestId?: number;  // ← ADD THIS
  toolCallId: string;
  // ... rest
}
```

This ensures tool calls are associated with the correct request/message.

---

## Testing Plan

### Permission Dialog
- [ ] Send message that needs file permission
- [ ] Dialog appears
- [ ] Click "Allow" → operation continues
- [ ] Click "Deny" → operation cancels gracefully
- [ ] Multiple permissions in sequence work

### Tool Call Display
- [ ] Send message that uses tools
- [ ] Tool calls appear in UI
- [ ] Status updates (Running → Success)
- [ ] Tool output displays
- [ ] Multiple tools work

### Follow-up Messages
- [ ] Send message, agent starts working
- [ ] Send another message before first completes
- [ ] Queue indicator shows
- [ ] Second message processes after first
- [ ] Context from first message is preserved

---

## Files to Modify

### Phase 1 (Critical)

**Backend:**
- `src-tauri/src/acp_v2/client.rs` - Add requestId to tool events

**Frontend:**
- `src/src/services/agentService.ts` - Add permission response method, tool call tracking
- `src/src/components/PermissionDialog.tsx` - NEW FILE
- `src/src/components/ToolCallDisplay.tsx` - NEW FILE
- `src/src/components/Chat.tsx` - Integrate dialog and tool display

**Styling:**
- `src/src/styles/` - Add styles for dialog and tool displays

---

## Summary

We have a **solid foundation** - all the backend infrastructure is in place. We just need to:

1. **CRITICAL:** Add permission dialog so app doesn't hang
2. **Important:** Display tool calls for transparency
3. **Nice:** Add message queueing for Zed-like UX

The backend is already emitting everything we need. It's mostly frontend/UI work now.

**Next Action:** Start with permission dialog - it's the most critical since the app hangs without it.
