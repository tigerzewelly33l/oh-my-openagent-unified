---
purpose: Architecture charter for the merged OCK+OMO system
updated: 2026-04-07
---

# OCK + OMO Architecture Charter

## What This Project Is

OCK + OMO is not a bridge between two tools. It is a single operating system for AI-assisted development.

The target system combines:

- **OCK strengths** for structure, templates, planning artifacts, and workflow discipline
- **OMO strengths** for execution, orchestration, agent delegation, verification, and implementation throughput

The end state is one system with one mental model, one command surface, one authority model, and one default way to move from idea to verified change.

## Charter Goal

Build a merged system that lets one personal power user plan, implement, verify, and iterate without having to decide whether a task belongs to “OCK mode” or “OMO mode.”

## Operational One-System Description

The merged system should operate as one bead-backed workflow shell with one execution runtime beneath it: the user enters through a single project command surface, planning artifacts and approved work truth settle into `/.beads`, OMO-owned execution and verification machinery runs against that durable contract, and `/.sisyphus` carries only active orchestration state keyed back to durable work through `bead_id`. In daily use, the operator should experience one lifecycle from task creation through verified delivery rather than a handoff between legacy subsystem identities.

## Authority Model

This project must assign one clear owner to each concern. Shared responsibility is allowed only during transition, never as the final state.

### Ownership Domains

These are the approved final owners for the merged system's core domains. Compatibility behavior may survive during transition, but it does not change domain authority.

| Domain                           | Final Owner                   | What That Means                                                                                   |
| -------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Planning artifacts               | OCK side of the merged system | PRDs, approved plans, research notes, roadmap/state framing, and other durable planning artifacts |
| Project structure                | OCK side of the merged system | Template layout, default folders, artifact placement, and project scaffolding rules               |
| Durable project memory           | OCK side of the merged system | Repo-local durable memory files, injected project context, and long-lived project knowledge       |
| Project workflow command surface | OCK side of the merged system | The primary user-facing lifecycle commands and bead-backed workflow definitions                   |
| Execution engine                 | OMO side of the merged system | Task execution, code changes, implementation loops, and tool-driven completion                    |
| Agent orchestration              | OMO side of the merged system | Subagents, delegation, parallel work, review passes, and coordination rules                       |
| Verification runtime             | OMO side of the merged system | Typecheck, lint, tests, build execution, completion gates, and verification enforcement           |
| Active runtime context           | OMO side of the merged system | Session shaping, active context injection, continuation state, and active run memory              |
| Runtime command assembly         | OMO side of the merged system | Runtime discovery, merge, deduplication, precedence handling, and execution of commands/skills    |
| Model and provider plumbing      | OMO side of the merged system | Agent model selection, provider configuration, runtime capability matching, and fallback behavior |

### Integration Boundaries

- OCK owns the durable planning shell: planning artifacts, project structure, durable project memory, and the primary project workflow command surface.
- OMO owns the execution runtime: execution, orchestration, verification enforcement, active runtime context, runtime command assembly, and model/provider plumbing.
- When OMO executes an OCK-defined workflow step, approved artifacts and approval-relevant evidence still write back to OCK-owned durable locations under `/.beads`.
- Runtime-discovered or compatibility commands may invoke the workflow, but they must not become peer authority to the OCK-owned primary command surface.
- Durable project memory remains versioned under repo-local memory files; OMO-owned active context may shape a run, but it must not silently become durable project truth.

## Precedence Rules

When two inherited systems disagree, the merged system must resolve the conflict with explicit priority.

### Rule 1: Final merged behavior beats legacy behavior

If an OCK-era rule and an OMO-era rule conflict, the chosen merged-system rule wins. Legacy behavior survives only when it has been explicitly adopted.

### Rule 2: One source of truth per concern

If two files, commands, or workflows define the same concern, one must become authoritative and the other must be removed, downgraded, or treated as compatibility-only.

