# Beads PRD Template

**Bead:** bd-l1s  
**Created:** 2026-04-07  
**Status:** Draft

## Bead Metadata

```yaml
depends_on: []
parallel: false
conflicts_with: ["bd-x0u"]
blocks: []
estimated_hours: 6
```

---

## Problem Statement

### What problem are we solving?

The merged OCK+OMO system still has two different state namespaces with overlapping meaning: `/.beads` and `/.sisyphus`. OCK treats `/.beads` as git-native workflow truth for issue state and durable task artifacts, while OMO uses `/.sisyphus` for plans, continuation, active execution state, and runtime task persistence. If these remain conceptually separate without an explicit merged-state architecture, the final system will keep duplicate or ambiguous authority over task truth, plans, execution state, and resumption behavior.

The goal of this bead is to define one unified state model for the merged system so the operator experiences a single workflow, while the implementation still preserves the necessary boundary between durable project truth and active execution/runtime state.

### Why now?

This is the first hard architecture decision that meaningfully constrains integration. Comparative research already established that OCK is stronger on planning structure and durable workflow artifacts, while OMO is stronger on execution orchestration and runtime continuation. Without resolving the state model now, later work on commands, plan execution, handoff, and verification will either preserve split-brain behavior or create drift between `/.beads` and `/.sisyphus`.

### Who is affected?

- **Primary users:** You as the personal power user operating the merged system day-to-day
- **Secondary users:** Future agents and contributors who need one clear answer for where durable work truth lives and where active execution truth lives

---

## Scope

### In-Scope

- Define the unified state architecture for the merged OCK+OMO system
- Define the durable-versus-active state split
- Define authority rules for `/.beads` and `/.sisyphus`
- Define the canonical join key between durable work and active execution state
- Define how plans, task artifacts, continuation state, and execution notes should be classified
- Define migration principles that reduce duplicate durable truth without requiring immediate storage collapse
- Produce architecture guidance strong enough to update project charter and state tracking docs

### Out-of-Scope

- Immediate implementation of storage migration
- Refactoring runtime code to use the new model in this bead
- Deleting `/.beads` or `/.sisyphus`
- General command-surface redesign beyond what is required to describe the state model
- Solving every command/runtime integration issue outside the state architecture boundary

---

## Proposed Solution

### Overview

Define a single operator-facing state system with two explicit tiers: a **durable ledger** and an **active execution layer**. The durable ledger remains bead-backed and owns long-lived work truth such as task identity, status, dependencies, approved artifacts, handoffs, and verification evidence. The active execution layer remains sisyphus-backed and owns current run state such as plan execution, continuation markers, boulder/session lineage, runtime decomposition, and execution notes. The merged system will be documented and later implemented so users think in terms of **canonical work** and **active execution state**, not in terms of “Beads versus Sisyphus.”

### User Flow (if user-facing)

1. User creates or selects a durable work item in the unified workflow
2. Durable work records and approved artifacts live in the ledger tier
3. Execution begins and active runtime state is projected into the execution tier
4. Runtime progress, continuation, and orchestration remain active-layer concerns
5. Verified checkpoints write back into the durable ledger without creating a second durable truth source

---

## Requirements

### Functional Requirements

#### Unified State Model

The merged system must define one state model that clearly separates durable project truth from active execution truth while preserving one operator view.

**Scenarios:**

- **WHEN** the merged system describes state ownership **THEN** it must define a durable ledger tier and an active execution tier
- **WHEN** a user or agent asks where truth lives **THEN** the answer must not require subsystem-brand reasoning such as “check Beads for this and Sisyphus for that” without a higher-level model

#### Durable Ledger Authority

The durable ledger tier must be the only canonical source of truth for long-lived work records.

**Scenarios:**

- **WHEN** task identity, durable status, dependencies, approved artifacts, handoffs, or verification history are needed **THEN** the system must treat the durable ledger as authoritative
- **WHEN** active execution state disagrees with durable work state **THEN** durable state wins unless an explicit write-back checkpoint has updated it

#### Active Execution Authority

The active execution tier must own orchestration and continuation state without becoming a competing durable work ledger.

**Scenarios:**

- **WHEN** the system needs to track active plans, continuation markers, runtime task decomposition, boulder/session lineage, or execution scratch notes **THEN** that state belongs to the active layer
- **WHEN** runtime state is lost or cleared **THEN** the durable ledger must still preserve project truth and approved artifacts

#### Canonical Join Key

Durable work and active execution state must be tied together by one explicit join key.

**Scenarios:**

- **WHEN** active execution state references durable work **THEN** it must use a canonical work identifier such as `bead_id`
- **WHEN** plans, runtime tasks, or execution notes are created **THEN** they must remain traceable back to one durable work item

#### Plan Classification

