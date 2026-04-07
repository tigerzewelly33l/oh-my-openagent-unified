---
description: Create user profile for personalized AI interactions
argument-hint: "[--skip-questions]"
agent: build
---

# Init-User: $ARGUMENTS

Create personalized user profile. Optional but recommended for better AI responses.

> **Prerequisite:** Run `/init` first for core setup
> **Related:** `/init-context` for repo-local project memory setup

## Load Skills

```typescript
skill({ name: "memory-system" });
```

## Options

| Argument           | Default | Description                         |
| ------------------ | ------- | ----------------------------------- |
| `--skip-questions` | false   | Infer from git config, skip prompts |

## Phase 1: Gather Preferences

Unless `--skip-questions`, ask in one message:

1. **Identity**: "Which git contributor are you?" (show top 5 from `git shortlog -sn --all`)
2. **Communication**: "Terse or detailed responses?"
3. **Workflow**: "Auto-commit or ask-first?"
4. **Rules**: "Any rules I should always follow?"
5. **Technical**: "Preferred languages/frameworks?"

If skipped, infer from `git config user.name` and `git config user.email`.

## Phase 2: Create user.md

From template `.opencode/memory/_templates/user.md`:

```bash
cp .opencode/memory/_templates/user.md .opencode/memory/project/user.md
```

Fill in gathered answers:

```markdown
---
purpose: User identity, preferences, communication style
updated: [today]
---

# User Profile

## Identity

- Name: [from answers]
- Git email: [user.email]

## Communication Preferences

- Style: [Terse/Detailed]
- Tone: [Professional/Casual]

## Workflow Preferences

- Git commits: [Auto/Ask-first]
- Beads updates: [Auto/Ask-first]

## Technical Preferences

- Languages/frameworks: [Preferred languages/frameworks]

## Things to Remember

- [Rule 1]
- [Rule 2]
- [Rule 3]
```

## Phase 3: Update opencode.json

Ensure `user.md` is loaded in `instructions` (bare paths, no `file://` prefix).

The default `instructions[]` includes 3 auto-injected files:

```json
{
  "instructions": [
    ".opencode/memory/project/user.md",
    ".opencode/memory/project/tech-stack.md",
    ".opencode/memory/project/project.md"
  ]
}
```

> **Warning:** Do not add more files to `instructions[]` unless they are essential for every prompt. Per-prompt injection of too many files causes session OOM crashes. Use `memory-read()` for on-demand access instead.

## Phase 4: Report

Output:

1. user.md created at `.opencode/memory/project/user.md`
2. Preferences captured
3. 3 files are auto-injected by default: user.md, tech-stack.md, project.md
4. Additional planning files (roadmap.md, state.md) are on-demand via `/init-context`
5. Custom context available at `.opencode/context/` (preserved during init --force and upgrade)
6. Next step: `/init-context` to create or update repo-local project-planning memory files
