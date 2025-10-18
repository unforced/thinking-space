# Missing Features Analysis - Thinking Space vs Zed/Claude Code

**Date:** October 17, 2025
**Status:** Analysis Complete - Recommendations Ready

---

## Executive Summary

We have successfully implemented the **core ACP v2 integration** with all essential features working:
- ✅ Streaming messages
- ✅ Tool call display
- ✅ Permission dialogs with auto-approval
- ✅ Permission queue for simultaneous requests
- ✅ File operations (read/write)
- ✅ Error handling

However, there are several **high-value features** from Zed's ACP implementation and Claude Code that we should consider adding to enhance the user experience and match industry standards.

---

## Current State: What We Have ✅

### Core ACP Features Implemented
1. **Basic Communication**
   - Streaming message responses
   - Session management
   - Request/response correlation

2. **Tool Integration**
   - Tool call notifications with UI display
   - Tool status updates (running/success/failed)
   - Inline tool call visualization

3. **Permission System**
   - Permission request dialogs (Zed-style inline)
   - Auto-approval for safe operations (reads, searches, safe bash)
   - Permission queue for handling multiple simultaneous requests
   - Manual approval for unsafe operations (writes, destructive commands)

4. **File Operations**
   - Read text files
   - Write text files
   - Working directory context

5. **Settings**
   - Always allow tool actions toggle
   - API key or OAuth authentication
   - Per-space configuration

---

## Missing Features: Priority Analysis

### 🔴 HIGH PRIORITY - Should Implement Soon

#### 1. **MCP Server Integration**
**What It Is:**
- Model Context Protocol allows connecting Claude to external tools/data sources
- Examples: GitHub, Sentry, databases, Linear, Notion, Slack
- Hundreds of pre-built MCP servers available

**Current Status:** ❌ Not implemented

**Why Important:**
- Major feature of Claude Code that users expect
- Enables powerful workflows (query databases, create GitHub issues, etc.)
- Industry standard - Anthropic is pushing MCP heavily

**Implementation Complexity:** Medium-High
- ACP library supports MCP servers
- Need UI for managing server connections
- Need configuration file support (`.mcp.json`)
- Need environment variable expansion
- Need OAuth flow for authenticated servers

**User Value:** ⭐⭐⭐⭐⭐ (Very High)
- Dramatically expands what users can do
- Critical for professional use cases
- Expected feature parity with Claude Code

**Recommendation:** **IMPLEMENT** - This is a must-have for competitive parity

---

#### 2. **Slash Commands**
**What It Is:**
- Custom commands stored as markdown files in `.claude/commands/`
- Type `/` to see menu of available commands
- Can include arguments with `$ARGUMENTS` keyword
- MCP servers can expose prompts as slash commands

**Current Status:** ❌ Not implemented

**Why Important:**
- Users love slash commands for repeated workflows
- Makes the app feel more powerful and customizable
- Team can share commands via git
- Low effort, high perceived value

**Implementation Complexity:** Low-Medium
- Create `.claude/commands/` directory in each Space
- File picker or editor for creating/editing command files
- Parse markdown files and extract content
- Display command palette when user types `/`
- Replace `$ARGUMENTS` with user input

**User Value:** ⭐⭐⭐⭐ (High)
- Empowers users to create custom workflows
- Feels professional and powerful
- Shareable with team

**Recommendation:** **IMPLEMENT** - Low effort, high value

---

#### 3. **Multi-Buffer Diff View**
**What It Is:**
- Zed shows file changes in a multi-buffer with syntax highlighting
- Side-by-side diff view for reviewing changes
- Can approve/reject individual changes
- Integrates with language servers for full IDE experience

**Current Status:** ❌ Not implemented (we just show tool calls)

**Why Important:**
- Core value proposition of editor-based ACP vs CLI
- Users want to see and control changes
- Trust and transparency

**Implementation Complexity:** High
- Need Monaco editor or similar for diff view
- Syntax highlighting for many languages
- Multi-file tracking
- Accept/reject UI

**User Value:** ⭐⭐⭐⭐⭐ (Very High)
- Trust and control over AI changes
- Professional feel
- Key differentiator from CLI

**Recommendation:** **IMPLEMENT LATER** - High value but complex, do after MCP and slash commands

---

#### 4. **Session Persistence**
**What It Is:**
- Save and restore ACP sessions across app restarts
- Resume conversations exactly where you left off
- Session history browsing

**Current Status:** ⚠️ Partial (we save conversation messages but not ACP session state)

**Why Important:**
- Users expect persistence
- Matches Claude Desktop behavior
- Reduces friction

**Implementation Complexity:** Medium
- ACP supports session IDs
- Need to serialize/deserialize session state
- Need UI for session management
- Need cleanup of old sessions

**User Value:** ⭐⭐⭐⭐ (High)
- Expected behavior
- Reduces frustration
- Professional feel

