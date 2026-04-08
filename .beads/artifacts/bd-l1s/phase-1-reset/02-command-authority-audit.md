# Command Authority Audit

**Bead:** bd-l1s  
**Phase:** 1 (Reset)  
**Artifact:** 02-command-authority-audit.md  
**Status:** Active

---

## Audit Schema

| Field | Value |
|-------|-------|
| Question | Where does command authority live — visible discovery vs executable precedence — and what conflicts exist? |
| Current Behavior | See Visible Command Authority and Execution Command Authority sections |
| Claimed Behavior | Project-memory claims about unified command surface (QUARANTINED) |
| Evidence | Source file analysis from command-discovery.ts, plugin-handlers, CLI entry points |
| Contradictions | See Conflict Matrix |
| Authority Candidates | Split: OCK owns visible discovery, OMO owns execution hooks, both have overlapping entry points |
| Unresolved Questions | See below |
| Confidence | Medium |
| Gate Impact | Non-Blocking |

---

## Visible Command Authority

### OMO (oh-my-openagent/)

**Entry Points:**
- `src/cli/index.ts` — CLI entry point with Commander.js subcommands
- `src/tools/slashcommand/command-discovery.ts` — Discovers commands from `.opencode/command/` directories
- `src/features/builtin-commands/` — Built-in OMO commands (templates in `templates/`)

**Discovery Mechanism:**
```
command-discovery.ts:
  ├─ discoverCommandsFromDir() → scans .opencode/command/ recursively
  ├─ loadBuiltinCommands() → src/features/builtin-commands/
  ├─ discoverPluginCommandDefinitions() → plugin command definitions
  └─ getOpenCodeCommandDirs() → project-local command dirs
```

**Evidence:**
- `command-discovery.ts:23-55` — Directory traversal with nested command support
- `command-discovery.ts:14` — loadBuiltinCommands() imports from builtin-commands feature
- No single unified registry; discovery is distributed across 4 sources

### OCK (opencodekit-template/)

**Entry Points:**
- `src/commands/init.ts` — OCK init command (scaffolding)
- `src/commands/command.ts` — Base command class
- `src/commands/activate.ts` — Skill activation
- `.opencode/command/*.md` — Command definitions in markdown

**Evidence:**
- `src/commands/init.ts` — Hard-coded init workflow, no dynamic discovery
- `src/commands/command.ts` — Abstract base with static command registration
- No parallel to OMO's command-discovery.ts — OCK uses static registration

### Conflict

| Source | Discovery Pattern | Authority Type |
|--------|-------------------|----------------|
| OMO command-discovery | Dynamic (file-system scan) | Visible + Executable |
| OMO builtin-commands | Static (import-time) | Executable |
| OCK commands/ | Static (class registration) | Executable |
| OCK .opencode/command/ | Not used for runtime discovery | (Not integrated) |

---

## Execution Command Authority

### OMO Hook System

**52 Lifecycle Hooks** across 3 tiers:
- Core (24): session hooks (contextWindowMonitor, thinkMode, modelFallback, etc.)
- Tool-Guard (14): pre-tool hooks (commentChecker, rulesInjector, writeExistingFileGuard, etc.)
- Transform (5): message/response transforms
- Continuation (7): todo continuation, compaction
- Skill (2): category skill reminder, auto-slash command

**Execution Authority:**
- Hooks execute in tier order (Core → Tool-Guard → Transform → Continuation → Skill)
- Each hook can mutate context, short-circuit, or delegate to subagents
- No command-level execution hierarchy — hooks are event-driven, not command-driven

**Evidence:**
- `src/plugin/hooks/create-*-hooks.ts` — 5 hook creation functions
- `src/index.ts:createHooks()` — Composes all 52 hooks

### OCK Command Execution

**Static Command Pattern:**
```
Command.run() → executes command logic directly
  ├─ init.ts: run() → scaffold project
  ├─ activate.ts: run() → enable skill
  └─ command.ts: abstract run()
```

**Evidence:**
- `src/commands/command.ts` — Abstract class, no hook integration
- No event-driven execution; direct function calls

---

## Conflict Matrix

| Conflict | Description | Severity |
|----------|-------------|----------|
| **Discovery Mismatch** | OMO discovers from `.opencode/command/`, OCK does not | Medium |
| **Execution Model Mismatch** | OMO uses 52 hooks (event-driven), OCK uses direct calls (imperative) | High |
| **Entry Point Overlap** | Both have CLI entry points (`cli/index.ts` vs `src/commands/`) | Medium |
| **Command Definition Format** | OMO uses Markdown+frontmatter, OCK uses TypeScript classes | Low |
| **Skill Activation** | OMO has skill hooks, OCK has activate command (different mechanisms) | Medium |

---

## Authority Candidates

### Clearly OCK
- Project scaffolding (`src/commands/init.ts`)
- Static command class pattern (`src/commands/command.ts`)
- Skill activation workflow (`src/commands/activate.ts`)

### Clearly OMO
- Dynamic command discovery (`src/tools/slashcommand/command-discovery.ts`)
- Hook-based execution (52 lifecycle hooks)
- Background task management (`src/features/background-agent/`)

### Genuinely Split
- **Command surface** — Visible discovery (OMO) vs execution hooks (OMO) vs static registration (OCK)
- **Skill system** — OMO's hook-based skill loading vs OCK's command-based activation

### Still Ambiguous
- Which system owns "workflow root" definition?
- Can OCK commands invoke OMO hooks?
- Is there a unified command registry, or should there be?

---

## Unresolved Questions

1. **Unified Registry** — Should there be a single command registry, or do OCK and OMO maintain separate surfaces?
2. **Hook Invocation** — Can OCK commands trigger OMO hooks? Current evidence suggests no.
3. **Workflow Root** — What constitutes a "workflow root" when both systems have entry points?
4. **Command Precedence** — If both systems define a command with the same name, which wins?

---

## Gate Impact

**Non-Blocking** — The command authority split is documented and does not prevent Phase 2 architecture work. The ambiguity around unified registry and workflow roots should be resolved during Phase 2, not Phase 1.

---

## Next Steps

This audit feeds into the contradiction synthesis (08):
- Split authority between OCK and OMO is documented
- Execution model mismatch is high-severity but not blocking
- Resolution belongs in Phase 2 architecture work