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

## Authority Model

This project must assign one clear owner to each concern. Shared responsibility is allowed only during transition, never as the final state.

### Ownership Domains

These are the current **candidate owners** for the merged system during Phase 1 research. They guide comparison and conflict resolution now, but they are not yet the approved ownership matrix.

| Domain                      | Candidate Owner                             | What That Means                                                                 |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| Planning artifacts          | OCK side of the merged system               | PRDs, plans, research notes, roadmap/state framing, execution checklists        |
| Project structure           | OCK side of the merged system               | Template layout, default folders, artifact placement, project scaffolding rules |
| Execution engine            | OMO side of the merged system               | Task execution, code changes, implementation loops, tool-driven completion      |
| Agent orchestration         | OMO side of the merged system               | Subagents, delegation, parallel work, review passes, coordination rules         |
| Verification                | OMO side of the merged system               | Typecheck, lint, tests, build validation, completion gates                      |
| Memory and runtime context  | Unified layer with explicit source priority | Persistent context must have one precedence model, not tool-specific folklore   |
| Command surface             | Unified layer                               | User-facing commands must feel native to one system, not a wrapped pair         |
| Model and provider plumbing | OMO side of the merged system               | Agent model selection, provider configuration, execution runtime behavior       |

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

**Comparative Research with architectural intent**

This phase is not a passive audit. Its purpose is to produce the ownership map, precedence rules, and artifact set required to make implementation decisions without carrying legacy ambiguity forward.

See [roadmap.md](./roadmap.md) for required phase outputs and [state.md](./state.md) for the live steering checkpoint.

---

_Update this file when the authority model, precedence rules, observable outcomes, or non-goals materially change._
_This file is the default architectural frame for the project._
