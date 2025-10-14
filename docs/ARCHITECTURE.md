# Thinking Space - Technical Architecture

## Overview

Thinking Space is a Tauri-based desktop application that wraps the Claude Agent SDK with a spatial, user-friendly interface. It bridges the gap between Claude Desktop's simplicity and Claude Code's power.

## High-Level Architecture

```
┌─────────────────────────────────────────────────┐
│           Frontend (React + TypeScript)          │
│  ┌──────────────┐  ┌───────────────────────┐   │
│  │   UI Layer   │  │   State Management    │   │
│  │ - Spaces UI  │  │   - Spaces Store      │   │
│  │ - Chat UI    │  │   - Chat Store        │   │
│  │ - Editor UI  │  │   - Settings Store    │   │
│  └──────────────┘  └───────────────────────┘   │
└─────────────────────────────────────────────────┘
                      ▲ ▼ (IPC)
┌─────────────────────────────────────────────────┐
│            Backend (Rust + Tauri)               │
│  ┌─────────────┐  ┌────────────────────────┐   │
│  │  Commands   │  │  Claude Agent SDK      │   │
│  │  - Spaces   │  │  - Session Manager     │   │
│  │  - Files    │  │  - Tool Handlers       │   │
│  │  - Settings │  │  - MCP Integration     │   │
│  └─────────────┘  └────────────────────────┘   │
│                                                  │
│  ┌──────────────────────────────────────────┐  │
│  │         File System                      │  │
│  │  ~/.thinking-space/                      │  │
│  │    ├── spaces/                           │  │
│  │    ├── config.json                       │  │
│  │    └── .claude/ (SDK working dir)        │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand (lightweight, simple)
- **Markdown**: react-markdown with syntax highlighting
- **Animations**: Framer Motion (subtle, performant)

**Rationale**: Modern, fast, familiar stack. shadcn/ui gives us Claude Desktop aesthetic without heavy dependencies.

### Backend
- **Framework**: Tauri 2
- **Language**: Rust
- **Agent SDK**: Claude Agent SDK (TypeScript/Node.js version, invoked via Tauri)
- **Database**: SQLite (via rusqlite) for metadata
- **File System**: Native Rust std::fs

**Rationale**: Tauri gives us native performance, small bundle size, and security. Rust for backend provides speed and safety.

### Agent Integration Approach

Since Claude Agent SDK is TypeScript/Node.js based and Tauri is Rust-based, we have two options:

**Option A: Node.js Sidecar (Recommended)**
```
Tauri Backend ←→ Node.js Sidecar ←→ Claude Agent SDK
              IPC           Process
```
- Tauri spawns Node.js process with Agent SDK
- Communication via stdin/stdout (JSON-RPC)
- Similar to how Zed integrates external agents
- Cleaner separation of concerns

**Option B: Direct TypeScript in Frontend**
```
Frontend (TypeScript) → Claude Agent SDK
                     ↓
                  Tauri Commands (for FS access)
```
- Agent SDK runs in frontend renderer process
- Call Tauri commands for privileged operations
- Simpler architecture but tighter coupling

**Recommendation**: Start with Option A for cleaner architecture and better alignment with ACP patterns.

## Core Abstractions

### 1. Space

A Space represents a context for thinking and working.

```typescript
interface Space {
  id: string;              // UUID
  name: string;            // User-facing name
  path: string;            // Absolute filesystem path
  claudeMdPath: string;    // Path to CLAUDE.md
  createdAt: Date;
  lastAccessedAt: Date;
  metadata: {
    template?: string;     // Template used to create
    tags?: string[];       // Optional tags (future)
  };
}
```

**Filesystem representation:**
```
~/.thinking-space/spaces/
└── {space-id}/
    ├── CLAUDE.md
    ├── .space-metadata.json
    └── [user files]
```

### 2. Session

A Session represents an active conversation with Claude within a Space.

```typescript
interface Session {
  id: string;
  spaceId: string;
  messages: Message[];
  agentState: AgentState;  // From Claude Agent SDK
  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    toolCalls?: ToolCall[];
    files?: string[];
  };
}
```

**Storage**: SQLite database for sessions, with message content and metadata.

### 3. CLAUDE.md Manager

Handles reading, writing, and templating of CLAUDE.md files.

```typescript
interface ClaudeMdManager {
  read(spacePath: string): Promise<string>;
  write(spacePath: string, content: string): Promise<void>;
  applyTemplate(template: Template): string;
  validate(content: string): ValidationResult;
}

