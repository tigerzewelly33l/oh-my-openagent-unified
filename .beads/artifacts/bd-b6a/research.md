# Research — bd-b6a

## Depth

- **Depth level:** Moderate-to-thorough internal codebase research
- **Approx. tool calls:** 40+
- **Confidence threshold:** Medium+ on all core questions; high on most command/state findings because they were verified directly in source files

## Questions

| Question                                                            | Status   | Confidence | Answer summary                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------- | -------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What capabilities are clearly OCK-derived?                          | Answered | High       | OCK clearly owns the durable workflow shell: bead creation, PRD/plan/progress artifacts, durable project memory, and verification gates centered on `.beads/` and `.opencode/memory/project/`.                                                                                              |
| What capabilities are clearly OMO-derived?                          | Answered | High       | OMO clearly owns execution/runtime concerns: command assembly, command discovery, task-tool gating, session/continuation state, and loop/verification orchestration centered on runtime hooks and `.sisyphus/`.                                                                             |
| Where do OCK and OMO overlap or collide most directly?              | Answered | High       | The highest-risk overlaps are command authority, workflow roots, task/durable-state concepts, and plan/continuation state. Execution registration and visible command discovery are separate OMO layers, which creates an authority seam.                                                   |
| Does the durable-versus-active state framing still match real code? | Answered | High       | Yes, mostly. `.beads` remains the durable ledger on the OCK side, while `.sisyphus` remains the active execution layer on the OMO side. The main risk is not conceptual mismatch but runtime surfaces still exposing `.sisyphus`-first legacy behavior in OMO.                              |
| What should later backbone work enforce first?                      | Answered | High       | First enforce command/runtime authority alignment: surface OCK primary workflow commands first, suppress or demote competing OMO builtins in bead-first repos, keep OMO on runtime execution/orchestration only, and require durable write-back before active-state cleanup/follow-through. |

## OCK capability audit

### What OCK clearly owns

1. **Primary bead-backed workflow definition**
   - `/create` defines the canonical spec-first flow and explicitly limits itself to creating specification, not implementation; it creates `.beads/artifacts/$BEAD_ID/prd.md` as durable output (`.opencode/command/create.md:9-14`, `.opencode/command/create.md:135-149`).
   - `/start` is the bridge from spec to work and requires a bead with `prd.md` before work begins (`.opencode/command/start.md:9-14`, `.opencode/command/start.md:55-63`).
   - `/plan` is an optional bead-scoped planning step between `/start` and `/ship` (`.opencode/command/plan.md:9-16`).
   - `/ship` defines the default delivery flow and routes implementation from durable bead artifacts (`.opencode/command/ship.md:9-14`, `.opencode/command/ship.md:64-71`).

2. **Durable artifact home under `.beads/artifacts/<bead-id>/`**
   - `/create` writes `prd.md` (`.opencode/command/create.md:135-149`).
   - `/plan` works against bead artifacts and produces `plan.md` (`.opencode/command/plan.md:96-109`).
   - `/ship` reads bead artifacts and appends progress to `.beads/artifacts/$ARGUMENTS/progress.txt` (`.opencode/command/ship.md:60-71`, `.opencode/command/ship.md:88-100`).
   - `/resume` reloads `prd.md`, `plan.md`, `progress.txt`, and `research.md` from the bead artifact directory (`.opencode/command/resume.md:55-63`).

3. **Durable verification gates tied to bead truth**
   - `/verify` explicitly checks implementation against bead PRD/artifacts and caches verification in `.beads/verify.log` (`.opencode/command/verify.md:43-60`, `.opencode/command/verify.md:68-83`, `.opencode/command/verify.md:119-123`).
   - `/ship` requires verification/review before closure and treats these as non-negotiable delivery gates (`.opencode/command/ship.md:30-37`, `.opencode/command/ship.md:196-233`).

4. **Durable project memory ownership**
   - `/init-context` explicitly says it is the single owner of creating or refreshing `project.md`, `roadmap.md`, and `state.md` in `.opencode/memory/project/` (`.opencode/command/init-context.md:15-29`).
   - Those files are structured as always-injected durable context (`project.md`) plus on-demand durable planning/state files (`roadmap.md`, `state.md`) (`.opencode/command/init-context.md:15-27`, `.opencode/command/init-context.md:246-255`).