The system must distinguish planning-in-progress from approved durable plans.

**Scenarios:**

- **WHEN** planning is still evolving during runtime/orchestration **THEN** that material may exist in the active layer as temporary or compatibility state
- **WHEN** a plan becomes the approved execution contract **THEN** it must settle into the durable ledger as the canonical plan artifact

#### Migration Safety

The merged system must reduce duplicate durable truth without requiring risky all-at-once storage collapse.

**Scenarios:**

- **WHEN** migration is staged **THEN** the system must preserve clear authority rules even if legacy paths still exist
- **WHEN** legacy storage remains temporarily **THEN** it must be treated as compatibility-only or derived state where appropriate, not peer truth

### Non-Functional Requirements

- **Performance:** The model must not require expensive bidirectional syncing for every runtime event
- **Security:** No new secret-bearing state should be introduced into either tier
- **Maintainability:** Operators and future agents must be able to determine the correct state layer quickly from docs and command behavior
- **Compatibility:** Transition should preserve current repo usability while authority rules are being enforced incrementally

---

## Success Criteria

- [ ] The state architecture defines one operator-facing model with explicit durable and active tiers
  - Verify: `grep -n 'durable ledger\|active execution\|operator-facing' '/work/ock-omo-system/.beads/artifacts/bd-l1s/prd.md'`
- [ ] The architecture names the canonical authority for durable task truth and active execution truth
  - Verify: `grep -n 'authoritative\|durable ledger\|active execution tier\|durable state wins' '/work/ock-omo-system/.beads/artifacts/bd-l1s/prd.md'`
- [ ] The architecture defines a join-key strategy linking active runtime state to durable work
  - Verify: `grep -n 'join key\|bead_id\|traceable back to one durable work item' '/work/ock-omo-system/.beads/artifacts/bd-l1s/prd.md'`
- [ ] The architecture defines a migration path that avoids duplicate durable truth
  - Verify: `grep -n 'migration\|compatibility-only\|duplicate durable truth' '/work/ock-omo-system/.beads/artifacts/bd-l1s/prd.md'`

---

## Technical Context

### Existing Patterns

- OCK treats `/.beads/issues.jsonl` and `/.beads/artifacts/<bead-id>/...` as durable git-backed workflow state and artifacts
- OMO treats `/.sisyphus/boulder.json`, `/.sisyphus/run-continuation/`, `/.sisyphus/tasks/`, and related files as runtime orchestration and continuation state
- OMO also uses `/.sisyphus/plans/` and `/.sisyphus/notepads/` for plan/execution scaffolding, which creates overlap risk with bead-scoped durable plan artifacts
- The architecture charter already requires one source of truth per concern and a user-facing model that does not force subsystem thinking

### Key Files

- `/work/ock-omo-system/.opencode/memory/project/project.md` - current architecture charter
- `/work/ock-omo-system/.opencode/memory/project/roadmap.md` - current roadmap and phase gates
- `/work/ock-omo-system/ock/.beads/README.md` - durable beads state framing
- `/work/ock-omo-system/ock/.beads/config.yaml` - beads persistence/source-of-truth details
- `/work/ock-omo-system/ock/.opencode/command/create.md` - bead artifact creation path
- `/work/ock-omo-system/ock/.opencode/command/plan.md` - durable plan artifact path
- `/work/ock-omo-system/ock/.opencode/command/verify.md` - durable verification stamp behavior
- `/work/ock-omo-system/omo/src/features/claude-tasks/storage.ts` - sisyphus task storage behavior
- `/work/ock-omo-system/omo/src/features/boulder-state/storage.ts` - active execution ledger behavior
- `/work/ock-omo-system/omo/src/features/run-continuation-state/storage.ts` - continuation marker persistence
- `/work/ock-omo-system/omo/src/features/builtin-commands/templates/start-work.ts` - runtime plan/boulder behavior
- `/work/ock-omo-system/omo/docs/guide/orchestration.md` - planning/execution flow in sisyphus terms

### Affected Files

Files this bead will likely modify (for conflict detection):

