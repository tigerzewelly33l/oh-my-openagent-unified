# Beads PRD Template

**Bead:** bd-l1s  
**Created:** 2026-04-08  
**Status:** Draft

## Bead Metadata

```yaml
depends_on: []
parallel: true
conflicts_with: []
blocks: []
estimated_hours: 12
```

---

## Problem Statement

### What problem are we solving?

The current merged OCK+OMO repo contains architecture, roadmap, and state documents that already claim Phase 2 completion and Phase 3 readiness, but the hard-reset plan requires those claims to be treated as hypotheses until they are revalidated against current repository evidence. Without a bead-scoped PRD for that reset, `bd-l1s` cannot be started against a zero-trust research contract, and later architecture or runtime work would keep inheriting conclusion-heavy documents as if they were proof.

### Why now?

This work is needed now because the user explicitly redirected the project back to Phase 1 with a hard reset plus a Phase 2 handoff gate. The cost of inaction is false certainty: implementation or architecture work would continue from unverified ownership, precedence, and workflow claims instead of evidence-backed audits.

### Who is affected?

- **Primary users:** The project owner using `bd-l1s` to reset the merged system’s authority model before more runtime work.
- **Secondary users:** Future agents or contributors who need a durable, bead-scoped reset package instead of relying on inherited governance claims.

---

## Scope

### In-Scope

- Produce a zero-trust Phase 1 reset package under `.beads/artifacts/bd-l1s/phase-1-reset/`.
- Create the quarantine protocol, evidence register, six evidence-backed audit artifacts, one conflict/authority synthesis artifact, and one explicit Phase 2 handoff gate memo.
- Capture verification evidence under `.sisyphus/evidence/task-*-*.txt` for each task.
- Re-audit authority and contradictions from current repository evidence across commands, state, planning, memory/context, configuration, and verification/write-back behavior.

### Out-of-Scope

- Implementing command/runtime enforcement or any other Phase 3 backbone work.
- Rewriting `.opencode/memory/project/project.md`, `roadmap.md`, or `state.md` as part of this bead.
- Declaring the final architecture model before the domain audits and synthesis artifacts exist.
- Treating generated `dist/` mirrors as primary evidence when source files are present.

---

## Proposed Solution

### Overview

Create a research-only PRD for `bd-l1s` that forces the reset to run from repository evidence outward. The bead will generate a phased set of markdown artifacts that first quarantine inherited claims, then inventory trustworthy evidence, then audit each authority domain independently, and finally synthesize contradictions into a blocking-vs-non-blocking gate that determines whether Phase 2 architecture definition may resume.

### User Flow (if user-facing)

1. Start `bd-l1s` using the bead workflow once `prd.md` exists.
2. Produce the Wave 1 reset protocol and evidence register.
3. Produce the Wave 2 domain audits from current repo evidence only.
4. Produce the Wave 3 contradiction map and Phase 2 handoff gate.
5. Use the gate memo to decide whether architecture definition may restart.

---

## Requirements

### Functional Requirements

#### Zero-trust reset protocol

The bead must create a governing reset artifact that distinguishes evidence from claims, defines source-of-truth precedence, and quarantines inherited project-memory files from truth status.

**Scenarios:**

- **WHEN** the reset begins **THEN** `.opencode/memory/project/project.md`, `roadmap.md`, and `state.md` are treated as hypothesis sources rather than primary evidence.
- **WHEN** later audit artifacts are written **THEN** they must use one consistent schema with `Question`, `Current Behavior`, `Claimed Behavior`, `Evidence`, `Contradictions`, `Authority Candidates`, `Unresolved Questions`, `Confidence`, and `Gate Impact`.

#### Evidence-backed authority audits

The bead must produce separate audits for command authority, state authority, planning ownership, memory/context ownership, config precedence, and verification/write-back authority.

**Scenarios:**

- **WHEN** an audit makes a claim about current behavior **THEN** it cites current source or durable repo files rather than inherited conclusions.
- **WHEN** an audit encounters ambiguity **THEN** it records contradictions and unresolved questions instead of collapsing them into final authority.