5. **OCK CLI scaffolding for durable structure**
   - `ock init --beads` can bootstrap `.beads/` and creates `config.yaml`, `issues.jsonl`, and `metadata.json` if needed (`ock/src/commands/init.ts:801-827`).

### OCK strengths that should be preserved

- Spec-first workflow with durable PRD contract.
- One obvious durable home for approved work artifacts.
- Bead-aware verification rather than free-floating runtime success claims.
- Repo-local durable memory with clear ownership and low ambiguity.

## OMO capability audit

### What OMO clearly owns

1. **Runtime command assembly**
   - `applyCommandConfig()` merges builtin, user, project, opencode-global/project, config-derived, and plugin command sources into the executable runtime registry (`omo/src/plugin-handlers/command-config-handler.ts:136-171`, `omo/src/plugin-handlers/command-config-handler.ts:196-270`).

2. **Visible slash-command discovery and ordering**
   - `discoverCommandsSync()` independently discovers commands from multiple locations, filters builtins for OCK repos, resolves collisions, and prioritizes results for display (`omo/src/tools/slashcommand/command-discovery.ts:188-277`).

3. **Repo-shape-aware workflow demotion in OCK bead-first projects**
   - `isOckBeadFirstProject()` detects bead-first repos using `.beads` plus canonical workflow command markers (`omo/src/shared/ock-bead-first-project.ts:5-54`).
   - OMO classifies command groups as `primary`, `support`, `compatibility`, and suppresses conflicting OMO builtins such as `start-work`, `ralph-loop`, `ulw-loop`, `cancel-ralph`, and `stop-continuation` in bead-first repos (`omo/src/shared/workflow-command-priority.ts:1-25`, `omo/src/shared/workflow-command-priority.ts:40-99`).

4. **Task-system gating and tool registration**
   - OMO’s task CRUD system is feature-flagged and disabled in OCK bead-first repos via `isTaskSystemActiveForDirectory()` (`omo/src/shared/task-system-enabled.ts:9-26`).
   - `createToolRegistry()` only registers `task_create`, `task_get`, `task_list`, and `task_update` when that gate is active (`omo/src/plugin/tool-registry.ts:203-215`).

5. **Active execution state and continuation persistence**
   - OMO persists continuation markers in `.sisyphus/run-continuation/<session>.json` (`omo/src/features/run-continuation-state/constants.ts:1`, `omo/src/features/run-continuation-state/storage.ts:10-56`).
   - OMO’s boulder system is explicitly rooted in `.sisyphus`, with `boulder.json` and `.sisyphus/plans` as its work-state homes (`omo/src/features/boulder-state/constants.ts:5-13`).

6. **Session/runtime orchestration hooks**
   - The legacy `/start-work` template explicitly instructs agents to operate through `.sisyphus/plans/` and `.sisyphus/boulder.json` (`omo/src/features/builtin-commands/templates/start-work.ts:14-45`, `omo/src/features/builtin-commands/templates/start-work.ts:114-128`).
   - `createStartWorkHook()` loads and updates boulder state, chooses active agents, and injects active session context (`omo/src/hooks/start-work/start-work-hook.ts:64-140`).
   - `createChatMessageHandler()` is part of the runtime control plane: it records session agent/model state and invokes continuation/start-work/runtime hooks (`omo/src/plugin/chat-message.ts:127-210`).

### OMO strengths that should be preserved

- Runtime command assembly and conflict handling.
- Execution-time orchestration, session state, and continuation management.
- Tool registration, gating, and background/subagent execution.
- Verification/runtime enforcement hooks at execution time.

## Overlap and collision map

### Highest-risk overlap areas

1. **Command authority split across two OMO layers**
   - Executable command registration is merged in `applyCommandConfig()` (`omo/src/plugin-handlers/command-config-handler.ts:196-270`).
   - Visible slash-command discovery is resolved separately in `discoverCommandsSync()` (`omo/src/tools/slashcommand/command-discovery.ts:188-277`).
   - This means list precedence and execution precedence are related but not identical. That is the most important command-authority collision.