```yaml
files:
  - /work/ock-omo-system/.opencode/memory/project/project.md # record unified state architecture and authority rules
  - /work/ock-omo-system/.opencode/memory/project/state.md # record first resolved precedence decision and steering impact
  - /work/ock-omo-system/.opencode/memory/project/roadmap.md # update Phase 1 outputs/gates if needed
  - /work/ock-omo-system/.beads/artifacts/bd-l1s/prd.md # architecture decision PRD
  - /work/ock-omo-system/.beads/artifacts/bd-l1s/research.md # comparative research artifact for state model
  - /work/ock-omo-system/.beads/artifacts/bd-l1s/plan.md # eventual implementation/decision plan
  - /work/ock-omo-system/ock/.opencode/command/*.md # likely future command contract changes
  - /work/ock-omo-system/omo/src/features/boulder-state/* # likely future runtime-state alignment
  - /work/ock-omo-system/omo/src/features/claude-tasks/* # likely future task-state alignment
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| The system preserves dual durable truth behind nicer naming | High | High | Make durable ledger authority explicit and forbid peer durable truth in active state |
| Runtime state becomes too weak to support continuation features | Medium | High | Preserve active execution tier as first-class runtime state, not a throwaway cache |
| Plans remain duplicated across durable and active layers | High | High | Define one canonical approved plan location and downgrade the other to compatibility or active scaffolding |
| Migration becomes blocked by trying to physically merge storage too early | Medium | Medium | Adopt logical unification and authority rules before physical storage consolidation |

---

## Open Questions

| Question | Owner | Due Date | Status |
| -------- | ----- | -------- | ------ |
| Should approved plans always settle into bead artifacts, or is a façade path needed first? | Agent | 2026-04-08 | Open |
| Should `.sisyphus/tasks/` survive as execution decomposition only, or be replaced by bead-derived runtime projections? | Agent | 2026-04-08 | Open |
| What is the cleanest future operator-facing façade name, if any, for the unified state model? | Agent | 2026-04-08 | Open |

---

## Tasks

Write tasks in a machine-convertible format for `prd-task` skill.

### Produce unified state research artifact [research]

A research artifact exists that captures the durable-versus-active state split, key evidence, and first architecture recommendation for the merged system.

**Metadata:**

```yaml
depends_on: []
parallel: true
conflicts_with: []
files:
  - /work/ock-omo-system/.beads/artifacts/bd-l1s/research.md
  - /work/ock-omo-system/ock/.beads/README.md
  - /work/ock-omo-system/ock/.beads/config.yaml
  - /work/ock-omo-system/omo/src/features/claude-tasks/storage.ts
  - /work/ock-omo-system/omo/src/features/boulder-state/storage.ts
  - /work/ock-omo-system/omo/src/features/run-continuation-state/storage.ts
```

**Verification:**

- `test -f '/work/ock-omo-system/.beads/artifacts/bd-l1s/research.md'`
- `grep -n 'durable\|active execution\|bead_id\|duplicate durable truth' '/work/ock-omo-system/.beads/artifacts/bd-l1s/research.md'`

### Define state authority model [design]

A decision-quality architecture definition exists for one operator-facing state model with durable ledger and active execution tiers.

**Metadata:**

```yaml
depends_on: ["Produce unified state research artifact"]
parallel: false
conflicts_with: []
files:
  - /work/ock-omo-system/.beads/artifacts/bd-l1s/plan.md
  - /work/ock-omo-system/.opencode/memory/project/project.md
  - /work/ock-omo-system/.opencode/memory/project/state.md
```

**Verification:**

- `grep -n 'durable ledger\|active execution\|one operator-facing state model' '/work/ock-omo-system/.beads/artifacts/bd-l1s/prd.md'`
- `grep -n 'one source of truth\|precedence' '/work/ock-omo-system/.opencode/memory/project/project.md'`

### Define migration and compatibility rules [architecture]

The architecture specifies how legacy `.beads` and `.sisyphus` paths will coexist during transition without remaining peer durable truth sources.

**Metadata:**

```yaml
depends_on: ["Define state authority model"]
parallel: false
conflicts_with: []
files:
  - /work/ock-omo-system/.beads/artifacts/bd-l1s/plan.md
  - /work/ock-omo-system/.opencode/memory/project/project.md
  - /work/ock-omo-system/.opencode/memory/project/roadmap.md
  - /work/ock-omo-system/.opencode/memory/project/state.md
```

**Verification:**

- `grep -n 'migration\|compatibility-only\|transition' '/work/ock-omo-system/.beads/artifacts/bd-l1s/prd.md'`
- `grep -n 'duplicate durable truth\|compatibility-only' '/work/ock-omo-system/.opencode/memory/project/project.md'`

---

## Dependency Legend

| Field | Purpose | Example |
| ---- | ------- | ------- |
| `depends_on` | Must complete before this task starts | `["Produce unified state research artifact"]` |
| `parallel` | Can run concurrently with other parallel tasks | `true` / `false` |
| `conflicts_with` | Cannot run in parallel (same files) | `["Define state authority model"]` |
| `files` | Files this task modifies (for conflict detection) | `["/work/ock-omo-system/.opencode/memory/project/project.md"]` |

---

## Notes

This bead is intentionally separate from `bd-x0u`. `bd-x0u` concerns OMO bead/process adaptation to the OCK contract. `bd-l1s` concerns the higher-level unified state architecture decision for how the merged system should model durable versus active state and how that decision should constrain later integration work.
