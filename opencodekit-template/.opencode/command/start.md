---
description: Start working on a bead - claim it and prepare workspace
argument-hint: "<bead-id> [--worktree]"
agent: build
---

# Start: $ARGUMENTS

Claim a task and prepare workspace. Bridge between specification (`/create`) and implementation (`/ship`). `/start` owns the bead claim step, then attaches the claimed bead to OMO runtime before any runtime work begins.

> **Workflow:** `/create` → **`/start <id>`** → `/ship <id>`
>
> ⛔ Bead MUST have `prd.md` (created via `/create`).

## Load Skills

```typescript
skill({ name: "beads" });
skill({ name: "prd-task" }); // PRD → executable tasks
```

## Parse Arguments

| Argument     | Default  | Description                  |
| ------------ | -------- | ---------------------------- |
| `<bead-id>`  | required | The bead to start            |
| `--worktree` | false    | Create isolated git worktree |

## Determine Input Type

| Input Type | Detection                   | Action                  |
| ---------- | --------------------------- | ----------------------- |
| Bead ID    | Matches `br-xxx` or numeric | Start that bead         |
| Path       | File/directory path         | Not supported for start |

## Before You Start

- **Be certain**: Only start beads with valid PRD (check Phase 2)
- **Check workspace**: Don't start if uncommitted changes exist (Phase 1)
- **One task at a time**: Warn if other tasks in progress
- **Validate spec**: Verify prd.md exists and has real content
- **Ask about workspace**: Let user choose branch/worktree strategy

## Phase 1: Pre-flight

```bash
git status --porcelain
git branch --show-current
br list --status=in_progress
```

- If uncommitted changes: ask user to stash, commit, or continue
- If other tasks in progress: warn before claiming another

## Phase 2: Validate Specification

```bash
br show $ARGUMENTS
```

Read the bead-local durable artifacts needed for startup validation, such as `.beads/artifacts/$ARGUMENTS/prd.md` and any existing `prd.json`.

Do not treat a generic read of `.beads/artifacts/$ARGUMENTS/` as sufficient to identify durable published plan truth. If a published plan exists, read it specifically from `.beads/artifacts/plan-snapshots/<bead-id>/`. Treat `.sisyphus/plans/*.md` as rebuildable working authoring state only.

Verify `prd.md` exists and has real content (not just placeholders). If missing or incomplete, tell user to run `/create` first.

## Phase 3: Claim

```bash
br update $ARGUMENTS --status in_progress
```

Only proceed when the claim succeeds. After the successful claim, hand the explicit bead choice to OMO runtime before any PRD conversion, planning, or implementation work begins:

```typescript
beads_runtime_attach({
  bead_id: "$ARGUMENTS",
  source_command: "start",
  worktree_path: "<resolved worktree path or project root>",
  branch_name: "<current branch if known>",
  worktree_name: "<current worktree if known>",
});
```

If `beads_runtime_attach` fails, stop immediately and report the failure instead of continuing to task conversion or implementation. The attach step must remain fail-closed, must not infer bead identity from free-form text, and does not replace OCK ownership of claim or later close/sync actions.

## Phase 4: Prepare Workspace

Ask user how to handle workspace:

```typescript
question({
  questions: [
    {
      header: "Workspace",
      question: "How do you want to set up the workspace?",
      options: [
        {
          label: "Create feature branch (Recommended)",
          description: "git checkout -b feat/<bead-id>-<title>",
        },
        {
          label: "Use current branch",
          description: "Work on current branch",
        },
        {
          label: "Create worktree",
          description: "Isolated git worktree for this bead",
        },
      ],
    },
  ],
});
```

**If feature branch selected:**

Map bead type to branch prefix:

| Bead Type | Branch Prefix |
| --------- | ------------- |
| feature   | feat          |
| bug       | fix           |
| task      | task          |
| epic      | epic          |

Create the branch:

```bash
# Example: feat/br-42-add-auth
git checkout -b $PREFIX/$BEAD_ID-$TITLE_SLUG
```

Slugify the title (lowercase, spaces to hyphens) and use the bead type to determine the prefix.

**If worktree selected:**

```typescript
skill({ name: "using-git-worktrees" });
```

**If current branch:** Continue without branch creation.

Re-run `beads_runtime_attach(...)` after workspace preparation if the resolved worktree path or branch metadata changed from the post-claim values. Keep the same explicit `bead_id` and `source_command: "start"`; this only refreshes persisted metadata for the already-claimed continuation.

## Phase 5: Convert PRD to Tasks

If `prd.json` doesn't exist yet, use `prd-task` skill to convert PRD markdown → executable JSON.

If `prd.json` already exists, show progress (completed/total tasks).

## Phase 6: Report and Route

Output:

1. Bead type and status
2. Branch name
3. Workspace (main or worktree)
4. Artifact status (prd.md validated, prd.json exists/created)
5. Next step recommendation

| State              | Next Command             |
| ------------------ | ------------------------ |
| Has prd.json       | `/ship $ARGUMENTS`       |
| Epic with subtasks | `/start <first-subtask>` |
| Complex task       | `/plan $ARGUMENTS`       |

## Related Commands

| Need                | Command      |
| ------------------- | ------------ |
| Create spec first   | `/create`    |
| Plan implementation | `/plan <id>` |
| Implement and ship  | `/ship <id>` |