#### Cross-domain contradiction synthesis

The bead must create one synthesis artifact that distinguishes clearly OCK-owned, clearly OMO-owned, genuinely split, and still-ambiguous concerns.

**Scenarios:**

- **WHEN** the domain audits disagree **THEN** the contradiction map records the conflict explicitly rather than smoothing it over.
- **WHEN** authority is still ambiguous **THEN** the synthesis artifact labels that ambiguity and its gate impact.

#### Explicit Phase 2 handoff gate

The bead must end with a gate memo that separates blockers from tolerable open questions and states when Phase 2 may begin again.

**Scenarios:**

- **WHEN** blocking contradictions remain **THEN** the gate memo prevents Phase 2 from being treated as ready.
- **WHEN** only non-blocking questions remain **THEN** the gate memo can permit Phase 2 with those questions documented.

### Non-Functional Requirements

- **Performance:** Research must stay bounded to the ten specified artifacts and their verification evidence rather than expanding into redesign or implementation.
- **Security:** No credentials, production secrets, or unrelated environments are needed for this documentation-only bead.
- **Accessibility:** Not applicable for this research artifact.
- **Compatibility:** The bead must fit the existing workflow contract in `.opencode/command/create.md`, `.opencode/command/start.md`, and `.opencode/command/plan.md`.

---

## Success Criteria

- [ ] All ten reset deliverables exist under `.beads/artifacts/bd-l1s/phase-1-reset/`.
  - Verify: `for f in 00-reset-rules-and-quarantine.md 01-evidence-register.md 02-command-authority-audit.md 03-state-authority-audit.md 04-planning-ownership-audit.md 05-memory-context-audit.md 06-config-precedence-audit.md 07-verification-writeback-audit.md 08-conflict-authority-map.md 09-phase-2-handoff-gate.md; do test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/$f || exit 1; done`
- [ ] The reset protocol explicitly quarantines inherited governance docs and defines source-of-truth precedence.
  - Verify: `grep -nE "Quarantined Files|Source-of-Truth Precedence|\.opencode/memory/project/project\.md|\.opencode/memory/project/roadmap\.md|\.opencode/memory/project/state\.md" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/00-reset-rules-and-quarantine.md`
- [ ] The evidence register distinguishes current observed evidence from historical or hypothesis-only inputs.
  - Verify: `grep -nE "Observed / Inferred / Proposed|Historical Inputs \(Raw Only\)|Quarantined Artifacts|Precedence Order" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/01-evidence-register.md`
- [ ] The contradiction synthesis artifact contains explicit blocking contradictions and authority grouping.
  - Verify: `grep -nE "Blocking Contradictions|Clearly OCK|Clearly OMO|Genuinely Split|Still Ambiguous" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/08-conflict-authority-map.md`
- [ ] The handoff gate memo states the explicit condition for restarting Phase 2.
  - Verify: `grep -F "Phase 2 may begin only when" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/09-phase-2-handoff-gate.md`
- [ ] Task-level evidence captures exist for the reset work.
  - Verify: `find /work/ock-omo-system/.sisyphus/evidence -maxdepth 1 -type f -name 'task-*-*.txt' | grep 'task-'`

---

## Technical Context

### Existing Patterns

- Pattern 1: `.sisyphus/plans/phase-1-hard-reset.md` - The authoritative reset specification with ten tasks, dependency waves, guardrails, and verification commands.
- Pattern 2: `.opencode/command/create.md` - Defines the duplicate-check and PRD requirements that led this work to continue on existing bead `bd-l1s` instead of creating a new bead.
- Pattern 3: `.opencode/command/start.md` - Shows that `bd-l1s` needs `prd.md` before the bead can be started through the normal workflow.
- Pattern 4: `.opencode/command/plan.md` - Confirms PRD-backed planning is optional after start, not a substitute for the PRD itself.
- Pattern 5: `.opencode/memory/project/project.md`, `.opencode/memory/project/roadmap.md`, and `.opencode/memory/project/state.md` - Existing governance/state documents whose conclusion-heavy claims are the direct quarantine targets of this reset.
- Pattern 6: `.beads/issues.jsonl` - Durable ledger proving `bd-l1s` already exists and should own the reset artifacts.