**Recommendation:** **IMPLEMENT** - Important for user experience

---

### 🟡 MEDIUM PRIORITY - Nice to Have

#### 5. **Hooks System**
**What It Is:**
- Run shell commands automatically after events
- Examples:
  - `PostToolUse`: Run formatter after file write
  - `SessionStart`: Initialize environment
  - `PrePrompt`: Validate input
  - `PostPrompt`: Log usage

**Current Status:** ❌ Not implemented

**Why Important:**
- Enables automation and quality checks
- Professional developer feature
- Customization without code changes

**Implementation Complexity:** Medium
- Define hook types and trigger points
- Configuration file format
- Shell command execution (already have this)
- Error handling for hook failures

**User Value:** ⭐⭐⭐ (Medium)
- Power users will love it
- Not critical for basic usage
- Can add later

**Recommendation:** **CONSIDER** - Good for v2.0 or power user mode

---

#### 6. **Subagents**
**What It Is:**
- Spawn additional Claude instances for subtasks
- Examples:
  - Main agent delegates research to subagent
  - Parallel processing of multiple files
  - Specialized agents for different tasks

**Current Status:** ❌ Not implemented (ACP supports it)

**Why Important:**
- Advanced feature for complex workflows
- Enables parallel processing
- Cool factor

**Implementation Complexity:** High
- Multiple ACP connections
- Session management for each subagent
- UI to show multiple agents
- Coordination between agents

**User Value:** ⭐⭐⭐ (Medium)
- Advanced use case
- Not critical for most users
- Nice to have

**Recommendation:** **DEFER** - Wait until core features are solid

---

#### 7. **Terminal Integration**
**What It Is:**
- Embedded terminal in the UI
- ACP can request terminal access
- User can run commands directly

**Current Status:** ❌ Not implemented (ACP supports it)

**Why Important:**
- Seamless workflow
- No switching between apps
- Professional IDE feel

**Implementation Complexity:** Medium
- Need terminal emulator (xterm.js or similar)
- PTY integration
- Security considerations

**User Value:** ⭐⭐⭐ (Medium)
- Nice for developers
- Not critical for non-developers
- Can use external terminal

**Recommendation:** **DEFER** - Lower priority for non-developer audience

---

#### 8. **Plugin System**
**What It Is:**
- Claude Code 2.0.13 added plugin marketplace
- Plugins are bundles of: slash commands, agents, MCP servers, hooks
- Install with single command
- Community can create plugins

**Current Status:** ❌ Not implemented

**Why Important:**
- Future-proofing
- Community contributions
- Extensibility

**Implementation Complexity:** Very High
- Plugin architecture design
- Sandboxing and security
- Plugin marketplace/discovery
- Update mechanism
- Documentation

**User Value:** ⭐⭐⭐⭐ (High - Long Term)
- Not critical for MVP
- Important for ecosystem growth
- Can add later

**Recommendation:** **DEFER** - Version 2.0+ feature

---

### 🟢 LOW PRIORITY - Future Enhancements

#### 9. **Agent Switching**
**What It Is:**
- Connect to different agents (Gemini, Goose, custom agents)
- Switch between agents in UI
- Multiple agent profiles

**Current Status:** ❌ Not implemented

**Why Important:**
- ACP's key value proposition
- Future-proofing
- Flexibility

**Implementation Complexity:** Medium
- Agent discovery/configuration
- Multiple ACP connections
- UI for switching

**User Value:** ⭐⭐ (Low - Current)
- Most users just want Claude
- Can add when other agents mature

**Recommendation:** **DEFER** - Wait for agent ecosystem to mature

---

#### 10. **Headless Mode / CI Integration**
**What It Is:**
- Run Claude Code non-interactively
- Use in CI pipelines, pre-commit hooks
- Automated code review/generation

**Current Status:** ❌ Not implemented

**Why Important:**
- Advanced automation
- Enterprise use cases
- DevOps integration

**Implementation Complexity:** Medium
- CLI mode for app
- Non-interactive configuration
- JSON output format
- Exit codes

**User Value:** ⭐⭐ (Low - For Most Users)
- Niche use case
- Professional feature
- Can add later

**Recommendation:** **DEFER** - Enterprise/advanced feature

---

## Recommendations by Timeline

### 🚀 Immediate (Next 2 Weeks)
1. **None** - Bug fixes complete, app is stable

### 📅 Short Term (Next 1-2 Months)
1. **Slash Commands** ⭐⭐⭐⭐
   - Low complexity, high value
   - Quick win for user empowerment
   - Estimated time: 1-2 weeks

2. **Session Persistence** ⭐⭐⭐⭐
   - Expected behavior
   - Reduces friction
   - Estimated time: 1-2 weeks

3. **MCP Server Integration** ⭐⭐⭐⭐⭐
   - Critical for feature parity
   - High user value
   - Estimated time: 3-4 weeks

