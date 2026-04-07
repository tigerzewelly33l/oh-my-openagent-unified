# Beads PRD Template

**Bead:** bd-k8z  
**Created:** 2026-04-07  
**Status:** Draft

## Bead Metadata

```yaml
depends_on: []
parallel: true
conflicts_with: []
blocks: []
estimated_hours: 3
```

---

## Problem Statement

### What problem are we solving?

The merged OCK+OMO system is already in Phase 3 backbone work, but one narrow blocker remains under-specified: command authority. The completed Phase 1 artifact set — especially `.beads/artifacts/bd-l1s/research.md` — already established the broad comparison space: OCK capability, OMO capability, overlap/collision domains, candidate ownership, preserved strengths, and command/runtime follow-through notes. Within that settled basis, repo-local `.opencode/command/*.md` workflow commands, OMO built-in commands, runtime-discovered compatibility surfaces, plugin-provided commands, and command-merging logic still leave one seam too loose: which current command surfaces behave as true workflow roots, which act as subordinate support commands, and which are only adapters or compatibility remnants. Without a dedicated follow-on command-authority audit grounded in that Phase 1 basis, later command/runtime enforcement work risks hardening duplicate workflow roots or demoting the wrong surfaces.

### Why now?

The project has already reached Phase 3 backbone integration, and command-surface authority remains one of the highest-risk blockers to clean enforcement of the approved workflow model. This bead exists now because command authority is a narrow follow-on support/research slice that can be re-audited on top of the completed Phase 1 package without turning into implementation design. It does not replace the broad Phase 1 work; it tightens one command-surface seam that the Phase 1 package already identified and that later enforcement still depends on. The cost of not doing this work is that future runtime or documentation changes may preserve split-brain workflow entry points under a “unified” label, weakening the bead-backed lifecycle and making later enforcement work less trustworthy.

### Who is affected?

- **Primary users:** Ryan as the operator of the merged OCK+OMO workflow, especially when choosing between `/create`, `/start`, `/ship`, `/plan`, `/verify`, `/lfg`, runtime-discovered commands, or compatibility commands.
- **Secondary users:** Future contributors or agents reading the repo, because command precedence and command-role ambiguity directly affects how they interpret the intended default workflow.

---

## Scope

### In-Scope

- Use the completed Phase 1 artifact set, especially `.beads/artifacts/bd-l1s/research.md`, as the baseline for interpreting command-surface overlap, candidate ownership, preserved strengths, and follow-through expectations.
- Audit repo-local `.opencode/command` workflow surfaces relevant to lifecycle authority.
- Audit OMO runtime command discovery, merge order, plugin command loading, and visible slash-command prioritization.
- Classify command surfaces into workflow roots, subordinate support commands, continuity support, convenience adapters, specialty sidecars, and compatibility-only remnants.
- Document where visible command priority and execution registration priority differ.
- Record duplicate-entry risk and command-authority ambiguity in a bead-scoped research artifact.
- Compare the observed runtime behavior against the project charter’s command migration rules.

### Out-of-Scope

- Implementing command precedence fixes or runtime enforcement changes.
- Re-auditing durable-vs-active state boundaries outside command-related evidence.
- Designing migration code, compatibility shims, or deprecation execution plans.
- Reframing project phase history or reopening broad architecture-definition work.
- Modifying builtin command behavior, slash-command executor logic, or plugin merge logic in this bead.

---

## Proposed Solution

### Overview

Produce a focused research artifact that maps the real command-authority picture across repo-local OCK workflow commands and OMO runtime assembly logic, using the completed Phase 1 package as the baseline rather than recreating it. The bead should identify which commands function as the intended canonical lifecycle, which commands are support-only, which commands are adapters into the primary lifecycle, and which command sources remain compatibility-only or risk acting like peer workflow roots. The output should be precise enough to support later enforcement work without itself becoming an implementation design.

### User Flow (if user-facing)

1. Read the project charter and command-role rules that define the intended bead-backed lifecycle.
2. Inspect runtime command-discovery and command-merging code paths that determine what commands are visible and what wins at execution time.
3. Produce a research artifact that documents command classes, precedence behavior, mismatches, and duplicate-entry risk.

---

## Requirements

### Functional Requirements

#### Command-source inventory

The bead must inventory the concrete command sources that affect workflow authority in the current repo.

**Scenarios:**

- **WHEN** the audit reads runtime command-loading code **THEN** it identifies the relevant sources of command definitions and their merge/discovery paths.
- **WHEN** the audit inspects repo-local command files **THEN** it records which of them are intended lifecycle commands versus support or adapter surfaces.

#### Command-role classification

The bead must classify the current command surface using the project’s own command-role model instead of generic labels.

**Scenarios:**

- **WHEN** a command matches the bead-backed lifecycle contract in the charter **THEN** it is classified as a workflow root or subordinate support command according to that contract.
- **WHEN** a command routes into the primary workflow without independent durable authority **THEN** it is classified as an adapter or compatibility-only surface rather than a peer root.