### Key Files

- `.sisyphus/plans/phase-1-hard-reset.md` - Primary task spec for this PRD.
- `.beads/issues.jsonl` - Durable bead ledger containing `bd-l1s`.
- `.opencode/memory/project/project.md` - Current architecture charter to quarantine as hypothesis input.
- `.opencode/memory/project/roadmap.md` - Current phase/gate roadmap to quarantine as hypothesis input.
- `.opencode/memory/project/state.md` - Current steering state to quarantine as hypothesis input.
- `.opencode/command/create.md` - Workflow contract for duplicate handling and PRD creation.
- `.opencode/command/start.md` - Workflow contract requiring `prd.md` before active work.
- `.opencode/command/plan.md` - Optional deeper planning stage after start.
- `omo/src/plugin-handlers/command-config-handler.ts` - Referenced command registration and precedence evidence.
- `omo/src/tools/slashcommand/command-discovery.ts` - Referenced visible command authority evidence.
- `omo/src/features/background-agent/state.ts` - Referenced active runtime state evidence.
- `omo/src/cli/run/continuation-state.ts` - Referenced continuation-state evidence.
- `omo/src/features/context-injector/injector.ts` - Referenced runtime context injection evidence.
- `omo/src/features/boulder-state/storage.ts` - Referenced active planning/state storage evidence.
- `omo/src/plugin-config.ts` - Referenced config precedence evidence.
- `ock/src/commands/init.ts` - Referenced OCK scaffolding/config baseline evidence.
- `ock/src/commands/command.ts` - Referenced OCK command-shape evidence.
- `ock/.opencode/plugin/memory.ts` - Referenced durable memory baseline evidence.

### Affected Files

Files this bead will modify (for conflict detection):

```yaml
files:
  - .beads/artifacts/bd-l1s/prd.md # Durable reset specification for the existing epic
  - .beads/artifacts/bd-l1s/phase-1-reset/00-reset-rules-and-quarantine.md # Reset protocol and quarantine rules
  - .beads/artifacts/bd-l1s/phase-1-reset/01-evidence-register.md # Canonical evidence inventory and precedence rubric
  - .beads/artifacts/bd-l1s/phase-1-reset/02-command-authority-audit.md # Command authority audit
  - .beads/artifacts/bd-l1s/phase-1-reset/03-state-authority-audit.md # Durable-vs-active state audit
  - .beads/artifacts/bd-l1s/phase-1-reset/04-planning-ownership-audit.md # Planning ownership audit
  - .beads/artifacts/bd-l1s/phase-1-reset/05-memory-context-audit.md # Memory and context ownership audit
  - .beads/artifacts/bd-l1s/phase-1-reset/06-config-precedence-audit.md # Config and integration precedence audit
  - .beads/artifacts/bd-l1s/phase-1-reset/07-verification-writeback-audit.md # Verification and write-back authority audit
  - .beads/artifacts/bd-l1s/phase-1-reset/08-conflict-authority-map.md # Cross-domain contradiction synthesis
  - .beads/artifacts/bd-l1s/phase-1-reset/09-phase-2-handoff-gate.md # Phase 2 restart gate memo
  - .sisyphus/evidence/task-*-*.txt # Verification evidence captures for each task
```

---

## Risks & Mitigations

| Risk                                                                            | Likelihood | Impact | Mitigation                                                                                               |
| ------------------------------------------------------------------------------- | ---------- | ------ | -------------------------------------------------------------------------------------------------------- |
| The reset accidentally preserves inherited project-memory claims as evidence    | Medium     | High   | Require explicit quarantine language and source-of-truth precedence before any domain audit begins       |
| Domain audits drift into redesign or implementation                             | Medium     | High   | Keep every task research-only, artifact-scoped, and backed by verification commands                      |
| Cross-domain contradictions get smoothed into vague prose                       | Medium     | High   | Require a dedicated contradiction map with blocking vs non-blocking split and explicit ambiguity buckets |
| Future work treats generated or mirrored files as peer evidence to source files | Medium     | Medium | State in scope and task verification that generated `dist/` mirrors remain secondary when source exists  |

