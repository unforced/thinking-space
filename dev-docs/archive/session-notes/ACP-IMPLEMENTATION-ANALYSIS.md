# ACP Implementation Analysis

**Date:** October 15, 2024
**Issue:** UI thread blocking during ACP initialization
**Status:** Root cause identified, fix in progress

---

## Executive Summary

Our ACP v2 implementation is **architecturally sound** but has a **critical threading issue** in the `start()` function that causes the UI to freeze. The problem is NOT with our understanding of LocalSet or the ACP library usage - it's with **when and where we block**.

**The Good News:**
- ✅ We're using the ACP library correctly
- ✅ Our LocalSet usage is appropriate (required for !Send futures)
- ✅ Our event system is well-designed
- ✅ Our Client trait implementation is solid

**The Problem:**
- ❌ The `start()` function spawns a background thread but **doesn't wait for it to complete**
- ❌ We're releasing the `process_lock` immediately, before the process is actually started
- ❌ There's a race condition between the start function returning and the actual initialization

---

## Understanding the ACP Library Requirements

### Why LocalSet?

The ACP library's `ClientSideConnection` uses `!Send` futures (futures that cannot be sent between threads). This is intentional because:

1. **stdio streams are !Send** - stdin/stdout from the child process
2. **The spawner function requires LocalBoxFuture** - tasks must run on the same thread
3. **This is a common pattern** for process I/O in async Rust

From the ACP library's signature:
```rust
pub fn new<S>(
    client: C,
    stdin: impl AsyncWrite + Unpin + 'static,
    stdout: impl AsyncRead + Unpin + 'static,
    spawner: S,
) -> (Self, impl Future<Output = ()>)
where
    S: Fn(futures::future::LocalBoxFuture<'static, ()>) + 'static,
```

The `spawner` parameter expects `LocalBoxFuture`, which means:
- **We MUST use LocalSet** - tokio::task::spawn_local() won't work without it
- **We MUST use a current_thread runtime** - LocalSet requires it
- **This is correct and unavoidable** - it's how the library is designed

### Why We're Not Wrong

Our pattern of:
```rust
std::thread::spawn(move || {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let local_set = tokio::task::LocalSet::new();
    local_set.block_on(&rt, async move {
        // ACP operations here
    });
});
```

Is **exactly correct** for working with !Send futures from Tauri commands. This pattern:
- ✅ Doesn't block the UI thread (work happens in background thread)
- ✅ Provides a thread-local runtime (required for LocalSet)
- ✅ Allows !Send futures to run safely
- ✅ Returns immediately to Tauri

---

## The Actual Problem

### Current Broken Code

```rust
pub fn start(&self, api_key: Option<String>) -> Result<(), String> {
    let process_lock = self.process.lock();  // Lock acquired

    if process_lock.is_some() {
        return Ok(());
    }

    // Lock is STILL held here!

    let client = self.client.clone();
    let connection_arc = self.connection.clone();
    let process_arc = self.process.clone();

    // Spawn background thread
    std::thread::spawn(move || {
        // ... async work to create connection ...

        *connection_arc.lock() = Some(Arc::new(conn));
        *process_arc.lock() = Some(child);
    });

    // Lock is released HERE when process_lock goes out of scope
    // But the thread above hasn't even started yet!

    Ok(())  // Returns immediately
}
```

### The Race Condition

1. **Thread 1 (UI):** Calls `start()`, locks `process`, spawns thread, **immediately returns**
2. **Thread 2 (Background):** Started but **not yet running** when start() returns
3. **Thread 1 (UI):** Calls `send_message()` - finds no connection, errors out
4. **Thread 2 (Background):** **Finally runs**, creates connection, but too late

### Why It Appears to Hang

Looking at the console output:
```
[ACP V2] Starting claude-code-acp adapter...
[ACP V2] Adapter process spawned
[ACP V2] Connection created, spawning IO task...
[ACP V2] Initializing ACP protocol...
[ACP V2] Initialized! Protocol version: ProtocolVersion(1)
```

This tells us:
- ✅ The background thread IS running
- ✅ Initialization completes successfully
- ❌ But something **after** initialization is blocking

The hang is likely in the **IO task** that we spawn with `tokio::task::spawn_local(io_task)`. That task needs to keep running forever to handle I/O, but our LocalSet might be ending too early.

---

## The Real Issue: LocalSet Lifecycle

