# Unified State Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use skill({ name: "executing-plans" }) to implement this plan task-by-task.

**Goal:** Define and record one operator-facing state model where `/.beads` is the durable ledger, `/.sisyphus` is the active execution layer, `bead_id` is the canonical join key, approved plans settle into bead artifacts, and the steering docs honestly reflect what this resolves and what remains open.

**Architecture:** This bead is documentation- and artifact-first. It should not change runtime storage code. Instead it should establish the governing rules that later runtime and command work must obey: durable-vs-active asymmetry, explicit precedence, compatibility-only legacy paths, and staged migration boundaries. The implementation surface stays limited to the architecture charter and steering docs so later beads can implement against one settled model instead of two peer systems.

**Tech Stack:** Markdown planning artifacts under `.beads/` and `.opencode/memory/project/`, with OCK Beads docs and OMO runtime state modules used as source evidence.

**Discovery Level:** 3 - Deep  
**Rationale:** This bead sets system-level authority, precedence, join-key, and migration rules across `/.beads` and `/.sisyphus`. Research confirmed there is no existing runtime `bead_id` linkage in OMO; current active state is keyed by `active_plan`, `plan_name`, `session_ids`, `task_sessions`, and continuation markers.

**Context Budget:** ~45-50% total, split across 3 execution tasks in 2 waves. Keep scope to artifact updates only; do not start runtime refactors in this bead.

---

## Discovery

Research across the current repo shows a real split rather than a unified model. OCK treats `/.beads/issues.jsonl` and `/.beads/artifacts/<bead-id>/...` as durable, git-native work truth in `ock/.beads/README.md`, `ock/.beads/config.yaml`, and the OCK workflow commands. OMO treats `/.sisyphus` as active orchestration state in `omo/src/features/boulder-state/storage.ts`, `omo/src/features/run-continuation-state/storage.ts`, `omo/src/features/claude-tasks/storage.ts`, and `omo/docs/guide/orchestration.md`, keyed by `active_plan`, `plan_name`, `session_ids`, `task_sessions`, and continuation markers. Focused exploration found no direct `bead_id` field or `.beads/artifacts/<id>/` backlink inside current OMO runtime state. That means this bead should define the authority model and join-key contract, not pretend the implementation already exists.

---

## Must-Haves

**Goal:** One operator-facing state architecture is documented strongly enough that future implementation beads can use it as binding guidance.

### Observable Truths

1. A contributor can tell which layer owns durable work truth and which layer owns active execution truth without reasoning in subsystem-brand terms.
2. A future implementation bead can point to one explicit conflict rule for durable-vs-active disagreements.
3. Approved plans, durable status, dependencies, handoffs, and verification evidence are documented as durable-ledger concerns only.
4. The live steering docs show that one precedence conflict is now resolved in principle while remaining Phase 1 blockers stay explicit.

### Required Artifacts

| Artifact                    | Provides                                                                                                     | Path                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| Architecture charter update | Canonical durable-vs-active state model, authority split, precedence rules, join key, compatibility language | `.opencode/memory/project/project.md` |
| Steering state update       | Honest record of resolved state-model decisions, blocker changes, and gate movement                          | `.opencode/memory/project/state.md`   |
| Roadmap update              | Phase-output wording that explicitly anchors state authority and precedence as tracked research output       | `.opencode/memory/project/roadmap.md` |
| Execution contract          | Exact work order and verification steps for this bead                                                        | `.beads/artifacts/bd-l1s/plan.md`     |

### Key Links

| From                         | To                     | Via                                                | Risk                                                                         |
| ---------------------------- | ---------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| Research findings            | Charter language       | State-model section in `project.md`                | Research-backed constraints get watered down into vague “unified” prose      |
| Charter rules                | Steering state         | Decision/blocker/gate updates in `state.md`        | `state.md` may claim more resolution than `project.md` actually defines      |
| Charter rules                | Roadmap gate wording   | Phase 1 and current-position updates in `roadmap.md` | Roadmap may advance too early or fail to reflect the new precedence artifact |
| Durable plan settlement rule | Future runtime work    | `bead_id` + approved-plan location                 | Later work may keep approved plans dual-homed in `.sisyphus`                 |
| Durable ledger authority     | Active execution layer | “durable wins unless checkpointed”                 | Future runtime code may accidentally reintroduce peer durable truth          |