### 📅 Medium Term (Next 3-6 Months)
1. **Multi-Buffer Diff View** ⭐⭐⭐⭐⭐
   - Complex but high value
   - Key differentiator
   - Estimated time: 4-6 weeks

2. **Hooks System** ⭐⭐⭐
   - Power user feature
   - Nice to have
   - Estimated time: 2-3 weeks

### 📅 Long Term (6+ Months)
1. **Plugin System** ⭐⭐⭐⭐
   - Ecosystem growth
   - Future-proofing
   - Estimated time: 8-12 weeks

2. **Subagents** ⭐⭐⭐
   - Advanced feature
   - Cool factor
   - Estimated time: 4-6 weeks

3. **Terminal Integration** ⭐⭐⭐
   - IDE feel
   - Developer-focused
   - Estimated time: 2-3 weeks

### 🔮 Future Considerations
1. **Agent Switching**
2. **Headless Mode / CI Integration**

---

## Implementation Notes

### For Slash Commands
```typescript
// Pseudocode structure:
interface SlashCommand {
  name: string;
  description: string;
  template: string; // Markdown content
  arguments?: string[]; // Expected arguments
}

// File structure:
// .claude/commands/review-pr.md
// .claude/commands/generate-tests.md
// .claude/commands/explain-code.md
```

### For MCP Integration
```rust
// ACP library already supports MCP
// Need to expose configuration:
struct McpServerConfig {
  name: String,
  transport: Transport, // http, sse, stdio
  url: String,
  auth: Option<AuthConfig>,
  env: HashMap<String, String>,
}
```

### For Session Persistence
```rust
// Session state to persist:
struct PersistedSession {
  session_id: String,
  space_id: String,
  created_at: DateTime,
  last_active: DateTime,
  conversation_history: Vec<Message>,
  tools_used: Vec<ToolCall>,
}
```

---

## Competitive Analysis

### vs Claude Desktop
| Feature | Claude Desktop | Thinking Space |
|---------|---------------|----------------|
| UI/UX | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Good |
| Local Files | ❌ Limited | ✅ Full access |
| MCP Servers | ✅ Yes | ❌ **Need to add** |
| Persistence | ✅ Cloud sync | ⚠️ Local only |
| Slash Commands | ❌ No | ❌ **Need to add** |

### vs Zed
| Feature | Zed | Thinking Space |
|---------|-----|----------------|
| ACP Support | ✅ Full | ✅ Full |
| Multi-Agent | ✅ Yes | ❌ Future |
| Diff View | ✅ Excellent | ❌ **Need to add** |
| IDE Features | ⭐⭐⭐⭐⭐ Full IDE | ⭐⭐ Basic editor |
| Non-Dev Focus | ❌ No | ✅ **Our advantage** |

### vs Claude Code CLI
| Feature | Claude Code | Thinking Space |
|---------|-------------|----------------|
| MCP Servers | ✅ Yes | ❌ **Need to add** |
| Slash Commands | ✅ Yes | ❌ **Need to add** |
| Hooks | ✅ Yes | ❌ Future |
| Plugins | ✅ Marketplace | ❌ Future |
| GUI | ❌ CLI only | ✅ **Our advantage** |
| Ease of Use | ⭐⭐ Technical | ⭐⭐⭐⭐ **Our advantage** |

---

## Conclusion

### What We're Doing Well ✅
1. **Core ACP implementation** - Solid, type-safe, maintainable
2. **Permission system** - Smart auto-approval, good UX
3. **UI/UX** - Clean, approachable for non-developers
4. **Space metaphor** - Unique, cognitive-science-backed organization

### Critical Gaps to Address 🔴
1. **MCP Server Integration** - Expected feature, high value
2. **Slash Commands** - Low effort, high perceived value
3. **Session Persistence** - Expected behavior
4. **Diff View** - Key differentiator from CLI

### Our Competitive Advantages 💎
1. **Non-developer focus** - Simpler, more approachable than Zed
2. **Space metaphor** - Better mental model than file trees
3. **Desktop app** - Better UX than CLI, more private than web
4. **Focused scope** - Not trying to be a full IDE

### Recommended Next Steps

**Priority 1: Slash Commands** (1-2 weeks)
- Quick win, high user satisfaction
- Makes app feel more powerful
- Foundation for future plugin system

**Priority 2: Session Persistence** (1-2 weeks)
- Expected behavior
- Reduces user frustration
- Enables resuming work

**Priority 3: MCP Server Integration** (3-4 weeks)
- Critical for feature parity
- Unlocks powerful workflows
- Anthropic is pushing this heavily

**Priority 4: Multi-Buffer Diff View** (4-6 weeks)
- High complexity but high value
- Key differentiator from CLI
- Trust and transparency

---

**Total Estimated Time for High Priority Features:** 8-12 weeks

This would bring us to full feature parity with Claude Code while maintaining our unique advantages in UX and organization metaphor.
