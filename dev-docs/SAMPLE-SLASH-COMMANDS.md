# Sample Slash Commands

These are example slash command templates that will be created in each Space's `.claude/commands/` directory.

## For General Use

### explain
```markdown
# Explain

Explain $ARGUMENTS in simple terms, using analogies and examples where helpful. Break down complex concepts into easy-to-understand pieces.
```

### summarize
```markdown
# Summarize

Provide a concise summary of $ARGUMENTS in 3-5 bullet points, highlighting the most important information.
```

### brainstorm
```markdown
# Brainstorm

Generate 10 creative ideas for $ARGUMENTS. Think outside the box and include both conventional and unconventional approaches.
```

## For Writers

### outline
```markdown
# Outline

Create a detailed outline for $ARGUMENTS with main sections, subsections, and key points to cover in each.
```

### improve-writing
```markdown
# Improve Writing

Review and improve the following text, focusing on clarity, flow, and engagement:

$ARGUMENTS

Suggest specific edits and explain why each change improves the writing.
```

### fact-check
```markdown
# Fact Check

Verify the factual accuracy of $ARGUMENTS. Identify any claims that may be incorrect, outdated, or need citation. Provide corrections with sources.
```

## For Developers

### review
```markdown
# Code Review

Review the following code for:
- Potential bugs
- Security vulnerabilities
- Performance issues
- Code style and best practices
- Missing error handling

$ARGUMENTS
```

### debug
```markdown
# Debug

Help me debug this issue:

$ARGUMENTS

Analyze the problem, identify likely causes, and suggest specific solutions with code examples.
```

### test
```markdown
# Generate Tests

Generate comprehensive unit tests for $ARGUMENTS. Include:
- Happy path tests
- Edge cases
- Error conditions
- Mock examples if needed
```

### refactor
```markdown
# Refactor

Refactor the following code to improve readability, maintainability, and performance:

$ARGUMENTS

Explain each change and why it's an improvement.
```

## For Data Analysis

### analyze-data
```markdown
# Analyze Data

Analyze the following data and provide insights:

$ARGUMENTS

Include:
- Key patterns and trends
- Statistical summary
- Interesting findings
- Recommendations
```

### visualize
```markdown
# Create Visualization

Suggest the best way to visualize $ARGUMENTS. Provide code or instructions for creating the visualization, explaining why this approach is effective.
```

## For Project Management

### task-breakdown
```markdown
# Break Down Task

Break down the following task into concrete, actionable steps:

$ARGUMENTS

Organize steps logically, estimate time for each, and identify dependencies.
```

### meeting-notes
```markdown
# Organize Meeting Notes

Convert these meeting notes into a structured format:

$ARGUMENTS

Include:
- Key decisions
- Action items (with owners)
- Follow-up questions
- Next steps
```

## For Learning

### eli5
```markdown
# Explain Like I'm 5

Explain $ARGUMENTS in the simplest possible terms, as if explaining to a 5-year-old. Use analogies and avoid jargon.
```

### deep-dive
```markdown
# Deep Dive

Provide an in-depth technical explanation of $ARGUMENTS. Cover:
- Fundamental concepts
- How it works internally
- Common use cases
- Advanced considerations
- Best practices
```

### compare
```markdown
# Compare

Compare and contrast $ARGUMENTS. Create a detailed comparison including:
- Similarities
- Key differences
- Pros and cons of each
- Use cases for each
- Recommendation based on context
```

## Implementation Notes

When the app creates a new Space, it should:
1. Create `.claude/commands/` directory
2. Create a few starter commands (suggest: explain, summarize, brainstorm, review)
3. Include an `example.md` that shows users how to create their own

Users can:
- Create new commands by adding `.md` files
- Edit existing commands to customize behavior
- Delete commands they don't use
- Share commands via git (since they're just markdown files)

## Command Best Practices

**Good command templates:**
- Are specific about what you want Claude to do
- Give clear structure (bullet points, numbered lists, etc.)
- Use $ARGUMENTS placeholder where input should go
- Include examples or context when helpful

**Example of a GOOD command:**
```markdown
# Review Email

Review the following email draft for:
- Professional tone
- Clarity and conciseness
- Grammar and spelling
- Appropriate level of formality

Email:
$ARGUMENTS

Provide specific suggestions for improvement.
```

**Example of a POOR command:**
```markdown
# Email

$ARGUMENTS
```
(Too vague - doesn't tell Claude what to do with the email)
