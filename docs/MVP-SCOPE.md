# Thinking Space - MVP Scope

## Goal

Build the simplest possible version that validates the core concept: a spatial interface for Claude Agent SDK that's as approachable as Claude Desktop but with the power of local file access and persistent memory.

## Success Criteria

The MVP is successful if:
1. A non-developer can create a Space and start chatting in < 2 minutes
2. The mental model of "Spaces" makes immediate sense
3. Claude's responses are noticeably more contextual than Claude Desktop
4. File operations work smoothly within a Space
5. The UI feels polished and professional (Claude Desktop quality)

## In Scope

### 1. Core Space Management

**Create Space**
- "New Space" button in sidebar
- Modal with:
  - Name input (required)
  - Template selection: "Quick Start" or "Custom" (default: Quick Start)
  - "Create" button
- Creates folder, generates CLAUDE.md from template, opens Space

**View Spaces**
- Sidebar list of all Spaces
- Shows name and last accessed timestamp
- Click to switch to Space
- Current Space highlighted

**Delete Space**
- Right-click → Delete (or kebab menu)
- Confirmation dialog
- Removes from filesystem and database

**Basic Info**
- View when Space was created
- View when last accessed
- That's it—no complex metadata

### 2. Chat Interface

**Message Input**
- Text area at bottom (like Claude Desktop)
- Multi-line support (Shift+Enter for new line)
- Send button or Enter to submit
- Auto-focus on Space switch

**Message Display**
- User messages on right
- Assistant messages on left (or opposite—decide based on Claude Desktop)
- Markdown rendering with syntax highlighting
- Timestamps on hover
- Smooth streaming as Claude responds

**Loading States**
- "Claude is thinking..." indicator
- Typing indicator while streaming
- Clear visual feedback

**Error Handling**
- Show errors inline
- Allow retry
- Don't crash the whole app

### 3. CLAUDE.md Management

**View/Edit CLAUDE.md**
- Button/tab to open CLAUDE.md for current Space
- Simple text editor (Monaco or similar)
- Save button (auto-save on blur is fine too)
- Markdown preview (split view or toggle)

**Templates**
Two templates to start:

**Quick Start Template:**
```markdown
# [Space Name]

## Purpose
This is a workspace for [brief description].

## Context
[Any relevant context Claude should know]

## Guidelines
- [Any specific instructions for Claude]
```

**Custom Template:**
```markdown
# [Space Name]

[Write your own instructions for Claude]
```

That's it. Simple and flexible.

### 4. File Operations

**File Attachment**
- Paperclip icon or drag-and-drop
- Attach files to messages
- Show attached files as chips
- Claude can read attached files

**File Access Permissions**
- **Within Space directory**: Auto-allowed
- **Outside Space directory**: Show permission dialog first time
  - "Claude wants to access: /path/to/file"
  - "Allow Once" / "Allow Always" / "Deny"
- Remember permissions per Space

**File Display**
- Show which files Claude accessed in a message
- Click to open in default app
- That's it—no built-in file previews (yet)

### 5. Settings

**API Key**
- Settings panel (gear icon)
- Input for Anthropic API key
- Store securely (platform keychain)
- Validate on save

**Theme**
- Light / Dark mode toggle
- Match system preference option
- That's it for now

**Data Location**
- Show where Spaces are stored
- "Open Data Folder" button
- That's it—no custom locations yet

### 6. First-Time Experience

**Welcome Screen**
- Beautiful onboarding
- Explain the concept briefly:
  - "Thinking Space is a place to think with Claude"
  - "Create Spaces for different projects or areas of your life"
  - "Each Space has memory, so Claude remembers context"
- "Get Started" button → Create first Space

**Setup Checklist**
- Enter API key
- Create first Space
- Send first message
- Done!

## Out of Scope (Defer to Later)

### v1.1+ Features
- Search across Spaces
- Tags/categories for Spaces
- Favorite/pin Spaces
- Space templates beyond the basic two
- Session history within a Space (multiple conversations)
- Message editing
- Regenerate responses
- Copy/share conversations

### v2+ Features
- MCP server configuration UI
- Custom slash commands
- Usage analytics/cost tracking
- Timeline/checkpoints
- Multi-agent support (via ACP)
- Collaboration/sharing
- Cloud sync
- Mobile app
- Plugins/extensions

## UI Mockup (Text Description)