2. **Workflow-root competition**
   - OCK presents `/create -> /start -> [/plan] -> /ship -> /pr` as the canonical path (`.opencode/README.md`, `.opencode/command/create.md:11-14`, `.opencode/command/start.md:11-14`, `.opencode/command/plan.md:11-16`, `.opencode/command/ship.md:11-14`).
   - OMO still carries older workflow surfaces like `/start-work` and loop commands, even though they are now suppressible in bead-first repos (`omo/src/shared/workflow-command-priority.ts:19-25`, `omo/src/features/builtin-commands/templates/start-work.ts:1-18`).

3. **Task system vs bead ledger**
   - OCK uses `.beads` as the durable ledger and artifact home (`.opencode/command/create.md:135-149`, `.opencode/command/verify.md:119-123`).
   - OMO has its own task CRUD layer, but that system is now explicitly disabled in OCK bead-first repos (`omo/src/shared/task-system-enabled.ts:13-26`, `omo/src/plugin/tool-registry.ts:203-215`).

4. **Plan truth vs active orchestration state**
   - OCK’s approved plan target is bead-scoped `plan.md` (`.opencode/command/plan.md:96-109`).
   - OMO’s legacy plan execution continues to point at `.sisyphus/plans/*.md` and boulder state (`omo/src/features/builtin-commands/templates/start-work.ts:14-45`, `omo/src/features/boulder-state/constants.ts:5-13`).

## Durable-versus-active state authority draft

### Durable-versus-active model

- **Durable state** = approved project truth and bead-backed artifacts under `.beads/` plus durable planning context under `.opencode/memory/project/`.
- **Active state** = runtime execution motion under `.sisyphus/`, session state, boulder state, and continuation markers.

### Evidence

- OCK durable evidence:
  - PRD, plan, progress, and research all live under `.beads/artifacts/<bead-id>/` (`.opencode/command/create.md:135-149`, `.opencode/command/resume.md:55-63`).
  - Verification cache and results write to `.beads/verify.log` (`.opencode/command/verify.md:43-60`, `.opencode/command/verify.md:119-123`).
  - Durable planning context lives in `.opencode/memory/project/` and is owned by `/init-context` (`.opencode/command/init-context.md:15-29`).

- OMO active evidence:
  - `.sisyphus/run-continuation` stores continuation markers (`omo/src/features/run-continuation-state/constants.ts:1`, `omo/src/features/run-continuation-state/storage.ts:10-56`).
  - `.sisyphus/boulder.json` and `.sisyphus/plans` back older start-work flow and active execution state (`omo/src/features/boulder-state/constants.ts:5-13`, `omo/src/features/builtin-commands/templates/start-work.ts:14-45`).

### Precedence

- **Precedence rule:** Durable wins unless an explicit checkpoint writes runtime progress back to durable bead artifacts.
- This is consistent with the current state file, which says durable wins unless checkpointed and that verification requires durable write-back (`.opencode/memory/project/state.md:46-57`).

### Join-key rule

- **Canonical join-key:** `bead_id` should link active runtime records back to durable work truth.
- This is explicitly captured in the steering state: `bead_id` is the canonical join key between durable work and active execution (`.opencode/memory/project/state.md:46-50`).

### Judgment

- The durable-versus-active framing still matches actual code with high confidence.
- The unresolved issue is not the model itself; it is that runtime enforcement is incomplete, so legacy OMO active-state surfaces can still appear as peer workflow roots if not explicitly demoted.

## Preserved strengths

### Preserve from OCK

- Durable workflow shell and artifact discipline.
- Repo-local planning memory and durable context ownership.
- Bead-first execution contract and verification gates.

### Preserve from OMO

- Runtime command assembly and command conflict handling.
- Orchestration, continuation, subagent/background execution, and execution-time verification hooks.
- Repo-shape-aware demotion behavior that already recognizes OCK bead-first projects.

## Candidate ownership matrix

