# Documentation Guide

Welcome to Thinking Space documentation. Everything is organized for clarity and maintainability.

---

## 📚 Documentation Structure

### Living Documents (Update Frequently)
These are the "single source of truth" - always current, updated after changes.

- **[STATUS.md](STATUS.md)** ⭐ **START HERE**
  - What's built, what's not, priorities
  - Updated after every feature completion
  - Check this at the start of each session

### Evergreen Documents (Rarely Change)
Core principles and architecture - stable reference material.

- **[VISION.md](VISION.md)** - Why this exists, design philosophy
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - How it's built technically
- **[MVP-SCOPE.md](MVP-SCOPE.md)** - What we're building in v1

### Historical Documents (Never Update)
Point-in-time records for understanding past decisions.

- **[archive/planning/](archive/planning/)** - Pre-build research
- **[archive/sessions/](archive/sessions/)** - Development session notes

---

## 🎯 Quick Navigation

**I want to...**

- **Understand current state** → Read [STATUS.md](STATUS.md)
- **Start contributing** → Read [STATUS.md](STATUS.md) + [ARCHITECTURE.md](ARCHITECTURE.md)
- **Understand the vision** → Read [VISION.md](VISION.md)
- **See what's in MVP** → Read [MVP-SCOPE.md](MVP-SCOPE.md)
- **Find implementation details** → Check [archive/sessions/](archive/sessions/)
- **See research/decisions** → Check [archive/planning/](archive/planning/)

---

## 📝 Documentation Principles

### Living Docs Rules
- Must have "Last Updated" date at top
- Update immediately after changes
- Keep concise (detailed history goes in archive)
- Maximum 1 doc per purpose (no duplicates)

### Evergreen Docs Rules
- Write once, update only for major changes
- Can be longer and more detailed
- Timeless principles, not current state

### Historical Docs Rules
- Never update after creation
- Include date in context
- Useful for "why did we decide X?"
- Optional reading

---

## ✅ When to Update What

**After completing a feature:**
1. Update [STATUS.md](STATUS.md) - move from "Not Built" to "Built"
2. Update [../README.md](../README.md) if user-facing
3. Archive implementation notes in `archive/sessions/` if detailed

**After major architectural change:**
1. Update [ARCHITECTURE.md](ARCHITECTURE.md)
2. Update [STATUS.md](STATUS.md)
3. Document the decision in a session note

**After scope change:**
1. Update [MVP-SCOPE.md](MVP-SCOPE.md)
2. Update [STATUS.md](STATUS.md) priorities

---

## 🔍 Document Summaries

### STATUS.md (Living)
Current implementation state. Includes:
- What's built (by feature area)
- What's not built (MVP gaps)
- Known issues
- Next 3-5 priorities
- Completion estimate

**Update:** After every feature or bug fix

### VISION.md (Evergreen)
Product philosophy. Includes:
- Problem statement
- Core insights (Extended Mind, spatial thinking)
- Solution overview
- Design principles

**Update:** Rarely (only if vision pivots)

### ARCHITECTURE.md (Evergreen)
Technical design. Includes:
- Tech stack
- System architecture
- Data flow
- File structure
- Key patterns

**Update:** Major architectural changes only

### MVP-SCOPE.md (Evergreen)
V1 feature scope. Includes:
- What's in scope
- What's deferred
- Success criteria
- Development phases

**Update:** When scope changes (rare)

---

## 📦 Archive Organization

### archive/planning/
Research and decisions from planning phase:
- `00-research-findings.md` - Pre-build research

### archive/sessions/
Development session notes:
- `SESSION-2-SUMMARY.md` - Foundation work
- `SESSION-3-SUMMARY.md` - Agent SDK integration
- `SESSION-4-SUMMARY.md` - Streaming fixed

Add new session notes here if they contain valuable implementation details or decisions.

---

## 🚫 What NOT to Do

❌ Don't create duplicate "status" docs
❌ Don't leave outdated information in living docs
❌ Don't update historical docs
❌ Don't create docs without clear purpose
❌ Don't forget "Last Updated" dates on living docs

---

## ✨ Benefits of This Structure

- **Single source of truth** - Only one STATUS.md
- **Clear categories** - Know what to update vs archive
- **Reduced confusion** - No duplicate or outdated docs
- **Easy navigation** - Logical structure
- **Standard practices** - Follows common open source patterns
- **AI-friendly** - Clear which docs to reference

---

**Questions?** Open an issue or check the main [README](../README.md)