```
┌────────────────────────────────────────────────────────────┐
│  Thinking Space                               [-][□][×]     │
├──────────┬─────────────────────────────────────────────────┤
│          │                                                  │
│  🏠 Home │  Newsletter Writing                      [⋮]     │
│          │                                                  │
│  Spaces  │  ┌────────────────────────────────────────┐    │
│  ────────│  │                                         │    │
│  • News  │  │  👤 You                        2:14 PM  │    │
│  • Book  │  │  Help me brainstorm topics for this    │    │
│  • Money │  │  week's newsletter                      │    │
│          │  │                                         │    │
│  [+ New] │  │  🤖 Claude                     2:14 PM  │    │
│          │  │  Based on your recent conversations... │    │
│  ────────│  │  Here are some ideas:                  │    │
│          │  │  1. Extended Mind and AI tools         │    │
│  ⚙️       │  │  2. Spatial thinking for knowledge...  │    │
│          │  │                                         │    │
└──────────│  └────────────────────────────────────────┘    │
           │                                                  │
           │  ┌────────────────────────────────────────┐    │
           │  │ Type a message...                  📎  │    │
           │  └────────────────────────────────────────┘    │
           │                                            [↑]  │
           └──────────────────────────────────────────────────┘
```

## Technical Priorities

### Must Have
1. **Stable Claude Agent SDK integration**
   - Message sending/receiving works reliably
   - File operations don't break
   - Streaming works smoothly

2. **Data persistence**
   - Spaces survive app restart
   - Messages are saved
   - No data loss

3. **Good performance**
   - App launches in < 2 seconds
   - Space switching is instant
   - No UI lag during streaming

4. **Error recovery**
   - API errors don't crash the app
   - File errors are handled gracefully
   - User can always recover

### Nice to Have
- Keyboard shortcuts (Cmd+N for new Space, etc.)
- Drag-and-drop reordering of Spaces
- Right-click context menus
- Smooth animations

### Acceptable Limitations
- Only one session per Space (can't view history yet)
- No message editing
- No regeneration
- Basic markdown rendering (code blocks, lists, bold/italic)
- No image display in chat (show as file links)

## Development Phases

### Phase 1: Foundation (Week 1-2)
- Set up Tauri project
- Basic UI layout (sidebar + main area)
- Space creation/deletion
- Simple state management

### Phase 2: Agent Integration (Week 3-4)
- Claude Agent SDK wrapper
- Message sending/receiving
- Streaming response display
- CLAUDE.md loading

### Phase 3: File Operations (Week 5)
- File attachment
- Permission system
- File access from Agent SDK

### Phase 4: Polish (Week 6)
- CLAUDE.md editor
- Settings panel
- Welcome screen
- Error handling
- Performance optimization

### Phase 5: Testing & Launch (Week 7)
- Manual testing
- Bug fixes
- Documentation
- Build and package
- Soft launch

## Launch Checklist

Before releasing MVP:

**Functionality**
- ✓ Create/delete Spaces works
- ✓ Chat works reliably
- ✓ File operations work
- ✓ CLAUDE.md can be edited
- ✓ Settings persist
- ✓ No data loss on restart

**Polish**
- ✓ UI looks professional
- ✓ No obvious bugs
- ✓ Error messages are helpful
- ✓ Loading states are clear
- ✓ Keyboard shortcuts work

**Documentation**
- ✓ README with setup instructions
- ✓ API key acquisition guide
- ✓ Basic usage guide
- ✓ FAQ for common issues

**Distribution**
- ✓ macOS build tested
- ✓ Windows build tested (if time allows)
- ✓ Linux build tested (if time allows)
- ✓ Installers work
- ✓ GitHub release created

## Metrics to Track

Even for MVP, track:
1. Number of Spaces created
2. Number of messages sent
3. Average session length
4. Crash rate
5. API errors

(Analytics optional, but good to have instrumentation ready)

## Post-MVP Feedback Questions

After launch, ask users:
1. Did the concept make sense immediately?
2. What was confusing?
3. What features are you missing most?
4. Would you use this daily?
5. What would you use it for?

Use answers to prioritize v1.1 features.

## Definition of Done

MVP is complete when:
1. A non-technical user can successfully:
   - Install the app
   - Set up their API key
   - Create a Space
   - Have a contextual conversation with Claude
   - Attach and reference files
   - Edit their CLAUDE.md
2. The app feels polished (no obvious rough edges)
3. It's stable enough for daily use
4. Code is documented well enough for future development
5. We're proud to show it to people

---

**Ship it when it's simple, stable, and delightful—not when it has every feature.**
