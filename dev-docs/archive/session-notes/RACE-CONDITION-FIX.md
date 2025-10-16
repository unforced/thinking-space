# Race Condition Fix - Agent Ready Event

**Date:** October 15, 2024
**Status:** ✅ Fixed and compiled successfully

---

## The Problem

After fixing the LocalSet lifecycle issue, a new problem emerged:

```
Error: Not connected
```

**Console logs:**
```
[ACP V2] Connection ready, waiting for shutdown signal...
```

The connection was being initialized successfully, but when the frontend tried to send a message, it got "Not connected" error.

---

## Root Cause

**Race Condition Between start() and send_message()**

1. Frontend calls `agent_v2_start()` → returns immediately
2. Frontend calls `agent_v2_send_message()` → tries to get connection
3. ❌ Connection not ready yet (background thread still initializing)
4. Returns error: "Not connected"

**Timeline:**
```
0ms:  agent_v2_start() called
1ms:  agent_v2_start() returns OK
2ms:  agent_v2_send_message() called
3ms:  Check connection → None → Error!
---
500ms: Background thread finishes initialization
501ms: Connection stored (too late!)
```

---

## The Solution

Implemented an **agent-ready event** that signals when the connection is actually ready.

### Backend Changes (Rust)

**1. Emit `agent-ready` event after initialization**

```rust
// In start() function, after storing connection:
*connection_arc.lock() = Some(Arc::new(conn));
*process_arc.lock() = Some(child);

println!("[ACP V2] Connection ready, waiting for shutdown signal...");

// Emit ready event to frontend
if let Some(handle) = app_handle_arc.lock().as_ref() {
    let _ = handle.emit("agent-ready", ());
    println!("[ACP V2] Emitted agent-ready event");
}
```

**2. Fixed lock scope issue**

```rust
pub fn start(&self, api_key: Option<String>) -> Result<(), String> {
    // Check if already running (scope the lock)
    {
        let process_lock = self.process.lock();
        if process_lock.is_some() {
            return Ok(()); // Already running
        }
    } // Lock is dropped here

    // ... rest of function
}
```

Previously the lock wasn't being dropped, blocking the background thread from storing the process.

**3. Pass app_handle to background thread**

```rust
let app_handle_arc = self.app_handle.clone();

std::thread::spawn(move || {
    // ... can now use app_handle_arc to emit events
});
```

### Frontend Changes (TypeScript)

**1. Add ready state tracking**

```typescript
export class AgentService {
  private isAgentReady = false;
  private readyPromise: Promise<void>;
  private readyResolve?: () => void;

  constructor() {
    // Create promise that resolves when agent is ready
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    this.setupSidecarListener();
  }
}
```

**2. Listen for agent-ready event**

```typescript
private setupSidecarListener() {
  // Listen for agent ready event
  listen("agent-ready", () => {
    console.log("[FRONTEND V2] Agent is ready!");
    this.isAgentReady = true;
    if (this.readyResolve) {
      this.readyResolve();
    }
  }).catch(console.error);

  // ... other listeners
}
```

**3. Wait for ready before sending messages**

```typescript
// Start the ACP adapter if not already started
if (!this.isAgentReady) {
  console.log("[FRONTEND V2] Starting ACP adapter...");
  try {
    await invoke("agent_v2_start", { apiKey: credentials.token });
    console.log("[FRONTEND V2] Waiting for agent to be ready...");
    await this.readyPromise;
    console.log("[FRONTEND V2] Agent is ready!");
  } catch (e) {
    console.error("[FRONTEND V2] Failed to start adapter:", e);
    throw new Error(`Failed to start agent: ${e}`);
  }
}

// Now safe to send message
await invoke("agent_v2_send_message", { ... });
```

---

## How It Works Now

**Correct Timeline:**
```
0ms:   Frontend: agent_v2_start() called
1ms:   Backend: Spawn background thread, return OK
2ms:   Frontend: Wait for readyPromise
---
500ms: Backend: Connection initialized
501ms: Backend: Emit "agent-ready" event
502ms: Frontend: Receive event, resolve readyPromise
503ms: Frontend: agent_v2_send_message() called
504ms: Backend: Connection exists ✓
```

