# Release v0.15.0

**Date**: 2026-01-12

## Overview

Major simplification release removing unused features and reducing maintenance burden. Net -4,157 lines of code.

## Breaking Changes

- **Removed vector DB functionality**: `memory-index`, `memory-embed`, semantic search no longer available. Memory now uses keyword-only search.
- **Removed background execution tools**: Use built-in `task` tool for parallel subagent execution instead of `background_start/output/cancel/list`.
- **Removed Beads coordination tools**: `bd-reserve`, `bd-release`, `bd-msg`, `bd-inbox` removed. Use Beads CLI (`bd`) for task tracking.
- **Custom agent prompts removed**: `build.md`, `ninja.md`, `planner.md`, `rush.md` removed. OpenCode now auto-injects model-specific prompts upstream.

## Simplified Toolset

### Memory Tools (3 tools, -1,100 lines)

| Tool            | Status    | Notes                                |
| --------------- | --------- | ------------------------------------ |
| `memory-read`   | ✓ Keep    | Load previous context, templates     |
| `memory-update` | ✓ Keep    | Save learnings, handoffs             |
| `memory-search` | ✓ Keep    | Keyword-only search (simplified)     |
| `observation`   | ✓ Keep    | Structured observations (simplified) |
| `memory-index`  | ✗ Removed | Vector DB rebuild (no Ollama)        |
| `memory-embed`  | ✗ Removed | Embedding generation                 |

### Beads Tools (0 tools, -377 lines)

All coordination tools removed in favor of CLI-only usage:

```bash
# Before: bd-reserve({ paths: ["src/foo.ts"] })
# After:  Just coordinate via bd CLI

bd ready                              # Find work
bd update <id> --status in_progress   # Claim
bd close <id> --reason "..."          # Complete
```

### Parallel Execution

**Before** (custom tools):

```typescript
background_start({ agent: "explore", ... });
background_output({ taskId: "bg_123" });
```

**After** (built-in tool):

```typescript
task({ subagent_type: "explore", ... });  // Native parallel, no manual collection
```

### Other Removals

| File                 | Lines | Reason                  |
| -------------------- | ----- | ----------------------- |
| `tool/ast-grep.ts`   | ~270  | AST analysis (use grep) |
| `tool/repo-map.ts`   | ~180  | File tree visualization |
| `tool/background.ts` | ~510  | Use `task` tool         |
| `agent/build.md`     | ~80   | Upstream prompts        |
| `agent/ninja.md`     | ~80   | Upstream prompts        |
| `agent/planner.md`   | ~80   | Upstream prompts        |
| `agent/rush.md`      | ~80   | Upstream prompts        |

## Net Changes

- **Files deleted**: 12 files
- **Lines removed**: ~4,157 lines
- **Lines added**: ~445 lines
- **Net**: -3,712 lines

## Commands Updated

- `/config` now shows `plan` and `general` agents
- `/status`, `/triage`, `/pr`, `/revert-feature` - removed `bd-msg` usage
- `/handoff` - simplified workflow
- All commands updated to use Beads CLI only