#### Precedence and duplicate-entry analysis

The bead must document whether the visible slash-command order and the runtime execution merge order produce the same authority outcome.

**Scenarios:**

- **WHEN** visible slash-command prioritization differs from execution registration precedence **THEN** the research artifact must record that mismatch explicitly.
- **WHEN** multiple command sources can plausibly present the same user-facing workflow role **THEN** the research artifact must identify the duplicate-entry risk and describe why it matters.

#### Evidence-backed research artifact

The bead must end with a durable research artifact under the bead’s artifact directory.

**Scenarios:**

- **WHEN** the audit completes **THEN** findings are written to `.beads/artifacts/bd-k8z/research.md` with concrete file references.
- **WHEN** a conclusion depends on charter intent rather than runtime code **THEN** the artifact must distinguish documented intent from implemented behavior.
- **WHEN** a conclusion depends on the broader comparative basis **THEN** the artifact must point back to the relevant completed Phase 1 sections in `.beads/artifacts/bd-l1s/research.md` instead of restating that package from scratch.

### Non-Functional Requirements

- **Performance:** Research should stay focused on the command-authority slice and avoid broad re-audit of unrelated architecture domains.
- **Security:** No secrets or protected config values should be surfaced in the artifact.
- **Accessibility:** Not applicable.
- **Compatibility:** Findings must remain grounded in the checked-in repo and its loaded project configuration, not speculative external behavior.

---

## Success Criteria

- [ ] The bead produces a research artifact that identifies concrete command-authority sources and their roles.
  - Verify: `test -f /work/ock-omo-system/.beads/artifacts/bd-k8z/research.md`
- [ ] The artifact distinguishes workflow roots, subordinate support commands, continuity support, adapters, specialty sidecars, and compatibility-only remnants using repo evidence.
  - Verify: `grep -n "workflow roots\|subordinate\|continuity\|adapter\|compatibility" /work/ock-omo-system/.beads/artifacts/bd-k8z/research.md`
- [ ] The artifact explicitly documents whether command visibility precedence and execution registration precedence align or diverge.
  - Verify: `grep -n "visible\|execution\|precedence\|duplicate-entry" /work/ock-omo-system/.beads/artifacts/bd-k8z/research.md`
- [ ] The PRD itself references real source files involved in command authority.
  - Verify: `grep -n "command-discovery\|command-config-handler\|builtin-commands\|project.md" /work/ock-omo-system/.beads/artifacts/bd-k8z/prd.md`

---

## Technical Context

### Existing Patterns

- Pattern 0: `/work/ock-omo-system/.beads/artifacts/bd-l1s/research.md` - Completed Phase 1 comparative-research package containing the overlap/collision map, OCK and OMO capability audits, preserved strengths list, candidate ownership matrix, and command/runtime follow-through notes that this bead narrows for command-authority support work.
- Pattern 1: `/work/ock-omo-system/.opencode/memory/project/project.md` - Defines the canonical lifecycle path and command migration classes that this audit must use as the classification baseline.
- Pattern 2: `/work/ock-omo-system/.opencode/memory/project/state.md` - Records that the project is already in Phase 3 and that command/runtime enforcement is an active blocker.
- Pattern 3: `/work/ock-omo-system/omo/src/tools/slashcommand/command-discovery.ts` - Determines visible slash-command discovery and prioritization.
- Pattern 4: `/work/ock-omo-system/omo/src/plugin-handlers/command-config-handler.ts` - Determines runtime command registration merge order and effective execution-time precedence.

### Key Files

- `/work/ock-omo-system/omo/src/tools/slashcommand/command-discovery.ts` - Visible slash-command discovery, deduplication, and prioritization.
- `/work/ock-omo-system/omo/src/plugin-handlers/command-config-handler.ts` - Runtime command merge order.
- `/work/ock-omo-system/omo/src/plugin-handlers/config-handler.ts` - Applies command configuration into runtime plugin state.
- `/work/ock-omo-system/omo/src/shared/project-discovery-dirs.ts` - Repo-local `.opencode` ancestor discovery.
- `/work/ock-omo-system/omo/src/features/claude-code-command-loader/loader.ts` - Repo-local markdown command loading.
- `/work/ock-omo-system/omo/src/features/builtin-commands/commands.ts` - Built-in OMO commands and conflicting builtin set.
- `/work/ock-omo-system/omo/src/features/claude-code-plugin-loader/command-loader.ts` - Plugin command namespacing and loading.
- `/work/ock-omo-system/omo/src/hooks/auto-slash-command/executor.ts` - Auto-slash execution path.
- `/work/ock-omo-system/omo/src/plugin/tool-registry.ts` - Skill/tool exposure of the discovered command list.
- `/work/ock-omo-system/.opencode/memory/project/project.md` - Intended command migration path and workflow authority model.
- `/work/ock-omo-system/.opencode/command/lfg.md` - Convenience adapter evidence.
- `/work/ock-omo-system/.opencode/command/compound.md` - Convenience adapter evidence.
- `/work/ock-omo-system/.opencode/README.md` - Repo-local command/plugin documentation, including drift clues.

