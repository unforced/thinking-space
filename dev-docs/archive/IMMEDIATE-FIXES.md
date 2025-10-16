# Immediate Fixes Needed

Based on user feedback: "Seems to be some bugginess when trying to use tools; especially around permissions and also with tool calls not showing up in the UI."

## Current Issues

1. **Tool calls not showing in UI** - Tool usage isn't displayed to the user
2. **Permission handling broken** - Permission requests from agent aren't being handled properly

## Fix Strategy: Use Current Manual JSON-RPC

Instead of refactoring to the ACP library (which failed with 43 errors), let's fix these issues in our current working manual implementation.

## Issue 1: Tool Calls Not Showing in UI

### Root Cause
The ACP agent sends `session/update` notifications with tool call information, but:
- We're only translating `AgentMessageChunk` to frontend format
- We're not displaying tool calls in the UI

### Fix Plan
1. ✅ **Parse tool call updates** in `sidecar.rs` message reading thread
2. 📝 **Emit tool call events** to frontend with proper format
3. 🎨 **Create UI component** to display tool calls in chat
4. 🎨 **Show tool status** (Pending, InProgress, Completed, Failed)
5. 🎨 **Display tool input/output**

### Code Locations
- Backend: `src-tauri/src/sidecar.rs` (message translation)
- Frontend: `src/components/Chat.tsx` (display tool calls)

## Issue 2: Permission Handling Broken

### Root Cause
The agent sends `request_permission` requests, but:
- Our current code doesn't have a permission handling flow
- No UI to show permission requests to user
- No way for user to approve/deny

### Fix Plan
1. 📝 **Add permission request handling** in message thread
2. 📝 **Emit permission request events** to frontend
3. 🎨 **Create permission dialog UI component**
4. 📝 **Add Tauri command** for sending permission responses
5. 📝 **Wire up response back to agent**

### Code Locations
- Backend: `src-tauri/src/sidecar.rs` (add `agent_send_permission_response` command)
- Frontend: New `src/components/PermissionDialog.tsx`
- Frontend: `src/components/Chat.tsx` (show permission dialogs)

## Implementation Order

### Step 1: Tool Call Display (Simpler)
Start here because we can display tool calls without user interaction.

1. Update message thread to emit tool-call events
2. Create basic tool call UI component
3. Wire it into Chat component
4. Test with a message that uses tools

### Step 2: Permission Handling (More Complex)
This requires full request/response flow.

1. Add permission request parsing
2. Create permission dialog UI
3. Add Tauri command for responses
4. Wire up complete flow
5. Test with tool that requires permission

## Expected Behavior After Fixes

### Tool Calls
User sees in the UI:
```
Assistant: I'll help you with that.

🔧 Searching codebase (In Progress)
   Tool: grep
   Pattern: "getUserData"

🔧 Searching codebase (Completed)
   Tool: grep
   Found 15 matches in 8 files
```

### Permissions
User sees modal dialog:
```
┌─────────────────────────────────────────┐
│ Permission Request                      │
├─────────────────────────────────────────┤
│ Claude wants to:                        │
│ Read file: src/auth.ts                  │
│                                         │
│ [Always Allow] [Allow Once] [Deny]     │
└─────────────────────────────────────────┘
```

## Testing Checklist

After implementing fixes:

- [ ] Send a message that uses a tool (like grep)
- [ ] Verify tool call appears in UI
- [ ] Verify tool status updates (Pending → InProgress → Completed)
- [ ] Verify tool output is displayed
- [ ] Trigger permission request (file read/write)
- [ ] Verify permission dialog appears
- [ ] Test approving permission
- [ ] Test denying permission
- [ ] Verify agent receives response correctly

## Success Criteria

✅ Tool calls visible in UI with real-time status updates
✅ Tool inputs and outputs displayed clearly
✅ Permission requests show modal dialog
✅ User can approve/deny permissions
✅ Agent receives permission responses and continues correctly
✅ No UI hangs or freezes
✅ Proper error handling for permission denial

## Notes

- Keep using manual JSON-RPC for now
- Don't attempt full ACP library migration yet
- Focus on making the current implementation work properly
- Document any new JSON-RPC message formats we discover
- These fixes set us up for eventual library migration (Phase 2)
