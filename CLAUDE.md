# Thinking Space - Development Guide

## Purpose

Building a desktop app that makes Claude Agent SDK as approachable as Claude Desktop. A spatial interface for thinking with AI—non-developers should love it.

## Context Management Strategy

**IMPORTANT:** To maintain context and avoid confusion:

1. **At the start of every session:**
   - Read `dev-docs/CURRENT-STATE.md` - complete project state
   - Note what's been completed vs what needs work
   - Ask user what they want to focus on

2. **During long conversations (every ~10-15 exchanges):**
   - Proactively re-read `dev-docs/CURRENT-STATE.md`
   - Verify assumptions are still correct
   - Check if recent changes affect your understanding

3. **Before making significant changes:**
   - Re-read relevant sections of `dev-docs/CURRENT-STATE.md`
   - Check if similar work has been done already
   - Verify you're not duplicating or conflicting with existing code

4. **After completing work:**
   - Update `dev-docs/CURRENT-STATE.md` with changes
   - Mark completed tasks with ✅
   - Update "What Works" and "What Needs Work" sections

## Current State Summary

**Phase:** MVP Development (95% complete)
**Status:** ACP v2 fully integrated, all core UI complete
**See:** `dev-docs/CURRENT-STATE.md` for detailed current state

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

1. **Check `dev-docs/CURRENT-STATE.md`** - See what's built, what's not, priorities
2. **Review related code** - Understand existing patterns
3. **Check Zed's approach** - If implementing similar feature (in `~/Symbols/Codes/zed`)
4. **Verify assumptions** - Don't assume, verify by reading current state

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

**IMPORTANT - Avoid Creating New Markdown Files:**

- ❌ **DON'T** create session summary markdown files in root
- ❌ **DON'T** create new planning documents unless explicitly requested
- ✅ **DO** update existing docs (`CURRENT-STATE.md`, `README.md`)
- ✅ **DO** add inline code comments for complex logic

**After completing work:**

1. Update `dev-docs/CURRENT-STATE.md` - mark completed items, update status
2. Update `README.md` if user-facing feature changed
3. Add inline code comments for complex logic
4. Clean up any temporary notes/files created during work
5. Re-read updated state doc to verify accuracy

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

- **Current state:** `dev-docs/CURRENT-STATE.md` ⭐ READ THIS FIRST (and re-read often)
- **User docs:** `README.md` - getting started, user-facing features
- **Developer docs:** `dev-docs/` - technical deep dives when needed
- **Zed codebase:** `~/Symbols/Codes/zed` (for reference on ACP patterns)

## Pro Tips

- **Lost context?** → Re-read `dev-docs/CURRENT-STATE.md`
- **Unsure what's built?** → Check "What Works" section in CURRENT-STATE.md
- **Don't know what to do next?** → Check "What Needs Work" section
- **Making duplicate work?** → You didn't read CURRENT-STATE.md recently enough 😉

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