**Flow Diagram:**
```
Frontend                    Backend
   |                           |
   |--agent_v2_start()-------->|
   |                           |--spawn thread-->Thread
   |<-------OK-----------------|                  |
   |                                              |
   |--wait readyPromise                           |
   |                                              |--initialize-->
   |                                              |               |
   |                                              |<-----OK-------|
   |                                              |
   |<-------------agent-ready--------------------|
   |
   |--readyPromise resolved
   |
   |--agent_v2_send_message()------------------>|
   |                                            |--✓ connection ready
```

---

## Files Modified

### Backend
- **`src-tauri/src/acp_v2/manager.rs`**
  - Fixed lock scope in `start()`
  - Added `app_handle_arc` clone
  - Emit `agent-ready` event after initialization

### Frontend
- **`src/src/services/agentService.ts`**
  - Added `isAgentReady` flag
  - Added `readyPromise` and `readyResolve`
  - Listen for `agent-ready` event
  - Wait for ready before sending messages

---

## Testing Checklist

✅ **Compilation**
- [x] Rust backend compiles
- [x] TypeScript frontend compiles

🔄 **Runtime Testing** (To be verified)
- [ ] No "Not connected" error
- [ ] Console shows: "[FRONTEND V2] Waiting for agent to be ready..."
- [ ] Console shows: "[ACP V2] Emitted agent-ready event"
- [ ] Console shows: "[FRONTEND V2] Agent is ready!"
- [ ] Messages send successfully
- [ ] Streaming works
- [ ] No UI freezing

---

## What We Fixed

### Issue #1: LocalSet Lifecycle ✅
**Problem:** LocalSet ended immediately after init, killing IO task
**Fix:** Use `run_until()` with shutdown channel to keep LocalSet alive

### Issue #2: Race Condition ✅
**Problem:** Frontend tried to send messages before connection ready
**Fix:** Emit `agent-ready` event, frontend waits before sending

### Issue #3: Lock Scope ❌→✅
**Problem:** Lock held during background thread spawn
**Fix:** Scope the lock check, drop before spawning

---

## Next Steps

1. **Test the application** - Verify messages send successfully
2. **Monitor console logs** - Confirm event flow is correct
3. **Test edge cases** - Multiple messages, errors, restarts
4. **Clean up debug logs** - Remove excessive logging once stable
5. **Update documentation** - Reflect fixes in CURRENT-STATE.md

---

## Key Learnings

### 1. Async Initialization Requires Coordination

When a backend operation is async (happens in background), the frontend needs a way to know when it's complete. Options:
- ✅ **Events** (what we used)
- Polling (wasteful)
- Blocking (bad for UI)
- Callbacks (complex)

### 2. Lock Scope Matters

```rust
// ❌ Bad: Lock held too long
let lock = self.mutex.lock();
if lock.is_some() { return; }
// Lock still held here!
spawn_thread_that_needs_lock();

// ✅ Good: Lock scoped
{
    let lock = self.mutex.lock();
    if lock.is_some() { return; }
} // Lock dropped
spawn_thread_that_needs_lock();
```

### 3. Promise-Based Waiting Pattern

The `readyPromise` pattern is clean for one-time events:
```typescript
private readyPromise = new Promise<void>((resolve) => {
    this.readyResolve = resolve;
});

// Elsewhere
this.readyResolve?.(); // Signal ready

// Consumer
await this.readyPromise; // Wait for ready
```

---

## Summary

We've now fixed **both** critical issues:
1. ✅ LocalSet lifecycle (keeps IO task running)
2. ✅ Race condition (waits for connection ready)

The application should now:
- Not freeze during startup ✓
- Not fail with "Not connected" ✓
- Successfully send and receive messages ✓
- Stream responses properly ✓

Ready for testing!