## Dependency Graph

Task 1: needs nothing, creates the canonical state model and precedence rules in `.opencode/memory/project/project.md`  
Task 2: needs Task 1, creates the honest steering update in `.opencode/memory/project/state.md`  
Task 3: needs Task 1, creates the roadmap/gate alignment in `.opencode/memory/project/roadmap.md`

Wave 1: Task 1  
Wave 2: Task 2, Task 3

---

## Tasks

### Task 1: Lock The State Model In The Charter

**Files:**
- Modify: `.opencode/memory/project/project.md`
- Read for context only: `.beads/artifacts/bd-l1s/research.md`
- Read for source evidence only: `ock/.beads/README.md`
- Read for source evidence only: `ock/.beads/config.yaml`
- Read for source evidence only: `omo/src/features/boulder-state/storage.ts`
- Read for source evidence only: `omo/src/features/claude-tasks/storage.ts`
- Read for source evidence only: `omo/src/features/run-continuation-state/storage.ts`
- Read for source evidence only: `omo/docs/guide/orchestration.md`

**Step 1: Run the failing discovery check**

Run:
```bash
grep -nE 'durable ledger|active execution layer|bead_id|compatibility-only|durable wins unless checkpointed' /work/ock-omo-system/.opencode/memory/project/project.md
```

Expected:
```text
No matches found
```
or fewer matches than required to define a full state model.

**Step 2: Add a new state-model section to the charter**

Add a new section to `.opencode/memory/project/project.md` after `## Precedence Rules` or before `## Observable Outcomes` named `## Unified State Model`.

That section must explicitly define:
- One operator-facing model with two non-peer tiers
- `/.beads` as the durable ledger
- `/.sisyphus` as the active execution layer
- The asymmetry: durable records truth, active carries motion
- The recovery invariant: losing active state must not erase approved project truth

**Step 3: Add the authority split**

In the same section, add a durable-vs-active ownership table or equivalent explicit bullets.

Durable ledger concerns must include:
- task identity
- durable status
- dependencies
- approved plan
- handoff state
- verification evidence
- approved artifacts

Active execution concerns must include:
- planning-in-progress
- boulder/session lineage
- continuation markers
- runtime decomposition
- execution scratch notes
- active run context

**Step 4: Add the precedence and join-key rules**

Add explicit rules stating:
- durable wins on conflict unless an explicit checkpoint writes back to durable state
- `bead_id` is the canonical join key for active records that refer to durable work
- approved plans settle into `.beads/artifacts/<bead-id>/plan.md`
- active copies become compatibility-only or execution scaffolding after settlement
- legacy paths may survive during transition, but not as peer durable truth

**Step 5: Re-run the charter verification**

Run:
```bash
grep -nE 'durable ledger|active execution layer|bead_id|compatibility-only|durable wins unless checkpointed|approved plans settle' /work/ock-omo-system/.opencode/memory/project/project.md
```

Expected:
```text
One or more matching lines for each concept above
```

**Step 6: Read back the new section for drift control**

Read the updated section and verify:
- it does not promise runtime migration in this bead
- it does not describe `.beads` and `.sisyphus` as peer ledgers
- it does not advance the project beyond architecture-definition evidence

---

### Task 2: Update Live Steering State Honestly

**Files:**
- Modify: `.opencode/memory/project/state.md`
- Read: `.opencode/memory/project/project.md`

**Step 1: Run the failing steering check**

Run:
```bash
grep -nE 'durable ledger|active execution|bead_id|resolved in principle|Complete' /work/ock-omo-system/.opencode/memory/project/state.md
```

Expected:
```text
Missing or insufficient matches for the new state-model decisions
```

**Step 2: Update the current position and recent completion record**

Edit `.opencode/memory/project/state.md` so it reflects the real steering outcome of this bead:
- set `Active Bead` to `bd-l1s` if the bead is now the active architecture thread
- add a recent-completion row for the unified state research / precedence artifact
- keep `Status` and `Active Phase` honest; do not advance phases

