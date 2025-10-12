# Thinking Space - Development Documentation

Welcome to the Thinking Space development documentation. These documents capture our vision, technical approach, and initial scope.

## Project Overview

**Thinking Space** is a desktop application that makes the Claude Agent SDK as approachable as Claude Desktop while preserving its power. It's designed as a personal AI workspace—a place to think, remember, and build with AI assistance.

### Core Concept

Instead of treating AI as a chat window, Thinking Space creates a **spatial environment** where:
- Each Space is a context for a specific kind of thinking
- CLAUDE.md files give Claude memory about each Space
- File operations happen naturally within your workspace
- The interface is simple enough for non-developers

### Key Inspiration

- **Extended Mind** (Annie Murphy Paul): Thinking happens in spaces, not just brains
- **Method of Loci**: Spatial memory is powerful; we remember places
- **Claude Code insight**: Local AI with file access is more powerful than cloud chat
- **Claude Desktop UX**: Beautiful, simple, approachable

## Documentation Structure

### [01-vision.md](./01-vision.md)
**The Why and What**

Explains:
- The problem we're solving (Claude Code is powerful but intimidating)
- Our insight (spatial thinking + active memory palaces)
- The solution (Thinking Space as a personal AI operating system)
- Core principles (simplicity, spatial memory, intentionality)
- Success criteria

**Read this first** to understand what we're building and why.

### [02-architecture.md](./02-architecture.md)
**The How**

Covers:
- Technical stack (Tauri, React, Rust, Claude Agent SDK)
- System architecture and data flow
- File system structure
- Security and permissions model
- State management approach
- Integration with Claude Agent SDK

**Read this** to understand the technical implementation.

### [03-mvp-scope.md](./03-mvp-scope.md)
**The What First**

Defines:
- What we build in v1 (MVP)
- What we defer to later versions
- UI mockups and user flows
- Development phases (7 weeks)
- Launch checklist

**Read this** to know what we're building right now.

## Quick Start for Developers

1. **Understand the vision**: Read `01-vision.md`
2. **Review architecture**: Skim `02-architecture.md`
3. **Know the scope**: Study `03-mvp-scope.md`
4. **Set up environment**: (Coming soon: setup instructions)
5. **Start building**: (Coming soon: contribution guide)

## Key Design Decisions

### Why "Thinking Space"?
The name emphasizes this is a **place for thinking**, not just a tool. It's spatial, active, and focused on cognition rather than features.

### Why Spaces instead of PARA?
PARA (Projects, Areas, Resources, Archives) is too prescriptive. "Spaces" are flexible containers that users can organize however they want. Structure emerges from use, not imposed upfront.

### Why Tauri?
- Small bundle size (< 10MB vs 100MB+ for Electron)
- Native performance
- Better security model
- Rust backend for speed and safety
- Still uses web technologies for UI

### Why wrap Agent SDK instead of building on ACP?
For MVP, direct Agent SDK integration is simpler. We can add full ACP support later to enable multi-agent workflows. The architecture is designed to support this evolution.

### Why require CLAUDE.md for every Space?
It prevents the chaos of Claude Code while enabling its power. Every Space has context/instructions, which makes Claude more effective and prevents file sprawl.

## Development Principles

1. **Simple first, powerful later**: Start with the minimum that validates the concept
2. **Non-developers are primary users**: If it requires terminal knowledge, we failed
3. **Spatial metaphors matter**: Leverage human cognition, not fight it
4. **Local first**: Privacy and speed come from local-only data
5. **Polish matters**: This should feel as good as Claude Desktop

## Next Steps

After reading these docs:
1. Set up development environment
2. Build a prototype of Space management
3. Integrate Claude Agent SDK
4. Test with non-developer users early
5. Iterate based on feedback

## Questions?

These documents are living artifacts. As we learn, we'll update them. If something is unclear or you think we should reconsider a decision, let's discuss.

---

**Let's build a better way to think with AI.**
