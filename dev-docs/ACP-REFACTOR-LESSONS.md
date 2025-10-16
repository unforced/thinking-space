# ACP Refactor: Lessons Learned

## What We Tried

We attempted a complete rewrite of the ACP integration to use the official `agent-client-protocol` Rust library instead of our manual JSON-RPC implementation.

## Why It Failed

The complete rewrite approach resulted in **43 compilation errors** because:

1. **Complex API Surface**: The ACP library has many types and patterns that are subtly different from our assumptions
2. **Two-Crate Structure**: Types come from `agent-client-protocol-schema`, not the main `agent-client-protocol` crate
3. **Meta Fields Everywhere**: Most response types require a `meta: Option<Meta>` field we weren't accounting for
4. **Type Wrapping**: Many simple types (String, PathBuf) are wrapped in newtypes (SessionId, PermissionOptionId, etc.)
5. **Spawn Function Complexity**: The library needs a custom spawn function that returns `()` and works with `LocalBoxFuture`, not `tokio::spawn` directly
6. **API Misunderstanding**: We misunderstood the connection creation flow and what methods are available where

## Key Learnings from ACP Library Source

From reading `/Users/unforced/.cargo/registry/src/.../agent-client-protocol-0.4.7/src/rpc_tests.rs`:

1. **Import Types from Schema**:
   ```rust
   use agent_client_protocol_schema::{
       InitializeRequest, InitializeResponse, NewSessionRequest,
       PromptRequest, PromptResponse, SessionNotification, SessionUpdate,
       RequestPermissionRequest, RequestPermissionResponse,
       PermissionOptionId, SessionId, ContentBlock, // etc
   };
   ```

2. **Meta Fields Required**:
   ```rust
   Ok(RequestPermissionResponse {
       outcome,
       meta: None,  // Always needed!
   })
   ```

3. **Newtype Wrappers**:
   - `SessionId` wraps String
   - `PermissionOptionId` wraps String
   - `ProtocolVersion` wraps u32
   - Need `.to_string()` or `.into()` conversions

4. **Client Trait Implementation**:
   ```rust
   #[async_trait::async_trait(?Send)]
   impl Client for MyClient {
       async fn request_permission(&self, args: RequestPermissionRequest)
           -> Result<RequestPermissionResponse, Error> {
           // Agent calls this ON us when it needs permission
       }

       async fn session_notification(&self, args: SessionNotification)
           -> Result<(), Error> {
           // Agent sends us updates via this
       }

       async fn read_text_file(&self, args: ReadTextFileRequest)
           -> Result<ReadTextFileResponse, Error> {
           // Agent asks us to read files
       }
   }
   ```

5. **Connection Creation**:
   ```rust
   let (conn, io_task) = ClientSideConnection::new(
       client,        // impl Client
       stdin,         // AsyncWrite
       stdout,        // AsyncRead
       |fut| {        // Custom spawn that returns ()
           tokio::spawn(fut);
       }
   );

   // Must spawn io_task!
   tokio::spawn(io_task);
   ```

6. **Agent Trait Usage**:
   ```rust
   use agent_client_protocol::Agent;  // Must import trait!

   conn.initialize(InitializeRequest { ... }).await?;
   conn.new_session(NewSessionRequest { ... }).await?;
   conn.prompt(PromptRequest { ... }).await?;
   ```

## Current State

We've **restored the old working code** that uses manual JSON-RPC. The application compiles and should work as it did before the refactor attempt.

## Better Approach: Incremental Migration

Instead of a complete rewrite, we should:

### Phase 1: Fix Immediate Issues (No Library Change)
1. **Fix tool call display** - Add proper parsing and UI for tool calls in current manual implementation
2. **Fix permission flow** - Implement permission UI and response handling with current JSON-RPC
3. **Test and stabilize** - Make sure basic flow works end-to-end

### Phase 2: Add Type Safety (Keep Manual JSON-RPC)
1. **Add schema types** - Import types from `agent-client-protocol-schema`
2. **Replace serde_json::Value** - Use proper typed structs for parsing responses
3. **Better error handling** - Use the Error type from schema

### Phase 3: Gradual Library Adoption
1. **Keep both implementations** - Run old and new side-by-side initially
2. **Feature flag** - Let users opt into new implementation
3. **Migrate one flow at a time**:
   - Start with `initialize`
   - Then `new_session`
   - Then `prompt` with streaming
   - Finally permission handling
4. **Test each migration thoroughly** before proceeding

### Phase 4: Complete Migration
1. **Remove old code** - Once new implementation is stable
2. **Clean up** - Remove manual JSON-RPC handling

## Why This Is Better

1. **Incremental Risk** - Each change is small and testable
2. **Always Working** - Users always have a functioning app
3. **Easier Debugging** - Smaller changes = easier to find bugs
4. **Learn as We Go** - Each phase teaches us more about the library
5. **User Feedback** - Can get feedback on new implementation before fully committing

## Immediate Next Steps

1. ✅ Restore old working code (DONE)
2. 📝 Document this lesson (DONE - this file)
3. 🧪 Test current state - make sure messages work
4. 🛠️ Fix tool call display with current manual implementation
5. 🛠️ Fix permission handling with current manual implementation
6. 📋 Once stable, plan Phase 2 migration

## Files to Reference

- **ACP Test Examples**: `/Users/unforced/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/agent-client-protocol-0.4.7/src/rpc_tests.rs`
- **Library Source**: `/Users/unforced/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/agent-client-protocol-0.4.7/src/`
- **Our Backups**:
  - `src-tauri/src/acp_client.rs.old` (working)
  - `src-tauri/src/sidecar.rs.old` (working)
- **Failed Refactor**: The failed refactor code was overwritten when we restored backups

## Conclusion

**Big Bang rewrites are risky.** Even when we have the "right" approach and understand the destination, trying to get there in one leap often fails. Incremental migration with continuous testing is almost always better.

The good news: we learned a lot about the ACP library structure, and now we know exactly what we need to do. We just need to do it step by step.
