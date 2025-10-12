# Research Findings

This document captures key insights from research conducted on similar projects, protocols, and approaches that informed the design of Thinking Space.

## Agent Context Protocol (ACP)

### What It Is
- Open protocol for connecting editors to AI coding agents
- Similar in purpose to LSP (Language Server Protocol), but for AI agents
- Developed by Zed + Google (Gemini team)
- Uses JSON-RPC over stdio for communication
- Reuses Model Context Protocol (MCP) specs where applicable

### Why It Matters
- Enables any editor to work with any agent
- Growing ecosystem (Zed, Neovim, Emacs, JetBrains)
- Multiple agents available (Claude Code, Gemini CLI, Goose)
- Mature, well-documented protocol

### For Thinking Space
- **MVP**: Direct Claude Agent SDK integration (simpler)
- **Future**: Full ACP support for multi-agent workflows
- **Benefit**: Users could switch between Claude, Gemini, custom agents

**Key Insight**: The industry is standardizing on agent protocols. We should design to accommodate this even if we start simpler.

## Zed's Integration

### Architecture
- Rust-based editor with ACP integration
- `acp_tools` crate handles protocol communication
- Agent panel for chat-style interaction
- Automatic agent installation and version management
- Debug logs view for protocol inspection

### What They Got Right
- Clean separation between editor and agent
- Transparent protocol communication
- Managed installations (users don't manually set up)
- Debug tooling for developers

### What We Can Learn
- Node.js sidecar pattern for Agent SDK integration
- Automatic installation/updates
- Clear permission model
- Protocol streaming for real-time updates

**Key Insight**: Wrapping complex tools (like Agent SDK) in managed installations reduces friction dramatically.

## Opcode

### What It Is
- Tauri-based GUI for Claude Code
- Project & session management
- Custom agent creation
- Usage analytics and cost tracking
- Timeline/checkpoint system

### Tech Stack
- Tauri 2 + React + TypeScript
- shadcn/ui for components
- SQLite for data
- Zustand for state

### What They Got Right
- Beautiful, modern UI
- Comprehensive feature set
- Good developer experience
- Strong project organization

### What We Can Learn
- Tauri + shadcn/ui is a solid stack
- SQLite works well for metadata
- Usage tracking is valuable
- Visual timeline is powerful

### Where We'll Differ
- Simpler, less feature-heavy
- Focus on non-developers
- Spatial metaphor (Spaces) vs projects
- No custom agents at first

**Key Insight**: Feature-rich is good, but simple and focused might be better for non-developer adoption.

## Claude Desktop vs Claude Code

### Claude Desktop Strengths
- Beautiful, clean interface
- Zero learning curve
- No setup beyond API key
- Feels "safe" and familiar
- MCP server support

### Claude Desktop Limitations
- File size limits
- No local file system access
- Limited context (relative to what's possible)
- Resets between sessions
- Like a "hotel room" - clean but temporary

### Claude Code Strengths
- Full local file access
- No file size limits
- Persistent memory via CLAUDE.md
- Custom slash commands
- Hooks for automation
- Subagents for complex workflows
- Like "your apartment" - persistent and customizable

### Claude Code Barriers
- CLI interface intimidates non-developers
- Terminal knowledge required
- File organization becomes chaotic
- No visual interface
- Steeper learning curve

**Key Insight**: People want Claude Code's power with Claude Desktop's approachability. This is our opportunity.

## Non-Developer Use Cases (from Every.to article)

### Real Examples
1. **Expense tracking** (Dan Shipper)
   - Categorize business expenses automatically
   - Generate web reports from CSVs
   - Improve categorization over time

2. **Content analysis** (Katie Parrott)
   - Analyze large engagement datasets
   - Identify reader response patterns
   - Process files too large for cloud

3. **Customer support** (Anushki Mittal)
   - Search codebases for answers
   - Generate support email drafts
   - Create automated responses

4. **Marketing content** (Nityesh Agarwal)
   - Review code changes
   - Generate marketing copy
   - Create newsletter summaries

### Common Patterns
- Work in specific project folders
- Use slash commands for repeated tasks
- Process entire datasets locally
- Generate drafts for manual refinement
- Build up context over time

**Key Insight**: Non-developers are using Claude Code for knowledge work, not coding. They need the power but current interface is blocking adoption.

## Second Brain Systems

### PARA Method (Tiago Forte)
- Projects: Active work with deadlines
- Areas: Ongoing responsibilities
- Resources: Reference material
- Archives: Inactive items

**What We're Taking**: Nothing directly. Too prescriptive for our needs.
**What We're Leaving**: The rigid structure and complex setup.

### Obsidian Approach
- Flexible folder structure
- Optional tags and metadata
- Links between notes
- Emergent organization

**What We're Taking**: Flexibility and emergent organization.

### Notion Approach
- Databases and rigid structure
- Templates and workflows
- All-in-one workspace

**What We're Taking**: Templates for common use cases.
**What We're Leaving**: Rigid database structure.

**Key Insight**: People want some structure but not rigid methodology. Start simple, let organization emerge.

## Extended Mind (Annie Murphy Paul)

### Core Thesis
Our best thinking happens when we engage with:
1. Our bodies (embodied cognition)
2. Our surroundings (situated cognition)
3. Other minds (distributed cognition)

### Spatial Thinking
- Natural environments restore cognitive capacity
- Built environments should support thinking
- Spatial memory is powerful and ancient
- Places trigger recall and enable thought construction

### For Thinking Space
- **Spaces as cognitive environments**: Each Space is a thinking environment
- **Method of loci**: Digital memory palace where location = context
- **Active thinking**: Not just storage, but active thought generation
- **Environmental design**: UI should support thinking, not distract

**Key Insight**: The "Spaces" concept isn't just organization—it's cognitive scaffolding. We're building environments for thought.

## CLAUDE.md Best Practices

### What It Is
- Markdown file with context and instructions for Claude
- Read at session start (prepended to prompts)
- Can be hierarchical (project-level, directory-level, user-level)

### Structure Recommendations
- **Keep it concise**: Uses your token budget every time
- **Be specific**: "Use 2-space indentation" not "format code properly"
- **Use bullet points**: Not long paragraphs
- **Include "Do Not" section**: Forbidden actions
- **Import other files**: `@path/to/file` syntax

### Common Sections
- Tech Stack (for code projects)
- Project Structure
- Commands/Workflows
- Code Style
- Guidelines

### For Thinking Space
- Simpler templates for non-code use cases
- "Purpose" section: What this Space is for
- "Context" section: Background Claude should know
- "Guidelines" section: How Claude should behave here

**Key Insight**: CLAUDE.md is the key to making each Space contextually aware. Good defaults + easy editing = success.

## MCP (Model Context Protocol)

### What It Is
- Anthropic's protocol for connecting AI to external tools/data
- JSON-RPC messages between clients and servers
- Server primitives: Prompts, Resources, Tools
- Client primitives: Roots, Sampling

### How It Relates
- Claude Agent SDK uses MCP for tool access
- Can connect to MCP servers (databases, APIs, etc.)
- Expanding ecosystem of servers

### For Thinking Space
- **MVP**: Agent SDK handles MCP internally
- **Future**: UI for managing MCP servers
- **Benefit**: Connect Spaces to external data sources

**Key Insight**: Don't build custom tool integrations. Let MCP ecosystem handle this.

## Conclusions

### What Makes Thinking Space Different

1. **Spatial organization without rigid methodology**
   - Not PARA, not GTD, just flexible Spaces
   - Structure emerges from use

2. **Non-developer focused from day one**
   - No terminal, no code knowledge required
   - Beautiful UI, simple mental model

3. **Power of Claude Code with simplicity of Claude Desktop**
   - Local file access
   - CLAUDE.md memory
   - But wrapped in approachable interface

4. **Cognitive environment, not just a tool**
   - Based on Extended Mind principles
   - Spaces as thinking places
   - Active thought generation, not just storage

5. **Built to evolve**
   - Start with Agent SDK
   - Add ACP later for multi-agent
   - Extensible through MCP
   - Foundation for future capabilities

### Success Factors

1. **Nail the mental model**: Spaces must make immediate sense
2. **Polish matters**: Must feel as good as Claude Desktop
3. **Context awareness**: CLAUDE.md must noticeably improve responses
4. **Simplicity**: Remove every unnecessary step and concept
5. **Performance**: Must be fast and reliable

### Risks to Watch

1. **Complexity creep**: Easy to add features, hard to stay simple
2. **Technical challenges**: Agent SDK integration could be tricky
3. **Permission UX**: File access prompts could be annoying
4. **Performance**: Streaming/file ops need to be smooth
5. **Adoption**: Will non-developers actually use it?

### Next Steps

1. Validate core concept with prototype
2. Test with non-developers early
3. Iterate on mental model and UX
4. Build solid foundation (don't rush)
5. Launch when simple and delightful

---

**Research conducted**: January 2025
**Primary researcher**: Claude (Sonnet 4.5)
**Research method**: Web search, codebase analysis, documentation review
