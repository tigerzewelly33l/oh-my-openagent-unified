# Beads PRD Template

**Bead:** bd-b6a  
**Created:** 2026-04-08  
**Status:** Draft

## Bead Metadata

```yaml
depends_on: []
parallel: true
conflicts_with: []
blocks: []
estimated_hours: 4
```

---

## Problem Statement

### What problem are we solving?

The merged OCK+OMO project needs a grounded Phase 1 comparative-research baseline before later architecture or runtime enforcement work can be trusted. Right now the repo contains planning files, workflow commands, plugin/runtime code, and existing architecture beads, but without a fresh Phase 1 bead the comparative-research outputs are not packaged as one explicit research contract that can be started, reviewed, and traced through the bead workflow.

### Why now?

This work is needed now because later phases depend on clear evidence about where OCK and OMO overlap, where durable versus active state boundaries actually exist, and which concerns should remain owned by each side of the merged system. The cost of skipping this step is architecture drift: implementation work could encode stale assumptions or preserve duplicate authority under new names.

### Who is affected?

- **Primary users:** The project owner using the merged OCK+OMO workflow to plan and ship work.
- **Secondary users:** Future agents or contributors who need a durable, bead-scoped research contract before doing architecture or backbone implementation.

---

## Scope

### In-Scope

- Produce a bead-scoped Phase 1 comparative-research contract for the OCK+OMO merger effort.
- Capture the required Phase 1 artifacts named in `.opencode/memory/project/roadmap.md`.
- Ground the research in real command, plugin, memory, and workflow surfaces already present in the repo.
- Define the specific questions Phase 1 must answer before later architecture and integration work proceeds.

### Out-of-Scope

- Implementing Phase 2 or Phase 3 runtime changes.
- Editing command/runtime code to enforce the ownership model.
- Retiring legacy commands or changing workflow behavior.
- Writing implementation plans for backbone integration beyond what Phase 1 needs to feed later work.

---

## Proposed Solution

### Overview

Create a Phase 1 comparative-research epic whose PRD defines the exact research outputs, evidence sources, and success criteria needed to compare OCK and OMO cleanly. The result is a durable bead artifact that can drive `/start`, `/research`, and later planning work without jumping ahead into implementation.

### User Flow (if user-facing)

1. Create a Phase 1 comparative-research bead from the roadmap-defined scope.
2. Start the bead and perform bounded research across commands, plugins, memory, and workflow artifacts.
3. Use the resulting research outputs to inform later ownership and backbone decisions.

---

## Requirements

### Functional Requirements

#### Phase 1 artifact contract

The PRD must enumerate the comparative-research artifacts required by the current roadmap and state files.

**Scenarios:**

- **WHEN** the bead is started **THEN** the assigned work must clearly include the OCK capability audit, OMO capability audit, overlap and collision map, durable-versus-active state authority draft, preserved strengths list, candidate ownership matrix, and command/runtime implementation notes.
- **WHEN** a future agent reads the PRD **THEN** it must understand that this bead is research-only and not runtime implementation work.

#### Repo-grounded evidence sources

The PRD must anchor the research in real repository surfaces rather than abstract product language.

**Scenarios:**

- **WHEN** the research is executed **THEN** it must inspect actual workflow command files under `.opencode/command/` and runtime/plugin files under `.opencode/plugin/`.
- **WHEN** the research discusses memory, command authority, or plugin behavior **THEN** it must cite real file paths from the repository.

#### Phase boundary discipline

The PRD must prevent premature implementation and keep this bead inside comparative research.

**Scenarios:**

- **WHEN** research findings suggest later implementation work **THEN** those findings must be framed as inputs for later beads rather than implemented immediately.
- **WHEN** the bead is reviewed **THEN** it must be possible to distinguish Phase 1 research outputs from Phase 2 architecture decisions and Phase 3 backbone changes.

### Non-Functional Requirements

- **Performance:** Research should stay bounded to the highest-value overlap and authority questions rather than becoming open-ended exploration.
- **Security:** No credentials or secret-bearing files should be required for this research scope.
- **Accessibility:** Not applicable for this research artifact.
- **Compatibility:** Outputs must align with the existing bead workflow: `/create` → `/start` → `/ship`.

---

## Success Criteria

- [ ] The bead PRD explicitly lists every required Phase 1 artifact from the current roadmap.
  - Verify: `grep -n "OCK capability audit\|OMO capability audit\|overlap and collision map\|durable-versus-active\|preserved strengths\|candidate ownership matrix\|command/runtime" /work/ock-omo-system/.beads/artifacts/bd-b6a/prd.md`
- [ ] The PRD references real repository files for commands, plugins, and project memory that will ground the research.
  - Verify: `grep -n "\.opencode/memory/project/roadmap.md\|\.opencode/memory/project/state.md\|\.opencode/command/create.md\|\.opencode/command/start.md\|\.opencode/command/ship.md\|\.opencode/plugin/README.md" /work/ock-omo-system/.beads/artifacts/bd-b6a/prd.md`
- [ ] The PRD makes Phase 1 explicitly research-only and excludes Phase 2/3 implementation work.
  - Verify: `grep -n "research-only\|Out-of-Scope\|Implementing Phase 2 or Phase 3 runtime changes" /work/ock-omo-system/.beads/artifacts/bd-b6a/prd.md`

---

## Technical Context

### Existing Patterns