---

## Open Questions

No blocking open questions remain at PRD creation time. Any unresolved repository ambiguity discovered during execution must be recorded inside the audit artifacts and carried forward into `08-conflict-authority-map.md` and `09-phase-2-handoff-gate.md` rather than reopening the spec.

---

## Tasks

Write tasks in a machine-convertible format for `prd-task` skill.

### Establish zero-trust reset protocol [writing]

`.beads/artifacts/bd-l1s/phase-1-reset/00-reset-rules-and-quarantine.md` exists with quarantine rules, evidence-versus-claims framing, source-of-truth precedence, and the mandatory audit schema that governs every later artifact.

**Metadata:**

```yaml
depends_on: []
parallel: false
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/00-reset-rules-and-quarantine.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/00-reset-rules-and-quarantine.md`
- `grep -F "Evidence vs Claims" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/00-reset-rules-and-quarantine.md`
- `grep -F "Source-of-Truth Precedence" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/00-reset-rules-and-quarantine.md`
- `grep -F "Audit Schema" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/00-reset-rules-and-quarantine.md`

### Build evidence register and precedence rubric [deep]

`.beads/artifacts/bd-l1s/phase-1-reset/01-evidence-register.md` exists as the canonical inventory of runtime, durable, historical, and quarantined inputs with explicit proof limits and precedence order.

**Metadata:**

```yaml
depends_on:
  - Establish zero-trust reset protocol
parallel: false
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/01-evidence-register.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/01-evidence-register.md`
- `grep -F "Observed / Inferred / Proposed" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/01-evidence-register.md`
- `grep -F "Quarantined Artifacts" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/01-evidence-register.md`
- `grep -F "Precedence Order" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/01-evidence-register.md`

### Audit command authority and workflow-root precedence [ultrabrain]

`.beads/artifacts/bd-l1s/phase-1-reset/02-command-authority-audit.md` exists and distinguishes visible command authority from executable precedence without collapsing them into one claim.

**Metadata:**

```yaml
depends_on:
  - Establish zero-trust reset protocol
  - Build evidence register and precedence rubric
parallel: true
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/02-command-authority-audit.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/02-command-authority-audit.md`
- `grep -F "Visible Command Authority" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/02-command-authority-audit.md`
- `grep -F "Execution Command Authority" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/02-command-authority-audit.md`
- `grep -F "Conflict Matrix" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/02-command-authority-audit.md`

### Audit state authority: durable truth vs active runtime truth [ultrabrain]

`.beads/artifacts/bd-l1s/phase-1-reset/03-state-authority-audit.md` exists and shows where durable truth, active runtime truth, join-key evidence, and shadow overlap actually live.

**Metadata:**

```yaml
depends_on:
  - Establish zero-trust reset protocol
  - Build evidence register and precedence rubric
parallel: true
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/03-state-authority-audit.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/03-state-authority-audit.md`
- `grep -F "Durable Truth Inventory" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/03-state-authority-audit.md`
- `grep -F "Active Runtime Truth Inventory" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/03-state-authority-audit.md`
- `grep -F "Join-Key Evidence" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/03-state-authority-audit.md`

### Audit planning ownership vs runtime planning behavior [deep]

`.beads/artifacts/bd-l1s/phase-1-reset/04-planning-ownership-audit.md` exists and separates durable planning artifacts from runtime planning behavior and plan-meaning collisions.

**Metadata:**

```yaml
depends_on:
  - Establish zero-trust reset protocol
  - Build evidence register and precedence rubric
parallel: true
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/04-planning-ownership-audit.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/04-planning-ownership-audit.md`
- `grep -F "Durable Plan Artifact" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/04-planning-ownership-audit.md`
- `grep -F "Runtime Planning Behavior" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/04-planning-ownership-audit.md`
- `grep -F "Plan Meaning Collisions" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/04-planning-ownership-audit.md`

