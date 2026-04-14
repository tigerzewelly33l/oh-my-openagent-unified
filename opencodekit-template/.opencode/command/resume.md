---
description: Resume work on a bead from previous session
argument-hint: "<bead-id>"
agent: build
---

# Resume: $ARGUMENTS

Pick up where a previous session left off. Recover context, verify state, continue. `/resume` is the claim-and-reattach path for an existing bead continuation.

## Load Skills

```typescript
skill({ name: "beads" });
```

## Phase 1: Verify Task

```bash
br show $ARGUMENTS
```

If not found, check `br list --status=all` — it may have been closed or the ID is wrong.

## Phase 2: Git State

```bash
git branch --show-current
git status --porcelain
```

If not on the right branch, check out the feature branch. If uncommitted changes exist, ask user what to do.

## Phase 3: Find Handoff

Check for handoff notes in the memory system:

```typescript
memory-read({ file: "handoffs/$ARGUMENTS" });
```

If a handoff exists, it tells you:

- What was completed
- Where work stopped
- What to do next
- Any blockers

Also search previous sessions:

```typescript
session_search({ query: "$ARGUMENTS", limit: 5 });
```

## Phase 4: Load Artifacts

Read all available context:

- `.beads/artifacts/$ARGUMENTS/prd.md`
- `.beads/artifacts/plan-snapshots/<bead-id>/` manifest + latest snapshot (if published)
- `.sisyphus/plans/*.md` working draft that matches the bead, if present
- `.beads/artifacts/$ARGUMENTS/progress.txt` (if exists)
- `.beads/artifacts/$ARGUMENTS/research.md` (if exists)

Use the split consistently: `.beads` is the durable user-facing truth, `.sisyphus` is rebuildable working/runtime state, `ock` is the supported public authority, and OMO only runs behind that surface.

## Phase 5: Check Staleness

If handoff is more than 3 days old:

```bash
git log --oneline -10
```

Check if significant changes happened on main. If so, consider rebasing. Don't blindly follow an outdated plan — verify it still makes sense.

## Phase 6: Continue

```bash
br update $ARGUMENTS --status in_progress
```

Only continue when that in-progress claim/update succeeds. Immediately hand the explicit bead selection to OMO runtime before loading more runtime work:

```typescript
beads_runtime_attach({
  bead_id: "$ARGUMENTS",
  source_command: "resume",
  worktree_path: "<resolved worktree path or project root>",
  branch_name: "<current branch if known>",
  worktree_name: "<current worktree if known>",
});
```

If attach validation fails, stop and report the attach error. Do not continue into `/ship` or `/plan` with a detached continuation. OMO runtime attach here is continuation metadata only, not a transfer of close or sync ownership.

Report:

1. Branch and commit
2. Handoff age
3. Progress (completed/remaining tasks)
4. Next action (from handoff or PRD)

Then continue with `/ship $ARGUMENTS` or `/plan $ARGUMENTS` as appropriate.
