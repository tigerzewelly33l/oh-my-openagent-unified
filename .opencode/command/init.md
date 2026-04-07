---
description: Initialize core project setup, then offer project-context setup
argument-hint: "[--deep]"
agent: build
---

# Init: $ARGUMENTS

Core project setup. Creates AGENTS.md and detects tech stack. Run once per project, then offer continuation into `/init-context` for repo-local planning memory.

> **Flow:** `/init` handles core setup first, then offers continuation into `/init-context`, which creates or updates `project.md`, `roadmap.md`, and `state.md`.

## Load Skills

```typescript
skill({ name: "index-knowledge" });
```

## Options

| Argument | Default | Description                               |
| -------- | ------- | ----------------------------------------- |
| `--deep` | false   | Comprehensive research (~100+ tool calls) |

## Phase 1: Detect Project

Detect and validate:

- Package manager and dependencies (with versions)
- Build, test, lint, dev commands — **validate each actually works**
- CI/CD configuration
- Existing AI rules (`.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`)
- Top-level directory structure

With `--deep`: Also analyze git history, source patterns, subsystem candidates.

## Phase 2: Preview Detection

After detecting project, show summary and ask for confirmation:

```typescript
question({
  questions: [
    {
      header: "Preview",
      question: `Detected: ${detectedTechStack}. Create AGENTS.md?`,
      options: [
        { label: "Yes, create it (Recommended)" },
        { label: "Show me what you'll write first" },
        { label: "Cancel" },
      ],
    },
  ],
});
```

**If "Show me":** Display detected values without writing files, then ask again.

## Phase 3: Create AGENTS.md

Create `./AGENTS.md` — **target <60 lines** (max 150). Follow the `index-knowledge` skill format:

- Tech stack with versions
- File structure
- Commands (validated)
- Code example from actual codebase (5-10 lines)
- Testing conventions
- Boundaries (always/ask-first/never)
- Gotchas

**Principles**: Examples > explanations. Pointers > copies. If AGENTS.md exists, improve it — don't overwrite blindly.

## Phase 4: Create tech-stack.md

From template `.opencode/memory/_templates/tech-stack.md`:

Read the template from `.opencode/memory/_templates/tech-stack.md` and write it to `.opencode/memory/project/tech-stack.md`.

Fill detected values:

- Framework, language, runtime
- Styling, components, design system
- Database, ORM, state management
- Testing tools
- Verification commands

## Phase 5: Subsystems (--deep only)

Identify candidates for nested AGENTS.md:

- `packages/*/` in monorepos
- `frontend/` vs `backend/` directories
- Significantly different subsystem patterns

Ask user before creating nested files.

## Phase 6: Verify and Report

Verify:

- [ ] AGENTS.md is <60 lines (or justified)
- [ ] Commands validated and work
- [ ] Boundaries include Never rules
- [ ] Code example from actual codebase
- [ ] tech-stack.md created

Output:

1. Files created (with line counts)
2. Tech stack detected
3. Commands validated (yes/no)
4. Suggested next steps:
   - `/init-user` — Create user profile
   - `/init-context` — Create or update repo-local project memory
   - `/review-codebase` — Deep codebase analysis

## Phase 7: Offer Continuation Into Project Context

After core setup is complete, ask whether to continue directly into `/init-context`:

```typescript
question({
  questions: [
    {
      header: "Continue",
      question: "Core setup is done. Continue into project context setup now?",
      options: [
        {
          label: "Yes, continue (Recommended)",
          description: "Run the /init-context workflow next in this session",
        },
        {
          label: "Stop after core setup",
          description: "Finish /init and print the exact next command",
        },
      ],
      multiple: false,
    },
  ],
});
```

If the user chooses to continue, follow the `/init-context` workflow in the same session.

Do **not** create `project.md`, `roadmap.md`, or `state.md` in `/init` itself. `/init-context` remains the single owner of those files.

If the user stops after core setup, print the exact next command: `/init-context`.