| Domain                            | Candidate owner | Evidence                                                                                                                                                                                               |
| --------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Planning artifacts                | OCK             | OCK commands create/read/write bead artifacts and durable planning context (`.opencode/command/create.md:135-149`, `.opencode/command/plan.md:96-109`, `.opencode/command/init-context.md:15-29`)      |
| Project structure                 | OCK             | `ock init` scaffolds `.beads/` and durable `.opencode` structure (`ock/src/commands/init.ts:801-827`)                                                                                                  |
| Durable project memory            | OCK             | `/init-context` owns `project.md`, `roadmap.md`, `state.md` (`.opencode/command/init-context.md:15-29`)                                                                                                |
| Primary project workflow commands | OCK             | `/create`, `/start`, `/plan`, `/ship`, `/pr` are the canonical path (`.opencode/README.md`, `.opencode/command/*.md`)                                                                                  |
| Execution engine                  | OMO             | Runtime hooks/tool registry/chat-message pipeline own session and execution behavior (`omo/src/plugin/chat-message.ts:127-210`, `omo/src/plugin/tool-registry.ts:106-236`)                             |
| Agent orchestration               | OMO             | Background/subagent task delegation and start-work/continuation hooks are OMO runtime concerns (`omo/src/plugin/tool-registry.ts:125-201`, `omo/src/hooks/start-work/start-work-hook.ts:64-140`)       |
| Verification runtime              | OMO             | Runtime enforcement and orchestration hooks sit in OMO, even when durable verification evidence should write back elsewhere (`omo/src/plugin/chat-message.ts:199-210`)                                 |
| Active runtime context            | OMO             | `.sisyphus` continuation/boulder/session state is OMO-owned (`omo/src/features/run-continuation-state/storage.ts:10-56`, `omo/src/features/boulder-state/constants.ts:5-13`)                           |
| Runtime command assembly          | OMO             | `applyCommandConfig()` and `discoverCommandsSync()` are OMO runtime machinery (`omo/src/plugin-handlers/command-config-handler.ts:136-270`, `omo/src/tools/slashcommand/command-discovery.ts:188-277`) |

## Command/runtime implementation notes

### Notes for backbone / Phase 3 work

1. **Unify visible precedence and executable precedence**
   - Today, OMO has separate mechanisms for runtime merge precedence and slash-command discovery precedence.
   - Backbone work should ensure the OCK-owned primary workflow path is first-class in both planes, not only in visible ordering.

2. **Keep OMO’s repo-aware demotion logic, but treat it as enforcement infrastructure rather than optional compatibility**
   - OMO already detects bead-first repos and suppresses conflicting builtins (`omo/src/shared/ock-bead-first-project.ts:32-54`, `omo/src/shared/workflow-command-priority.ts:19-25`).
   - Backbone work should convert this from “helpful runtime preference” into durable architecture enforcement.

3. **Do not let OMO task CRUD tools become peer durable truth in bead-first repos**
   - Current gating already disables them (`omo/src/shared/task-system-enabled.ts:13-26`, `omo/src/plugin/tool-registry.ts:203-215`).
   - Keep that rule; do not reopen dual durable task systems.

4. **Require durable write-back before active cleanup or follow-through claims**
   - OCK delivery commands already assume durable artifacts are the contract (`.opencode/command/ship.md:64-100`, `.opencode/command/verify.md:68-152`).
   - OMO active-state cleanup/continuation logic should not be considered completion until bead artifacts and durable verification evidence have been updated.

5. **Demote legacy OMO workflow roots to adapters or suppress them in bead-first repos**
   - `/start-work` and loop commands remain clear compatibility surfaces, not primary workflow roots in this merged repo (`omo/src/shared/workflow-command-priority.ts:19-25`, `omo/src/features/builtin-commands/templates/start-work.ts:1-18`).

## Net-new findings from follow-up research

### Command authority seam is narrower and sharper than the first pass