- Pattern 1: `.opencode/command/create.md` - Defines the spec-first workflow and PRD expectations for new beads.
- Pattern 2: `.opencode/command/start.md` - Shows that beads must carry `prd.md` before work begins.
- Pattern 3: `.opencode/command/ship.md` - Confirms later execution is gated by bead artifacts and verification.
- Pattern 4: `.opencode/plugin/README.md` - Summarizes the current runtime/plugin surfaces the research must evaluate.
- Pattern 5: `.opencode/memory/project/roadmap.md` - Names the required Phase 1 artifacts and decision gate.
- Pattern 6: `.opencode/memory/project/state.md` - Shows the currently claimed project position and the open questions that later work depends on.

### Key Files

- `.opencode/memory/project/roadmap.md` - Source of the formal Phase 1 artifact list and decision gate.
- `.opencode/memory/project/state.md` - Source of the current steering position, blockers, and open questions.
- `.opencode/command/create.md` - Workflow contract for bead creation and PRD generation.
- `.opencode/command/start.md` - Workflow contract for moving a bead from PRD to active work.
- `.opencode/command/ship.md` - Workflow contract for later execution and verification.
- `.opencode/plugin/README.md` - Map of the current plugin/runtime surface relevant to OMO-side responsibilities.

### Affected Files

Files this bead will modify (for conflict detection):

```yaml
files:
  - .beads/artifacts/bd-b6a/prd.md # Durable Phase 1 research contract for this bead
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| The bead duplicates existing architecture work without clarifying phase boundaries | Medium | Medium | Keep the scope explicitly on comparative research artifacts and exclude implementation or final ownership enforcement |
| The PRD drifts into vague architecture prose instead of repo-grounded evidence gathering | Medium | High | Require concrete file-path evidence from commands, plugins, and project memory |
| Later work treats this bead as implementation-ready without finishing research outputs | Medium | High | Define research-only scope and explicit success criteria tied to artifact production |

---

## Open Questions

| Question | Owner | Due Date | Status |
| -------- | ----- | -------- | ------ |
| Which surviving workflow surfaces are true OCK-owned roots versus OMO compatibility layers at Phase 1 evidence level? | Unassigned | 2026-04-08 | Open |
| Does the current durable-versus-active state framing still match the actual runtime/plugin behavior in the repository? | Unassigned | 2026-04-08 | Open |
| Which overlaps are clean merge candidates versus deprecation candidates before Phase 2 authority decisions? | Unassigned | 2026-04-08 | Open |

---

## Tasks

Write tasks in a machine-convertible format for `prd-task` skill.

### Produce OCK capability audit [research]

A bead-scoped audit exists that identifies OCK-owned planning, structure, memory, workflow, and verification strengths relevant to the merged system.

**Metadata:**

```yaml
depends_on: []
parallel: true
conflicts_with: []
files:
  - .beads/artifacts/bd-b6a/research.md
```

**Verification:**

- `grep -n "OCK capability audit" /work/ock-omo-system/.beads/artifacts/bd-b6a/research.md`
- `grep -n "planning\|structure\|memory\|workflow" /work/ock-omo-system/.beads/artifacts/bd-b6a/research.md`

### Produce OMO capability audit [research]

A bead-scoped audit exists that identifies OMO-owned execution, orchestration, runtime, context, and verification strengths relevant to the merged system.

**Metadata:**

```yaml
depends_on: []
parallel: true
conflicts_with: []
files:
  - .beads/artifacts/bd-b6a/research.md
```

**Verification:**

- `grep -n "OMO capability audit" /work/ock-omo-system/.beads/artifacts/bd-b6a/research.md`
- `grep -n "execution\|orchestration\|runtime\|verification" /work/ock-omo-system/.beads/artifacts/bd-b6a/research.md`

### Produce overlap and state-boundary map [research]

A bead-scoped research output exists that explains overlap/collision areas and the durable-versus-active state boundary with precedence and join-key reasoning.

**Metadata:**

```yaml
depends_on:
  - Produce OCK capability audit
  - Produce OMO capability audit
parallel: false
conflicts_with: []
files:
  - .beads/artifacts/bd-b6a/research.md
```

**Verification:**

- `grep -n "overlap and collision map\|durable-versus-active\|join-key\|precedence" /work/ock-omo-system/.beads/artifacts/bd-b6a/research.md`

### Produce candidate ownership and preserved-strengths output [research]

A bead-scoped research output exists that names preserved strengths from each side and proposes candidate ownership for core domains without moving into final implementation enforcement.

**Metadata:**

```yaml
depends_on:
  - Produce overlap and state-boundary map
parallel: false
conflicts_with: []
files:
  - .beads/artifacts/bd-b6a/research.md
```

**Verification:**

- `grep -n "preserved strengths\|candidate ownership matrix" /work/ock-omo-system/.beads/artifacts/bd-b6a/research.md`

### Produce runtime-enforcement input notes [research]

A bead-scoped note set exists that captures the command/runtime observations Phase 3 will later need, without implementing those changes in this bead.

**Metadata:**

```yaml
depends_on:
  - Produce candidate ownership and preserved-strengths output
parallel: false
conflicts_with: []
files:
  - .beads/artifacts/bd-b6a/research.md
```

**Verification:**

- `grep -n "command/runtime implementation notes\|backbone\|Phase 3" /work/ock-omo-system/.beads/artifacts/bd-b6a/research.md`

---

## Notes

This bead is intentionally scoped to Phase 1 comparative research even though other project files claim later phases are already active. The purpose of this bead is to give Phase 1 its own fresh, durable spec artifact under the current workflow rather than assuming earlier conclusions are sufficient without a dedicated `/create` output.
