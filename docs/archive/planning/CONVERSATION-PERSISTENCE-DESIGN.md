# Conversation Persistence Design

**Date:** October 14, 2025
**Purpose:** Design SQLite-based conversation history storage
**Reference:** Zed's thread_store.rs implementation

---

## 🎯 Goal

Persist conversation history so that:
- Messages survive app restart
- Each Space maintains independent conversation history
- Switching Spaces loads the correct history
- Performance is good (fast load/save)

---

## 📚 What We Learned from Zed

### Zed's Approach
1. **Single SQLite database** at `~/.config/zed/threads.db`
2. **One table: `threads`** with columns:
   - `id TEXT PRIMARY KEY` - Thread identifier
   - `summary TEXT NOT NULL` - Display summary
   - `updated_at TEXT NOT NULL` - Last modified timestamp
   - `data_type TEXT NOT NULL` - "json" or "zstd" (compression)
   - `data BLOB NOT NULL` - Entire thread serialized as JSON blob

3. **Serialization Structure:**
```rust
pub struct SerializedThread {
    pub version: String,
    pub summary: String,
    pub updated_at: DateTime<Utc>,
    pub messages: Vec<SerializedMessage>,
    pub model: Option<String>,
    // ... other metadata
}

pub struct SerializedMessage {
    pub id: MessageId,
    pub role: Role, // User or Assistant
    pub segments: Vec<MessageSegment>, // Text, Thinking, etc.
    pub tool_uses: Vec<ToolUse>,
    pub tool_results: Vec<ToolResult>,
    pub context: String, // File context, etc.
    pub is_hidden: bool,
}
```

### Key Insights
✅ **Store entire conversation as JSON blob** - Simple, flexible, easy versioning
✅ **Use metadata table for list view** - Fast loading of summaries
✅ **Version field for schema evolution** - Can migrate data later
✅ **DateTime as TEXT (ISO 8601)** - SQLite-friendly, human-readable
✅ **Compression optional** - Start with JSON, add zstd later if needed

---

## 🏗️ Our Design

### Database Location
```
~/.thinking-space/conversations.db
```

### Schema

#### Table: `conversations`
```sql
CREATE TABLE IF NOT EXISTS conversations (
    space_id TEXT PRIMARY KEY,
    space_name TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    data BLOB NOT NULL
) STRICT;
```

