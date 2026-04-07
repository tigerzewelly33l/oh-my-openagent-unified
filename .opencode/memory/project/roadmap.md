---
purpose: Artifact-driven roadmap with phase outputs and decision gates
updated: 2026-04-07
---

# Roadmap

## How to Read This Roadmap

This roadmap is artifact-driven. A phase is not complete because work happened. A phase is complete only when its required artifacts exist and its decision gate is passed.

Each phase below defines:

- **Objective**: what the phase must settle
- **Required Artifacts**: what must exist on disk or in tracked project context
- **Decision Gate**: the explicit condition for moving forward
- **Failure Signals**: signs the phase is producing motion without resolution

## Phase Overview

| Phase                        | Objective                                                                | Key Output                              | Gate                                                                       |
| ---------------------------- | ------------------------------------------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------- |
| 1. Comparative Research      | Expose overlap, conflicts, preserved strengths, and ownership candidates | Capability audit set + collision map    | Can name candidate owner for each core domain                              |
| 2. Architecture Definition   | Turn research into authority, precedence, and system-shape decisions     | Architecture charter + ownership matrix | Core domains have explicit authority and conflict rules                    |
| 3. Backbone Integration      | Build the merged backbone that enforces the chosen model                 | Unified structure and runtime backbone  | Core workflow works without split-brain behavior                           |
| 4. Workflow Convergence      | Replace parallel user flows with one default operating path              | Unified command and lifecycle flow      | User can complete real work through one default path                       |
| 5. Dogfooding and Correction | Stress the merged system through daily use and fix real friction         | Friction log + corrective changes       | Daily use is viable without fallback to old mental models                  |
| 6. Hardening and Extension   | Reduce explanation cost and prepare bounded growth                       | Cleanup pass + extension guidance       | System is easier to maintain and extend without reopening ownership fights |

---

## Phase 1: Comparative Research

**Objective:** Determine where OCK and OMO overlap, where they conflict, which strengths are non-negotiable, and where ownership is currently ambiguous.

### Required Artifacts

- OCK capability audit
- OMO capability audit
- Overlap and collision map
- Durable-versus-active state authority draft with precedence and join-key rules
- Preserved strengths list
- Candidate ownership matrix for core domains

### Required Decisions

- Which capabilities are clearly OCK-derived
- Which capabilities are clearly OMO-derived
- Which duplicated concepts are merge candidates
- Which duplicated concepts should be deprecated rather than merged
- How the durable-versus-active overlap resolves into one state authority model without skipping directly to backbone integration

### Decision Gate

Move to Phase 2 only when all of the following are true:

- [ ] Every core domain has a candidate owner
- [ ] Every major overlap has a named resolution path: keep, merge, deprecate, or re-scope
- [ ] At least one explicit precedence conflict has been documented and resolved in principle
- [ ] The project can state what the merged system actually is in one paragraph without describing it as “OCK plus OMO”

### Failure Signals

- Research keeps expanding without narrowing decisions
- Findings describe similarities but not authority
- New implementation ideas appear before ownership is settled

---

## Phase 2: Architecture Definition

**Objective:** Convert research findings into the governing rules of the merged system.

### Required Artifacts

- Updated `project.md` as the architecture charter
- Ownership and authority matrix
- Precedence rule set
- Project-level non-goals list
- Integration boundary notes for planning, execution, memory, commands, and provider/runtime concerns

### Required Decisions

- Final authority per core domain
- What counts as compatibility-only behavior
- Which legacy concepts are retired, renamed, or absorbed
- How personal utility acts as a tie-break rule in design choices

### Decision Gate

Move to Phase 3 only when all of the following are true:

- [ ] Each core domain has one explicit final owner
- [ ] Precedence rules exist for inherited conflicts
- [ ] Non-goals are explicit enough to reject tempting side paths
- [ ] Architecture language describes one system, not two coordinated subsystems
- [ ] The next implementation wave can point to the charter instead of re-arguing ownership

### Failure Signals

- “Unified” language exists without any enforcement rules
- Ownership is described as shared for permanent domains
- The architecture still requires the user to know legacy boundaries

---

## Phase 3: Backbone Integration

