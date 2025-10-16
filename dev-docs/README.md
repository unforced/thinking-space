# Developer Documentation

## Start Here

**New to this codebase?** Read these in order:

1. **`/CURRENT-STATE.md`** (in project root) - Overall state, architecture, what works, what doesn't
2. **`ACP-LIBRARY-REFERENCE.md`** - Comprehensive guide to the ACP library API
3. **`ACP-V2-COMPLETE.md`** - Details of our ACP implementation
4. **`/FRONTEND-WIRED-UP.md`** (in project root) - How frontend connects to backend

## Documentation Index

### Current & Active

| File | Purpose | When to Read |
|------|---------|--------------|
| `ACP-LIBRARY-REFERENCE.md` | Complete ACP API reference with examples | When working with ACP code |
| `ACP-V2-COMPLETE.md` | Our ACP implementation details | Understanding the backend |
| `ACP-REFACTOR-LESSONS.md` | What we learned during the rewrite | Understanding design decisions |
| `ideas-for-later.md` | Future feature ideas | Planning new features |

### Archived (Historical Context)

Located in `archive/` - kept for reference but superseded:

- `ACP-REFACTOR-PLAN.md` - Original plan (completed)
- `IMMEDIATE-FIXES.md` - Old fix list (mostly done)
- `ACP-ANALYSIS.md` - Early analysis (replaced by REFERENCE)

## Quick Reference

### ACP Events

Events emitted from backend to frontend:

```typescript
"agent-message-chunk"     // { sessionId, text }
"tool-call"               // { sessionId, toolCallId, title, status, ... }
"tool-call-update"        // { sessionId, toolCallId, status, content }
"permission-request"      // { request_id, tool_call_id, options, ... }
"agent-message-complete"  // { requestId, stopReason }
"agent-message-error"     // { requestId, error }
```

### Tauri Commands

Commands available to frontend:

```rust
agent_v2_start(apiKey)
agent_v2_stop()
agent_v2_send_message(params)
agent_v2_send_permission_response(response)
```

### File Locations

- **Backend ACP:** `src-tauri/src/acp_v2/`
- **Frontend Service:** `src/src/services/agentService.ts`
- **Main Entry:** `src-tauri/src/main.rs`

## Contributing

1. Read `/CURRENT-STATE.md` first
2. Make changes
3. Test with `npm run tauri dev`
4. Update documentation if needed
5. Keep logs clear (use prefixes like `[ACP V2]`)

## Getting Unstuck

**"How does X work?"**
- Check `/CURRENT-STATE.md` first
- Look for logs with relevant prefix
- Read code comments in relevant file
- Check `ACP-LIBRARY-REFERENCE.md` for ACP specifics

**"The code doesn't compile"**
- Run `cd src-tauri && cargo check` for detailed errors
- Check if all dependencies are installed
- Look for import/module issues

**"The app doesn't do what I expect"**
- Check browser console (frontend logs)
- Check Tauri console (Rust logs)
- Look for `[ACP V2]` or `[FRONTEND V2]` logs
- Verify events are being emitted/received

## Key Concepts

### LocalSet Pattern (Rust)

The ACP library uses !Send futures, requiring special handling:

```rust
std::thread::spawn(move || {
    runtime.block_on(async move {
        let local_set = tokio::task::LocalSet::new();
        local_set.run_until(async move {
            // ACP operations here
        }).await
    })
});
```

### Event-Based Communication

Backend emits events → Frontend listens → UI updates

No direct request/response cycle for streaming.

### Session Management

Sessions persist across messages. One session = one conversation context.

## Maintenance

### When ACP Library Updates

1. Update version in `Cargo.toml`
2. Run `cargo update`
3. Check for breaking changes in types
4. Test basic flow
5. Update `ACP-LIBRARY-REFERENCE.md` if needed

### When Adding Features

1. Start with the architecture (which layer?)
2. Backend changes go in `acp_v2/`
3. Frontend changes go in `services/` or `components/`
4. Update `/CURRENT-STATE.md` "What Works" section
5. Add events if needed
6. Document in code comments

## Resources

- **ACP Protocol Docs:** https://agentclientprotocol.com/
- **Tauri Docs:** https://tauri.app/
- **Rust Async Book:** https://rust-lang.github.io/async-book/
- **Our Codebase:** Start with `/CURRENT-STATE.md`