### Affected Files

Files this bead will modify (for conflict detection):

```yaml
files:
  - .beads/artifacts/bd-k8z/prd.md # Requirements artifact for the new command-authority audit bead
  - .beads/artifacts/bd-k8z/research.md # Planned durable research output for the audit findings
```

---

## Risks & Mitigations

| Risk                                                                                             | Likelihood | Impact | Mitigation                                                                                      |
| ------------------------------------------------------------------------------------------------ | ---------- | ------ | ----------------------------------------------------------------------------------------------- |
| The audit drifts into broader unified-state architecture instead of staying on command authority | Medium     | Medium | Keep scope anchored to command-source inventory, classification, and precedence mismatches only |
| The research artifact repeats charter claims without distinguishing runtime evidence             | Medium     | High   | Require file-backed findings and an explicit documented-intent vs implemented-behavior split    |
| The bead starts prescribing implementation changes instead of recording authority findings       | Medium     | Medium | Treat remediation as out-of-scope and stop at classification plus evidence                      |

---

## Open Questions

| Question                                                                                                                                   | Owner               | Due Date   | Status |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ---------- | ------ |
| Does the current repo-local and runtime command layering already contain enough evidence to classify all surviving compatibility commands? | Ryan / future agent | 2026-04-07 | Open   |
| Which later implementation bead should consume this audit when encoding command/runtime enforcement checkpoints?                           | Ryan / future agent | 2026-04-07 | Open   |

---

## Tasks

Write tasks in a machine-convertible format for `prd-task` skill.

### Audit runtime command assembly [research]

The end state is a verified inventory of runtime command discovery, merge order, deduplication, and precedence behavior across the OMO command-loading stack.

**Metadata:**

```yaml
depends_on: []
parallel: true
conflicts_with: []
files:
  - .beads/artifacts/bd-k8z/research.md
```

**Verification:**

- `grep -n "loadPluginCommands\|discoverCommandsSync\|applyCommandConfig\|prioritizeCommands" /work/ock-omo-system/omo/src/tools/slashcommand/command-discovery.ts /work/ock-omo-system/omo/src/plugin-handlers/command-config-handler.ts /work/ock-omo-system/omo/src/features/claude-code-plugin-loader/command-loader.ts`
- `grep -n "repo-local\|merge\|precedence\|dedupe\|visible" /work/ock-omo-system/.beads/artifacts/bd-k8z/research.md`

### Classify workflow command roles [research]

The end state is a command-role map that separates workflow roots, subordinate support commands, continuity support, convenience adapters, specialty sidecars, and compatibility-only surfaces using the project charter as the classification baseline.

**Metadata:**

```yaml
depends_on: ["Audit runtime command assembly"]
parallel: false
conflicts_with: []
files:
  - .beads/artifacts/bd-k8z/research.md
```

**Verification:**

- `grep -n "Primary lifecycle\|Subordinate lifecycle support\|Continuity support\|Convenience adapters\|Runtime-discovered compatibility commands" /work/ock-omo-system/.opencode/memory/project/project.md`
- `grep -n "workflow roots\|subordinate support\|continuity support\|convenience adapters\|compatibility-only" /work/ock-omo-system/.beads/artifacts/bd-k8z/research.md`

### Record duplicate-entry risk and conclusions [research]

The end state is a durable research artifact that captures where visible command priority and execution-time precedence align or diverge, and what that means for duplicate workflow-root risk.

**Metadata:**

```yaml
depends_on: ["Classify workflow command roles"]
parallel: false
conflicts_with: []
files:
  - .beads/artifacts/bd-k8z/research.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-k8z/research.md`
- `grep -n "duplicate-entry\|visible slash\|execution registration\|documented intent\|implemented behavior" /work/ock-omo-system/.beads/artifacts/bd-k8z/research.md`

---

## Dependency Legend

| Field            | Purpose                                           | Example                                    |
| ---------------- | ------------------------------------------------- | ------------------------------------------ |
| `depends_on`     | Must complete before this task starts             | `["Setup database", "Create schema"]`      |
| `parallel`       | Can run concurrently with other parallel tasks    | `true` / `false`                           |
| `conflicts_with` | Cannot run in parallel (same files)               | `["Update config"]`                        |
| `files`          | Files this task modifies (for conflict detection) | `["src/db/schema.ts", "src/db/client.ts"]` |

---

## Notes

This bead is a standalone Phase 3 support/research artifact focused on command authority, but it is explicitly based on the completed Phase 1 artifact set rather than detached from it. In practice, that means `bd-k8z` should be read as a narrow follow-on audit derived from `.beads/artifacts/bd-l1s/research.md`, especially its overlap/collision map, capability audits, preserved strengths list, candidate ownership matrix, and command/runtime follow-through notes. Its job is not to recreate that package or replace it. Its job is to sharpen one unresolved command-surface seam so later enforcement work can proceed on top of settled Phase 1 research.