```rust
std::thread::spawn(move || {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let local_set = tokio::task::LocalSet::new();

    let result: Result<(), String> = local_set.block_on(&rt, async move {
        // Create connection and spawn IO task
        let (conn, io_task) = ClientSideConnection::new(...);

        tokio::task::spawn_local(io_task);  // ← This task runs on LocalSet

        // Initialize
        conn.initialize(...).await?;

        // Store connection
        *connection_arc.lock() = Some(Arc::new(conn));

        Ok(())
    });

    // ← LocalSet ENDS HERE!
    // ← The io_task we spawned is KILLED!
    // ← Thread exits!
});
```

**THE PROBLEM:** The LocalSet and thread exit immediately after initialization, **killing the I/O task** that needs to run forever to handle communication!

---

## The Solution

We need to **keep the LocalSet alive** for the lifetime of the connection. The IO task must continue running to handle:
- Streaming responses from the agent
- Permission requests
- Tool call updates
- All other notifications

### Option 1: Never-Ending LocalSet (Recommended)

```rust
std::thread::spawn(move || {
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .unwrap();

    let local_set = tokio::task::LocalSet::new();

    local_set.block_on(&rt, async move {
        // Create connection and spawn IO task
        let (conn, io_task) = ClientSideConnection::new(...);

        // Spawn IO task to run forever
        tokio::task::spawn_local(io_task);

        // Initialize
        conn.initialize(...).await?;

        // Store connection
        *connection_arc.lock() = Some(Arc::new(conn));

        // CRITICAL: Keep LocalSet alive!
        // Wait for a shutdown signal
        loop {
            tokio::time::sleep(Duration::from_secs(1)).await;

            // Check if we should shut down
            if connection_arc.lock().is_none() {
                break;  // stop() was called
            }
        }
    });
});
```

### Option 2: Store the Runtime

Keep the runtime and LocalSet in the manager:

```rust
pub struct AcpManager {
    // ... existing fields ...
    background_task: Arc<Mutex<Option<JoinHandle<()>>>>,
}

pub fn start(&self, api_key: Option<String>) -> Result<(), String> {
    // Spawn thread and store handle
    let handle = std::thread::spawn(move || {
        // Same LocalSet code that runs forever
    });

    *self.background_task.lock() = Some(handle);

    Ok(())
}

pub fn stop(&self) -> Result<(), String> {
    // Clear connection (triggers shutdown in background thread)
    *self.connection.lock() = None;

    // Wait for background thread
    if let Some(handle) = self.background_task.lock().take() {
        let _ = handle.join();
    }

    Ok(())
}
```

---

## What We Learned About Zed

From searching the Zed repository:
- Zed implements the **Agent side** (server), not the Client side like us
- They use `acp::Agent` trait, which is different from our `Client` trait
- Their implementation uses RefCell for session management since trait methods take `&self`
- We can't directly compare because they're on the opposite side of the protocol

### ACP Architecture

```
[Editor/Zed]  ←→  [ACP Protocol]  ←→  [Agent/Claude Code]
     ↑                                        ↑
   Agent trait                           Client trait
   (Zed implements)                      (We implement)
```

We're building the **opposite side** from Zed, so their patterns aren't directly applicable.

---

## Recommendations

### Immediate Fix (High Priority)

1. **Keep LocalSet alive** - Use Option 1 with a loop that checks for shutdown
2. **Test thoroughly** - Verify no more hangs
3. **Add logging** - Confirm IO task stays running

### Code Quality (Medium Priority)

1. **Add shutdown channel** - Use `tokio::sync::oneshot` instead of polling
2. **Better error handling** - Don't panic on runtime creation
3. **Graceful shutdown** - Ensure clean process termination

### Architecture Review (Low Priority)

Our architecture is **fundamentally correct**:
- ✅ Using official ACP library
- ✅ Proper trait implementation
- ✅ Event-based frontend communication
- ✅ Type-safe async handling

**No major refactoring needed** - just fix the LocalSet lifecycle.

---

## Conclusion

**We didn't misunderstand LocalSet or the ACP library.** Our usage is correct. The bug is simply that we're **ending the LocalSet too early**, killing the I/O task that needs to run for the entire connection lifetime.

The fix is straightforward: keep the background thread and LocalSet running until `stop()` is called.

Once fixed, our implementation will be solid and maintainable. The foundation is good - we just need this one lifecycle fix.