interface Template {
  name: string;
  content: string;
  description: string;
}
```

**Built-in templates:**
- `quick-start`: Minimal structure
- `custom`: Blank slate

(More templates in future versions)

## Data Flow

### Creating a Space

```
User clicks "New Space"
  ↓
Frontend shows Space creation dialog
  ↓
User enters name, selects template
  ↓
Frontend → Tauri command: create_space(name, template)
  ↓
Tauri Backend:
  - Generate UUID
  - Create directory: ~/.thinking-space/spaces/{uuid}/
  - Apply template → CLAUDE.md
  - Write .space-metadata.json
  - Insert into SQLite
  ↓
Return Space object to frontend
  ↓
Frontend navigates to new Space
```

### Starting a Conversation

```
User types message in Space
  ↓
Frontend → Tauri command: send_message(spaceId, message)
  ↓
Tauri Backend:
  - Load Space metadata
  - Read CLAUDE.md for context
  - Initialize Agent SDK session (if not exists)
  - Send message to Agent SDK
  ↓
Agent SDK processes (with access to Space files)
  ↓
Stream response back to frontend
  ↓
Frontend updates UI in real-time
  ↓
Store message in SQLite
```

### File Operations

```
Claude wants to read/write files
  ↓
Agent SDK tool call → Tauri permission check
  ↓
If within Space directory: Allow
If outside: Prompt user for permission
  ↓
Execute file operation
  ↓
Return result to Agent SDK
```

## File System Structure

```
~/.thinking-space/
├── config.json                    # App-level settings
├── spaces/                        # All Spaces
│   ├── {space-id-1}/
│   │   ├── CLAUDE.md
│   │   ├── .space-metadata.json
│   │   └── [user files]
│   └── {space-id-2}/
│       └── ...
├── templates/                     # Built-in templates
│   ├── quick-start.md
│   └── custom.md
├── sessions.db                    # SQLite database
└── .claude/                       # Agent SDK working directory
    └── [SDK internal files]
```

## Security & Permissions

### File System Access

- **Space Directory**: Full read/write within `~/.thinking-space/spaces/{space-id}/`
- **Outside Space**: Require explicit user permission per file/directory
- **System Files**: Never allow access to sensitive system locations

### Agent SDK Sandboxing

- Each Space session is isolated
- Tools can only access permitted directories
- Network access controlled via settings

### User Consent Flow

```rust
enum PermissionScope {
    SpaceLocal,           // Within current Space
    ExplicitPath(PathBuf), // User-approved external path
    Denied,
}

fn check_file_permission(
    space_id: &str,
    requested_path: &Path
) -> Result<PermissionScope> {
    if is_within_space(space_id, requested_path) {
        Ok(PermissionScope::SpaceLocal)
    } else {
        // Show permission dialog to user
        request_permission_from_user(requested_path)
    }
}
```

## Agent SDK Integration Details

### Session Management

```typescript
// Simplified Agent SDK wrapper
class AgentSessionManager {
  private sessions: Map<string, AgentSession>;

  async createSession(spaceId: string): Promise<AgentSession> {
    const space = await loadSpace(spaceId);
    const claudeMd = await readClaudeMd(space.path);

    const session = new AgentSession({
      workingDirectory: space.path,
      systemPrompt: claudeMd,
      tools: getEnabledTools(),
    });

    this.sessions.set(spaceId, session);
    return session;
  }

  async sendMessage(
    spaceId: string,
    message: string
  ): AsyncIterator<StreamChunk> {
    const session = this.sessions.get(spaceId);
    return session.sendMessage(message);
  }
}
```

### Tool Handlers

```typescript
const tools = {
  read_file: async (path: string) => {
    await checkPermission(path);
    return await fs.readFile(path, 'utf-8');
  },

  write_file: async (path: string, content: string) => {
    await checkPermission(path);
    return await fs.writeFile(path, content);
  },

  list_directory: async (path: string) => {
    await checkPermission(path);
    return await fs.readdir(path);
  },

  // More tools as needed
};
```

## State Management

### Frontend State (Zustand)

```typescript
// Spaces Store
interface SpacesState {
  spaces: Space[];
  currentSpace: Space | null;
  loading: boolean;