**Why this schema:**
- `space_id` as PRIMARY KEY - One conversation per Space
- `space_name` for display (denormalized, OK since Spaces don't rename often)
- `updated_at` for sorting/recency
- `message_count` for quick stats without deserializing
- `data` as BLOB for serialized conversation
- `STRICT` for type safety (SQLite 3.37+)

#### Serialized Conversation Structure
```json
{
  "version": "0.1.0",
  "space_id": "uuid-here",
  "messages": [
    {
      "id": "msg-uuid",
      "role": "user",
      "content": "message text",
      "timestamp": 1697234567890,
      "metadata": {
        "files": ["path1", "path2"]
      }
    },
    {
      "id": "msg-uuid-2",
      "role": "assistant",
      "content": "response text",
      "timestamp": 1697234570123,
      "metadata": {}
    }
  ]
}
```

**Simpler than Zed because:**
- We don't need segments (text/thinking) yet
- We don't track tool uses separately (just show in content)
- We don't have model switching per conversation yet
- Can add these later with versioning

---

## 📦 Implementation Plan

### Phase 1: Rust Backend (SQLite)

**File:** `src-tauri/src/conversations.rs` (new file)

```rust
use serde::{Deserialize, Serialize};
use rusqlite::{Connection, params};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub id: String,
    pub role: String, // "user" or "assistant"
    pub content: String,
    pub timestamp: i64,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Conversation {
    pub version: String,
    pub space_id: String,
    pub messages: Vec<Message>,
}

pub struct ConversationStore {
    db_path: PathBuf,
}

impl ConversationStore {
    pub fn new() -> Result<Self, String>;
    pub fn init_database(&self) -> Result<(), String>;
    pub fn save_conversation(&self, space_id: &str, conversation: &Conversation) -> Result<(), String>;
    pub fn load_conversation(&self, space_id: &str) -> Result<Option<Conversation>, String>;
    pub fn delete_conversation(&self, space_id: &str) -> Result<(), String>;
}
```

**Tauri Commands:**
```rust
#[tauri::command]
pub fn save_conversation(space_id: String, messages: Vec<Message>) -> Result<(), String>

#[tauri::command]
pub fn load_conversation(space_id: String) -> Result<Vec<Message>, String>

#[tauri::command]
pub fn clear_conversation(space_id: String) -> Result<(), String>
```

### Phase 2: Frontend Integration

**Update:** `src/src/stores/chatStore.ts`

```typescript
// Add actions
loadMessagesForSpace: async (spaceId: string) => {
  const messages = await invoke<Message[]>("load_conversation", { spaceId });
  set({ messages });
}

saveMessage: async (message: Message, spaceId: string) => {
  // Add to state
  set(state => ({ messages: [...state.messages, message] }));

  // Persist to SQLite
  const allMessages = get().messages;
  await invoke("save_conversation", {
    spaceId,
    messages: allMessages
  });
}
```

**Update:** `src/src/App.tsx` or `SpaceList.tsx`

```typescript
// When Space changes, load its conversation
useEffect(() => {
  if (currentSpace) {
    loadMessagesForSpace(currentSpace.id);
  }
}, [currentSpace?.id]);
```

### Phase 3: Migration (If Needed)

Current state: Messages only in memory
After implementation: Messages in SQLite

**Migration strategy:** None needed! Starting fresh is fine since:
- No users yet (MVP phase)
- Current messages aren't critical (development testing)
- If we want to preserve: could export current state before deploying

---

## 🔄 Key Workflows

### Creating a New Message
1. User types message → `sendMessage()` in chatStore
2. Add user message to state immediately (optimistic update)
3. Call `save_conversation()` to persist
4. Stream assistant response
5. Add assistant message to state
6. Call `save_conversation()` again with updated messages

### Switching Spaces
1. User clicks different Space
2. `currentSpace` changes → useEffect triggers
3. Call `load_conversation(newSpaceId)`
4. Update messages in state
5. UI re-renders with new conversation

### App Restart
1. App launches
2. User selects a Space (or last used Space auto-selected)
3. Call `load_conversation(spaceId)`
4. Messages appear immediately

### Deleting a Space
1. User deletes Space
2. Call `delete_space()` (existing)
3. Also call `clear_conversation(spaceId)` (new)
4. Remove conversation from DB

---

## 🎯 Success Criteria

✅ Messages persist after app restart
✅ Switching Spaces loads correct conversation
✅ No data loss
✅ Fast load times (< 100ms for typical conversations)
✅ Clean separation (each Space independent)

---

## 📊 Performance Considerations

### Pros of Blob Storage
- Simple implementation
- Flexible schema (easy to evolve)
- Fast for typical conversations (< 1000 messages)
- One query to load entire conversation

### Cons & Mitigation
- Large conversations could be slow
  - **Mitigation:** Start simple, optimize later if needed
  - **Alternative:** Pagination (load last N messages first)

- Every message save = rewrite entire blob
  - **Mitigation:** Fine for MVP (conversations aren't that long)
  - **Alternative:** Batch updates, debounce saves

### When to Optimize
Only if:
- Conversations regularly exceed 1000 messages
- Users report slow load times
- Profiling shows DB is bottleneck

Then consider:
- Separate messages table (normalized)
- Pagination
- Compression (zstd like Zed)

---

## 🚀 Implementation Order

1. **Add rusqlite dependency** to Cargo.toml
2. **Create conversations.rs** with ConversationStore
3. **Add Tauri commands** (save, load, clear)
4. **Test in Rust** (unit tests for save/load)
5. **Update chatStore.ts** with persistence calls
6. **Update Space switching** to load conversations
7. **Test end-to-end** (create messages, restart, verify persistence)
8. **Handle edge cases** (empty conversations, deleted Spaces)
9. **Update docs/STATUS.md** to mark complete

---

## 🐛 Edge Cases to Handle

1. **Space with no conversation yet**
   - `load_conversation()` returns empty array
   - UI shows empty state

2. **Corrupted DB file**
   - Catch error, log it
   - Recreate database
   - Notify user (data loss warning)

3. **Version mismatch**
   - Check version field in JSON
   - Migrate if needed (future)
   - For now: v0.1.0 only

4. **Concurrent access**
   - SQLite handles this with locking
   - Single-user app, shouldn't be an issue

5. **Large messages**
   - SQLite BLOB limit: 1GB (plenty)
   - Typical conversation: < 1MB

---

## 📝 Testing Plan

### Manual Tests
1. Create conversation with 10 messages
2. Close app
3. Reopen app
4. Verify all 10 messages present
5. Switch to different Space
6. Verify empty/different conversation
7. Switch back to first Space
8. Verify original 10 messages

### Edge Case Tests
1. Delete Space → verify conversation deleted
2. Create Space with same name → verify new conversation
3. Send 100 messages → verify performance OK
4. Corrupt DB file → verify graceful handling

---

## 🎉 Benefits

✅ **Better UX** - Users can return to previous conversations
✅ **Standard approach** - Following Zed's proven pattern
✅ **Simple to implement** - Blob storage is straightforward
✅ **Easy to evolve** - Version field enables future migrations
✅ **Good performance** - One query per Space load

---

**Next Step:** Implement `src-tauri/src/conversations.rs` with ConversationStore