- The highest-risk mismatch is not just that OMO has two command-related layers; it is that **runtime registration and slash-command discovery use different source universes and different same-priority tie-break rules**.
- Runtime/executable registration happens through `applyCommandConfig()` in `omo/src/plugin-handlers/command-config-handler.ts:201-268`. For workflow/support/compatibility commands in bead-first repos it uses `OCK_BEAD_FIRST_WORKFLOW_SCOPE_PRIORITY`, but **same-priority ties resolve to the later source** (`omo/src/plugin-handlers/command-config-handler.ts:122-130`).
- Visible slash-command discovery happens through `discoverCommandsSync()` and `resolveCommandConflicts()` in `omo/src/tools/slashcommand/command-discovery.ts:188-277`. It uses a similar scope-priority model in bead-first repos, but **same-priority ties resolve to the earlier discovered source** (`omo/src/tools/slashcommand/command-discovery.ts:201-207`).
- Slash execution follows discovery semantics through `omo/src/hooks/auto-slash-command/executor.ts:57-101`, not `config.command` registration. That means the system can still **show one winner and register another** if the same command name exists in same-priority sources.
- This makes the first enforcement seam more precise: Phase 3 should unify command winner selection across runtime registration and slash discovery/execution rather than only reordering visible command lists.

### Compatibility surfaces are still active, not fully adapter-enforced

- OMO bead-first suppression already removes the strongest conflicting builtins: `start-work`, `ralph-loop`, `ulw-loop`, `cancel-ralph`, and `stop-continuation` via `omo/src/shared/workflow-command-priority.ts:19-25, 93-99` and the matching filters in runtime/discovery code.
- But `lfg` and `compound` are only classified as `compatibility` commands, not suppressed. They remain live commands that participate in precedence resolution and execution, merely sorted later than primary/support commands (`omo/src/shared/workflow-command-priority.ts:17`, `omo/src/tools/slashcommand/command-discovery.ts:45-66`).
- The practical implication is that OMO already demotes some legacy workflow roots, but **compatibility commands are still peer executable surfaces**, not yet adapter-only paths.

### Active-state seam is stronger than the first pass suggested

- `.sisyphus/boulder.json` carries more than scratch metadata. `BoulderState` persists `active_plan`, `session_ids`, `plan_name`, optional `agent`, optional `worktree_path`, and `task_sessions` in `omo/src/features/boulder-state/types.ts`.
- Continuation state also persists separately under `.sisyphus/run-continuation/<sessionID>.json` through `omo/src/features/run-continuation-state/storage.ts:10-67`.
- Atlas and CLI continuation decisions treat `.sisyphus` as operative execution truth during active runs:
  - `omo/src/hooks/atlas/idle-event.ts`
  - `omo/src/hooks/atlas/resolve-active-boulder-session.ts`
  - `omo/src/cli/run/continuation-state.ts`
- The highest-risk write-back gap is that **active boulder state can be cleared without any durable bead checkpoint**. `/stop-continuation` triggers `clearBoulderState(ctx.directory)` in `omo/src/plugin/tool-execute-before.ts:178-183`, and the inspected active-state path does not checkpoint `.beads` artifacts before that cleanup.
- `BoulderState` currently has **no `bead_id` join key**, so active `.sisyphus` records cannot yet be cleanly subordinated to durable bead truth in code.

### External references support the local model, with important limits

- Official OpenCode docs confirm that repo-local commands/plugins/tools are first-class extension surfaces with explicit precedence and override behavior:
  - Config precedence: `https://opencode.ai/docs/config/#precedence-order`
  - Commands can override built-ins: `https://opencode.ai/docs/commands/#built-in`
  - Plugin load order: `https://opencode.ai/docs/plugins/#load-order`
  - Plugin/custom tools can override built-ins: `https://opencode.ai/docs/plugins/#custom-tools`, `https://opencode.ai/docs/custom-tools/#name-collisions-with-built-in-tools`
- Upstream OpenCode history also shows that a split between registered commands and slash visibility was a real problem shape, then later a target for unification:
  - Duplication issue: `https://github.com/anomalyco/opencode/issues/9114`
  - Registry-unification commit: `https://github.com/anomalyco/opencode/commit/759e68616e53f4c4d3a647606203bf46a9193733`
  - Skills added into slash invocation path: `https://github.com/anomalyco/opencode/pull/11390`
  - Surface-parity gap in GUI/web: `https://github.com/anomalyco/opencode/issues/17048`