### Audit memory and context ownership [deep]

`.beads/artifacts/bd-l1s/phase-1-reset/05-memory-context-audit.md` exists and distinguishes durable memory storage from runtime injection, collection, transformation, and mutation risk.

**Metadata:**

```yaml
depends_on:
  - Establish zero-trust reset protocol
  - Build evidence register and precedence rubric
parallel: true
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/05-memory-context-audit.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/05-memory-context-audit.md`
- `grep -F "Durable Memory Storage" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/05-memory-context-audit.md`
- `grep -F "Runtime Context Injection" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/05-memory-context-audit.md`
- `grep -F "Transformation and Collection" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/05-memory-context-audit.md`

### Audit configuration and integration precedence [deep]

`.beads/artifacts/bd-l1s/phase-1-reset/06-config-precedence-audit.md` exists and documents config sources, merge behavior, compatibility layers, and current runtime wiring.

**Metadata:**

```yaml
depends_on:
  - Establish zero-trust reset protocol
  - Build evidence register and precedence rubric
parallel: true
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/06-config-precedence-audit.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/06-config-precedence-audit.md`
- `grep -F "Config Sources" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/06-config-precedence-audit.md`
- `grep -F "Merge / Precedence Behavior" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/06-config-precedence-audit.md`
- `grep -F "Compatibility Layers" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/06-config-precedence-audit.md`

### Audit verification and write-back authority [deep]

`.beads/artifacts/bd-l1s/phase-1-reset/07-verification-writeback-audit.md` exists and explains where verification runs, where approval-relevant evidence writes back, where shadow authority appears, and what that means for the Phase 2 gate.

**Metadata:**

```yaml
depends_on:
  - Establish zero-trust reset protocol
  - Build evidence register and precedence rubric
parallel: true
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/07-verification-writeback-audit.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/07-verification-writeback-audit.md`
- `grep -F "Question" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/07-verification-writeback-audit.md`
- `grep -F "Authority Candidates" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/07-verification-writeback-audit.md`
- `grep -F "Gate Impact" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/07-verification-writeback-audit.md`

### Build cross-domain contradiction and authority map [ultrabrain]

`.beads/artifacts/bd-l1s/phase-1-reset/08-conflict-authority-map.md` exists and synthesizes all domain audits into clearly OCK, clearly OMO, genuinely split, and still ambiguous buckets with explicit blocking contradictions.

**Metadata:**

```yaml
depends_on:
  - Audit command authority and workflow-root precedence
  - Audit state authority: durable truth vs active runtime truth
  - Audit planning ownership vs runtime planning behavior
  - Audit memory and context ownership
  - Audit configuration and integration precedence
  - Audit verification and write-back authority
parallel: false
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/08-conflict-authority-map.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/08-conflict-authority-map.md`
- `grep -F "Blocking Contradictions" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/08-conflict-authority-map.md`
- `grep -F "Clearly OCK" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/08-conflict-authority-map.md`
- `grep -F "Still Ambiguous" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/08-conflict-authority-map.md`

### Write the Phase 2 handoff gate memo [writing]

`.beads/artifacts/bd-l1s/phase-1-reset/09-phase-2-handoff-gate.md` exists and states exactly which contradictions block Phase 2 and the explicit condition under which Phase 2 may begin again.

**Metadata:**

```yaml
depends_on:
  - Build cross-domain contradiction and authority map
parallel: false
conflicts_with: []
files:
  - .beads/artifacts/bd-l1s/phase-1-reset/09-phase-2-handoff-gate.md
```

**Verification:**

- `test -f /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/09-phase-2-handoff-gate.md`
- `grep -F "Phase 2 may begin only when" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/09-phase-2-handoff-gate.md`
- `grep -F "Blocking" /work/ock-omo-system/.beads/artifacts/bd-l1s/phase-1-reset/09-phase-2-handoff-gate.md`

---

## Notes

This PRD exists only to attach the hard-reset Phase 1 specification to the already-existing epic `bd-l1s`. It does not authorize implementation work beyond creating the reset research artifacts and their verification evidence.