**Objective:** Implement the structural and runtime backbone that makes the architectural decisions real.

### Required Artifacts

- Unified project backbone changes
- Merged or deprecated duplicate subsystem paths
- Updated command/runtime integration notes
- Verification evidence showing the backbone works as designed

### Required Decisions

- Which legacy surfaces remain temporarily for migration
- Which compatibility shims are acceptable and for how long
- Which old paths are now forbidden for new work

### Decision Gate

Move to Phase 4 only when all of the following are true:

- [ ] The backbone enforces the chosen ownership model in practice
- [ ] Core planning-to-execution flow no longer depends on separate subsystem reasoning
- [ ] Duplicate structural homes for the same concern are removed or clearly transitional
- [ ] Verification proves the backbone is runnable and stable enough for workflow work

### Failure Signals

- Implementation preserves both systems intact under new labels
- New glue code increases, but ownership remains ambiguous
- Users still need to choose between two valid starting points

---

## Phase 4: Workflow Convergence

**Objective:** Collapse parallel user flows into one default lifecycle for planning, execution, verification, and follow-through.

### Required Artifacts

- Unified workflow definition
- Command surface map with primary path and deprecated path list
- Updated planning and execution lifecycle docs
- Proof run of at least one end-to-end task using the default path only

### Required Decisions

- Default task entry point
- Default planning artifact path
- Default execution and verification path
- Which old commands remain only as migration helpers

### Decision Gate

Move to Phase 5 only when all of the following are true:

- [ ] One default path exists for real work
- [ ] Duplicate workflow entry points are removed or demoted
- [ ] The user can complete a task without switching vocabulary or process models midway
- [ ] Planning artifacts, execution behavior, and verification gates line up cleanly

### Failure Signals

- “Flexible” workflow language masks unresolved duplication
- Different tasks still require different inherited mental models
- Default path exists on paper but not in actual usage

---

## Phase 5: Dogfooding and Correction

**Objective:** Use the merged system for real work until friction, missing rules, and weak spots are exposed by practice.

### Required Artifacts

- Dogfooding log covering real tasks
- Friction and failure inventory
- Corrective change set
- Updated state and charter notes for any rule changes discovered through use

### Required Decisions

- Which pain points are isolated bugs
- Which pain points expose architectural weakness
- Which rules need tightening versus simplification

### Decision Gate

Move to Phase 6 only when all of the following are true:

- [ ] Daily personal use is possible without routine fallback to legacy habits
- [ ] Major friction points are documented with actual examples
- [ ] Corrections reduce confusion instead of adding more exception paths
- [ ] The system can be trusted for repeated personal use

### Failure Signals

- Dogfooding happens, but no failures are recorded
- Work silently falls back to old tools or old mental models
- Fixes accumulate as exceptions instead of simplifications

---

## Phase 6: Hardening and Extension

**Objective:** Reduce maintenance burden, tighten naming and docs, and prepare for bounded extension without reopening the core architecture.

### Required Artifacts

- Naming and documentation cleanup pass
- Extension guidance with protected boundaries
- Explicit list of stable versus experimental areas
- Final maintenance notes for future changes

### Required Decisions

- Which extension points are safe
- Which boundaries are closed unless architecture work is reopened
- Which internal concepts must stay hidden from normal users

### Decision Gate

This phase is complete only when all of the following are true:

- [ ] The system is easier to explain because the architecture is clearer, not because details were removed
- [ ] Extension guidance does not reintroduce split ownership
- [ ] Stable boundaries are documented well enough to protect the merged core
- [ ] Future work can start from one system model

### Failure Signals

- Cleanup reopens earlier ownership debates
- Extension language is broad enough to justify duplicate systems again
- Documentation becomes polished but less operational

---

## Current Roadmap Position

**Active Phase:** Phase 1, Comparative Research  
**Next Required Output:** Candidate ownership matrix and overlap/collision map derived from the new state authority draft
**Do Not Start Yet:** Backbone integration or workflow merging without Phase 1 gate evidence

---

_Update this file when phase outputs, gates, or failure signals materially change._
_If a phase cannot pass its gate, reflect that honestly in `state.md` instead of advancing by optimism._