- The narrow conclusion is: **the local command split is real in this repo, but upstream direction favors unified registry-derived slash behavior rather than permanent separation**.

### External beads evidence supports `.beads` as durable ledger truth

- The strongest upstream support for the durable-ledger framing comes from `beads_rust`, not modern `bd`.
- `beads_rust` documents `.beads/` as the repo-local durable store, with `beads.db` as primary storage and explicit export/import discipline through `br sync --flush-only` / `--import-only` in:
  - `https://github.com/Dicklesworthstone/beads_rust/blob/main/README.md`
  - `https://github.com/Dicklesworthstone/beads_rust/blob/main/VCS_INTEGRATION.md`
- That evidence strongly supports the current merged-system framing that `.beads` should remain the durable collaborative ledger while runtime execution state can remain outside it as active-only scaffolding.
- Modern `bd` materials are still useful as contrast, but they are less supportive of a strict explicit write-back model because they lean on Dolt-backed auto-persistence and richer agent-memory semantics.

### Oracle-ranked enforcement sequence

- Oracle’s judgment is that **command authority alignment should be the first Phase 3 enforcement seam**, ahead of write-back checkpoints or broader suppression.
- The reason is straightforward: until command discovery/listing and executable resolution pick the same winner, the system can present one workflow authority model and execute another.
- The recommended first proof run is a **command-authority coherence check** in an OCK bead-first repo: verify that `/create`, `/start`, `/plan`, `/ship`, and `/pr` win in both visible ordering and executable resolution, while competing OMO workflow roots are not surfaced as peers.
- Oracle explicitly recommends keeping task gating as a confirmed hold, then moving **write-back checkpoints second**, and deferring broader legacy-command suppression until precedence is coherent.

## Recommendation

Use this research as the Phase 1 comparative baseline and keep the current architectural direction:

- **OCK should remain the durable workflow shell owner.**
- **OMO should remain the execution/runtime owner.**
- **Backbone work should focus on enforcement, not redefinition**: align OMO command assembly/discovery with the OCK primary workflow path, preserve `.beads` as durable truth, preserve `.sisyphus` as active runtime-only state, and require explicit write-back checkpoints between them.

## Open items remaining

1. Which legacy OMO commands should remain as thin adapters versus immediate suppression in this repo.
2. How to make runtime command discovery/help output and executable registration use one coherent authority model.
3. What concrete write-back checkpoint should be the first proof run for Phase 3 backbone enforcement.

## Sources

### OCK sources

- `.opencode/command/create.md:9-14, 135-149`
- `.opencode/command/start.md:9-14, 55-63`
- `.opencode/command/plan.md:9-16, 96-109`
- `.opencode/command/ship.md:9-14, 30-37, 64-100, 196-233`
- `.opencode/command/verify.md:43-60, 68-83, 119-152`
- `.opencode/command/resume.md:55-63`
- `.opencode/command/init-context.md:15-29, 246-255`
- `ock/src/commands/init.ts:801-827`

### OMO sources

- `omo/src/plugin-handlers/command-config-handler.ts:136-270`
- `omo/src/tools/slashcommand/command-discovery.ts:188-277`
- `omo/src/shared/workflow-command-priority.ts:1-99`
- `omo/src/shared/ock-bead-first-project.ts:5-54`
- `omo/src/shared/task-system-enabled.ts:9-26`
- `omo/src/plugin/tool-registry.ts:183-215`
- `omo/src/features/run-continuation-state/constants.ts:1`
- `omo/src/features/run-continuation-state/storage.ts:10-56`
- `omo/src/features/boulder-state/constants.ts:5-13`
- `omo/src/features/builtin-commands/templates/start-work.ts:14-45, 114-128`
- `omo/src/hooks/start-work/start-work-hook.ts:64-140`
- `omo/src/plugin/chat-message.ts:127-210`

### Steering/project sources

- `.opencode/memory/project/roadmap.md:32-68, 111-139`
- `.opencode/memory/project/state.md:13-20, 46-57, 63-66, 91-98, 104-109`
