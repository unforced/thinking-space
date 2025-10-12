# Thinking Space

## Purpose
Building a desktop app that makes Claude Agent SDK as approachable as Claude Desktop. A spatial interface for thinking with AI—non-developers should love it.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Tauri 2 + Rust
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Agent**: Claude Agent SDK (Node.js sidecar)
- **Database**: SQLite

## Project Structure
```
dev-docs/          Design docs and research
src/               React frontend
src-tauri/         Rust backend
```

## Development Guidelines
- Keep it simple—defer features aggressively
- Non-developers are the primary users
- Every Space needs a CLAUDE.md
- Follow the MVP scope in dev-docs/03-mvp-scope.md
- UI should feel as polished as Claude Desktop

## Current Phase
Setting up the project foundation. See dev-docs/README.md for full context.