  loadSpaces: () => Promise<void>;
  createSpace: (name: string, template: string) => Promise<Space>;
  selectSpace: (id: string) => void;
  deleteSpace: (id: string) => Promise<void>;
}

// Chat Store
interface ChatState {
  messages: Message[];
  streaming: boolean;

  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

// Settings Store
interface SettingsState {
  apiKey: string;
  theme: 'light' | 'dark';

  updateSettings: (settings: Partial<Settings>) => Promise<void>;
}
```

### Backend State (Rust)

```rust
// App State (managed by Tauri)
struct AppState {
    db: Arc<Mutex<Database>>,
    config: Arc<RwLock<Config>>,
    agent_manager: Arc<AgentSessionManager>,
}

// Passed to all command handlers
impl AppState {
    fn new() -> Result<Self> {
        // Initialize on app startup
    }
}
```

## Database Schema

```sql
-- Spaces metadata
CREATE TABLE spaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_accessed_at INTEGER NOT NULL,
    metadata TEXT -- JSON
);

-- Sessions
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    space_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY (space_id) REFERENCES spaces(id)
);

-- Messages
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    metadata TEXT, -- JSON for tool calls, files, etc.
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Indexes for performance
CREATE INDEX idx_sessions_space ON sessions(space_id);
CREATE INDEX idx_messages_session ON messages(session_id);
```

## Performance Considerations

### Message Streaming

- Use Server-Sent Events (SSE) or WebSocket for real-time updates
- Chunk large responses for smooth rendering
- Debounce UI updates to prevent jank

### File Operations

- Read/write files asynchronously
- Cache CLAUDE.md in memory per session
- Use file watchers for external changes

### Database Queries

- Index frequently queried fields
- Use prepared statements
- Batch writes where possible

## Error Handling

```typescript
// Frontend error boundary
class ErrorBoundary extends React.Component {
  // Catch React errors
}

// Backend error types
enum AppError {
    SpaceNotFound,
    InvalidClaudeMd,
    PermissionDenied,
    AgentError(String),
    FileSystemError(std::io::Error),
}

// Graceful degradation
- If Agent SDK fails: Show error, allow retry
- If file operation fails: Show error, suggest alternatives
- If database fails: Try to continue with in-memory state
```

## Testing Strategy

### Frontend
- **Unit tests**: Component logic with Jest
- **Integration tests**: User flows with React Testing Library
- **E2E tests**: Critical paths with Playwright

### Backend
- **Unit tests**: Rust functions with #[test]
- **Integration tests**: Tauri commands with tauri::test
- **File system tests**: Temporary directories for isolation

### Agent Integration
- **Mock Agent SDK** for frontend/backend tests
- **Real Agent SDK** for E2E validation
- **Snapshot tests** for CLAUDE.md templates

## Build & Deployment

### Development
```bash
# Install dependencies
npm install
cd src-tauri && cargo build

# Run dev server
npm run tauri dev
```

### Production
```bash
# Build for current platform
npm run tauri build

# Outputs:
# - macOS: .app, .dmg
# - Windows: .msi, .exe
# - Linux: .deb, .AppImage
```

### Distribution
- GitHub Releases for initial distribution
- Auto-update via Tauri updater (future)
- Platform-specific installers

## Future Considerations

### ACP Integration
- Current: Direct Agent SDK integration
- Future: Full ACP protocol support for agent swapping
- Benefit: Use Gemini CLI, other agents alongside Claude

### Sync & Backup
- Current: Local-only
- Future: Optional cloud backup/sync
- Consider: Encrypted sync to user's own storage (S3, Dropbox, etc.)

### Collaboration
- Current: Single-user
- Future: Share Spaces, collaborative editing
- Challenge: Conflict resolution, permissions

### Mobile
- Current: Desktop-only
- Future: Mobile companion app (read-only or simplified)
- Consider: Tauri mobile support or separate React Native app

---

This architecture prioritizes simplicity, security, and extensibility while providing a solid foundation for the MVP and future enhancements.