**Step 3: Add the resolved architectural decisions**

Add decision rows that reflect the charter, including:
- `/.beads` is the durable ledger
- `/.sisyphus` is the active execution layer
- durable wins unless checkpointed
- `bead_id` is the canonical join key
- approved plans settle into durable bead artifacts

**Step 4: Narrow, don’t erase, remaining blockers**

Update blockers so the old “no explicit precedence model” blocker is removed or narrowed, while keeping unresolved work visible.

The state file should still show unresolved blockers for:
- ownership matrix completion across all core domains
- command/runtime implementation of the new model
- default workflow convergence

**Step 5: Update gate readiness conservatively**

Update the Phase 1 gate table so:
- `At least one precedence conflict has been documented and resolved in principle` becomes `Complete`
- other gate rows stay `Not Started` or move only to `In Progress` if the artifact evidence justifies it
- the verdict remains honest if the phase still cannot advance

**Step 6: Re-run the steering verification**

Run:
```bash
grep -nE 'durable ledger|active execution|bead_id|resolved in principle|Complete|compatibility-only' /work/ock-omo-system/.opencode/memory/project/state.md
```

Expected:
```text
Matches showing the new decisions and at least one gate movement
```

---

### Task 3: Align The Roadmap With The New State Artifact

**Files:**
- Modify: `.opencode/memory/project/roadmap.md`
- Read: `.opencode/memory/project/project.md`
- Read: `.opencode/memory/project/state.md`

**Step 1: Run the failing roadmap check**

Run:
```bash
grep -nE 'precedence rule draft|state authority|durable-versus-active|resolved in principle' /work/ock-omo-system/.opencode/memory/project/roadmap.md
```

Expected:
```text
Missing or too-generic references to the state-authority artifact
```

**Step 2: Add explicit Phase 1 language for this overlap**

Update the Phase 1 sections so the roadmap clearly reflects that the durable-vs-active state overlap is a tracked comparative-research output.

The minimal acceptable change is:
- add wording to `Required Artifacts` or `Required Decisions` that names the state-authority / precedence output
- make clear this supports Phase 1 research and does not skip directly to backbone integration

**Step 3: Update the current roadmap position**

Update `## Current Roadmap Position` so the next required output references the remaining work in light of this bead, for example:
- candidate ownership matrix and overlap/collision map derived from the new state-authority draft

Do not change:
- active phase
- the “Do Not Start Yet” warning against backbone integration

**Step 4: Re-run the roadmap verification**

Run:
```bash
grep -nE 'precedence rule draft|state authority|durable-versus-active|Do Not Start Yet' /work/ock-omo-system/.opencode/memory/project/roadmap.md
```

Expected:
```text
Matches for the new state-authority wording, with the Phase 3 warning still intact
```

---

## Final Verification

After all three tasks are complete, run these checks:

```bash
grep -nE 'durable ledger|active execution layer|bead_id|compatibility-only|durable wins unless checkpointed' /work/ock-omo-system/.opencode/memory/project/project.md
grep -nE 'durable ledger|active execution|bead_id|resolved in principle|Complete' /work/ock-omo-system/.opencode/memory/project/state.md
grep -nE 'precedence rule draft|state authority|durable-versus-active|Do Not Start Yet' /work/ock-omo-system/.opencode/memory/project/roadmap.md
```

Expected:
- all three files return matching lines
- `state.md` shows one precedence conflict resolved in principle
- `roadmap.md` still blocks premature backbone work
- no runtime code paths were changed in this bead

## Out Of Scope Guard

If execution starts drifting into any of the following, stop and defer to a later bead:
- editing `omo/src/features/**`
- editing `ock/.opencode/command/*.md`
- introducing a physical storage migration
- renaming folders or creating a façade path like `.opencode/state/`
- changing command behavior rather than documenting the governing rules

## Execution Notes

- Keep edits minimal and explicit.
- Prefer tables or short bullets over narrative prose.
- Preserve the existing architecture language style in `project.md`, `state.md`, and `roadmap.md`.
- This bead succeeds by defining rules that constrain future work, not by starting that future work.
