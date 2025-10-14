# Thinking Space - Development Guide

## Purpose

Building a desktop app that makes Claude Agent SDK as approachable as Claude Desktop. A spatial interface for thinking with AI—non-developers should love it.

## Current State

**Phase:** MVP Development (85% complete)
**Status:** Core features working, polish needed
**See:** `docs/STATUS.md` for detailed current state

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Tauri 2 + Rust
- **UI**: Tailwind CSS v3
- **Agent**: Claude Agent SDK (Node.js sidecar)
- **State**: Zustand

## Project Structure

```
docs/               Documentation (living and archived)
├── STATUS.md       👈 CHECK THIS FIRST - current state
├── VISION.md       Product philosophy
├── ARCHITECTURE.md Technical design
└── MVP-SCOPE.md    What we're building

src/               React frontend
├── components/    UI components
├── stores/        State management
└── services/      Agent SDK, auth

src-tauri/         Rust backend
├── src/           Rust source
│   ├── spaces.rs  Space CRUD, file ops
│   ├── auth.rs    OAuth + API keys
│   └── sidecar.rs Agent SDK communication
└── sidecar/       Node.js Agent SDK wrapper
```

## Development Guidelines

### Before Starting Work

1. **Check `docs/STATUS.md`** - See what's built, what's not, priorities
2. **Review related code** - Understand existing patterns
3. **Check Zed's approach** - If implementing similar feature (in `~/Symbols/Codes/zed`)

### When Implementing Features

- Keep it simple—defer complexity
- Non-developers are primary users (no CLI mental model)
- Follow existing patterns (check similar components)
- UI should feel as polished as Claude Desktop
- Update `docs/STATUS.md` when done

### Code Patterns to Follow

**Frontend (React):**

- Zustand for state management
- Tailwind for styling (no inline styles)
- TypeScript strict mode
- Components in `src/components/`
- Services for external communication

**Backend (Rust):**

- Tauri commands for frontend calls
- Error handling with `Result<T, String>`
- File operations in `spaces.rs`
- Keep sidecar communication in `sidecar.rs`

**Sidecar (Node.js):**

- JSON-RPC for Rust ↔ Node communication
- Agent SDK in `agent-server.js`
- Streaming via notifications

### Testing

- Manual testing required for each feature
- Test Space switching, file attachments, streaming
- Check both OAuth and API key auth paths

### Documentation

**After completing work:**

1. Update `docs/STATUS.md` - move item from "Not Built" to "Built"
2. Update README.md if user-facing feature
3. Add inline code comments for complex logic

## Key Concepts

**Spaces** - Contextual environments with independent CLAUDE.md files
**CLAUDE.md** - Per-Space memory/context
**Sidecar** - Node.js process running Agent SDK
**OAuth** - Read from `~/.config/claude-code/` (Zed's pattern)

## Common Tasks

**Add a new Tauri command:**

1. Add function in relevant `src-tauri/src/*.rs` file
2. Add to `invoke_handler!` in `main.rs`
3. Call from frontend with `invoke("command_name", { params })`

**Add a new component:**

1. Create in `src/src/components/YourComponent.tsx`
2. Use existing patterns (check ChatArea.tsx, SpaceList.tsx)
3. Import and use in App.tsx or parent component

**Update state:**

1. Find relevant store in `src/src/stores/`
2. Add action or update existing
3. Call from component with `useStore()`

## Priority Order (When Choosing Work)

1. **Critical MVP gaps** - See STATUS.md "What's Not Built"
2. **Known bugs** - See STATUS.md "Known Issues"
3. **Polish** - Loading states, error handling, UX improvements
4. **Nice to have** - Keyboard shortcuts, optimizations

## References

- **Full status:** `docs/STATUS.md` ⭐ READ THIS FIRST
- **Vision:** `docs/VISION.md`
- **Architecture:** `docs/ARCHITECTURE.md`
- **Scope:** `docs/MVP-SCOPE.md`
- **Zed codebase:** `~/Symbols/Codes/zed` (for reference)

## Quick Commands

```bash
# Run dev mode
npm run tauri dev

# Build production
npm run tauri build

# Frontend only
cd src && npm run build

# Check Rust
cd src-tauri && cargo check
```

---

**Remember:** We're building for _people who want to think with AI_, not just developers. Keep it simple, polished, and approachable.