### Rule 3: User-facing simplicity beats internal heritage

If preserving legacy separation would force the user to think about OCK versus OMO, that separation has failed and should be redesigned.

### Rule 4: Personal utility wins ties

When two valid designs exist, choose the one that reduces friction for daily personal use, even if it is less general or less theoretically elegant.

### Rule 5: Planning must constrain execution

Plans, PRDs, and state documents are not narrative decoration. They exist to shape execution and block drift. If they do not alter behavior, they should be simplified or removed.

## Unified State Model

The merged system uses one operator-facing state model with two non-peer tiers: the **durable ledger** and the **active execution layer**.

The durable ledger records approved project truth. The active execution layer carries planning and runtime motion. These tiers are intentionally asymmetrical: if active state is lost, approved project truth must still survive in durable state.

| Tier         | Final Role             | Owns                                                                                                                                    |
| ------------ | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/.beads`    | Durable ledger         | task identity, durable status, dependencies, approved plan, handoff state, verification evidence, approved artifacts                    |
| `/.sisyphus` | Active execution layer | planning-in-progress, boulder/session lineage, continuation markers, runtime decomposition, execution scratch notes, active run context |

### State Rules

- Durable wins on conflict unless an explicit checkpoint writes back to durable state.
- `bead_id` is the canonical join key for active records that refer to durable work.
- Approved plans settle into `.beads/artifacts/<bead-id>/plan.md` as the durable execution contract.
- Active copies become compatibility-only or execution scaffolding after settlement; they do not remain peer durable truth.
- Legacy paths may survive during transition, but only as compatibility-only behavior, derived state, or active-layer scaffolding.

## Compatibility-Only Behavior

Compatibility-only behavior is temporary support for legacy paths during migration. It may preserve usability, but it must not preserve duplicate authority.

### Allowed Forms

| Form               | Allowed Purpose                                                                              | Not Allowed To Become                                     |
| ------------------ | -------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Adapter command    | Invoke the OCK-owned primary workflow path from a legacy entry point                         | A peer user-facing workflow authority                     |
| Derived view       | Mirror or summarize durable/active state for convenience                                     | A second source of durable truth                          |
| Active scaffolding | Hold drafts, runtime decomposition, continuation markers, or execution notes in `/.sisyphus` | The approved plan, durable status, or verification ledger |
| Migration helper   | Ease transition while docs, habits, and callers move to the primary path                     | A permanent requirement for normal operation              |

### Prohibited Uses

- Compatibility paths must not own durable status, dependencies, approved plan contents, handoff state, or verification evidence.
- Compatibility commands must not become peer starting points that compete with the OCK-owned project workflow command surface.
- Compatibility records may reference durable work through `bead_id`, but they must not silently mutate durable truth outside named write-back checkpoints.
- If a legacy path starts accumulating new durable meaning, the migration has failed and the architecture must be reopened instead of normalized.

### Retirement Rules

1. Once the final owner for a concern is implemented and documented, new work must target that owner directly.
2. A compatibility path may remain only as a thin adapter, derived view, or active-layer scaffold after the primary path exists.
3. A compatibility path should be retired when its callers, docs, and operational checks no longer depend on it for normal use.
4. No compatibility path may justify its survival by holding unique durable truth; if it still does, that truth must migrate first.
5. The exact deprecated-command list belongs to workflow convergence work, but every item on that list must follow these retirement rules.

## Default Workflow Path

The merged system has one default bead-backed operator path:

1. `/create <description>`
2. `/start <bead-id>`
3. `/plan <bead-id>` _(optional when deeper execution guidance is needed)_
4. `/ship <bead-id>`
5. `/pr <bead-id>`

### Workflow rules

- `/ship` is the default execution-and-delivery step. It owns implementation, mandatory verification, review, and durable write-back before follow-through actions like PR creation or bead closing.
- `/verify` remains an explicit support command for standalone preflight or inspection, but it is not a second primary delivery path.
- `/status`, `/resume`, `/handoff`, and `/research` are support commands around the same `bead_id`, not peer workflow entry points.

## Command Migration Path

The merged command surface must classify commands by authority instead of treating every discovered command as an equal workflow root.

| Class                                     | Commands                                                         | Final role                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Primary lifecycle                         | `/create`, `/start`, `/ship`, `/pr`                              | Canonical user-facing workflow path                                                        |
| Subordinate lifecycle support             | `/plan`, `/verify`                                               | Same workflow, narrower purpose                                                            |
| Continuity support                        | `/status`, `/resume`, `/handoff`, `/research`                    | State visibility, resumability, and context gathering                                      |
| Convenience adapters                      | `/lfg`, `/compound`                                              | May automate or extend the primary workflow, but must route into it rather than replace it |
| Specialty sidecars                        | `/design`, `/ui-review`, `/ui-slop-check`, `/review-codebase`    | Optional non-lifecycle tools                                                               |
| Runtime-discovered compatibility commands | legacy or compatibility entries surfaced by OMO runtime assembly | Temporary adapters only, never peer workflow authority                                     |

### Command migration rules

- Runtime command assembly must surface the OCK-owned primary workflow path as the canonical project path.
- Compatibility or legacy entries may remain during migration only if they invoke the same bead-backed lifecycle underneath.
- Any command that can create, claim, ship, or publish work without routing through the bead-backed durable path is compatibility-only at best and a deprecation candidate once adapters exist.

## Observable Outcomes

This project is succeeding only if the following become true in observable form:

- [ ] A new task can be started, planned, executed, verified, and handed off through one default workflow
- [ ] Each core domain has a named authority and no unresolved split ownership
- [ ] Duplicate command entry points are either merged or explicitly marked transitional
- [ ] Planning artifacts point to real execution behavior, not parallel process language
- [ ] The system can be used for daily personal work without switching terminology, folders, or habits midway through a task
- [ ] OMO can inspect, verify, and improve the merged system using the merged system’s own workflow
- [ ] A new contributor can identify where planning lives, where execution lives, where truth lives, and which rule wins when they conflict

## Design Principles

1. **One system, one operator view**  
   The user should experience one stack, not a negotiation between inherited subsystems.

2. **Authority before integration**  
   Name the owner before merging behavior. Unowned merges create permanent ambiguity.

3. **Artifacts must drive behavior**  
   Roadmaps, PRDs, plans, and state docs must create gates, not just record intent.

4. **Operational clarity over aspiration**  
   Prefer explicit rules, boundaries, and outcomes over broad statements about alignment.

5. **Personal utility first**  
   This project serves real daily use first. Broader reuse matters only after the personal workflow is strong, fast, and low-friction.

6. **Use the system on itself**  
   The merged system should be able to research, validate, and improve its own architecture and workflow.

## Project-Level Non-Goals

These are out of scope unless a later artifact explicitly brings them back in:

- Rebranding two systems without removing overlap
- Keeping parallel commands just to preserve legacy familiarity
- Generalizing for teams before the personal workflow works cleanly
- Building new implementation features before authority and precedence are decided
- Treating documentation as success in place of runtime workflow change
- Preserving every strength of both systems if doing so keeps duplicate ownership alive

## Current Phase

**Phase 3 readiness: Backbone Integration with workflow-enforcement scope**

Architecture-definition work has now settled authority, precedence, compatibility rules, and the default workflow path. The next implementation wave must encode those rules into command/runtime behavior: surface the bead-backed primary workflow, link active state back to durable work, and enforce durable write-back before active cleanup or follow-through claims.

See [roadmap.md](./roadmap.md) for required phase outputs and [state.md](./state.md) for the live steering checkpoint.

---

_Update this file when the authority model, precedence rules, observable outcomes, or non-goals materially change._
_This file is the default architectural frame for the project._
