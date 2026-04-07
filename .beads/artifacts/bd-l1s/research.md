# Research: Unified State Architecture

**Bead:** bd-l1s  
**Date:** 2026-04-07  
**Depth:** Moderate + Ultrabrain architecture pass  
**Confidence:** High

---

## Research Questions

1. What currently constitutes durable project truth in OCK?
2. What currently constitutes active execution truth in OMO?
3. Can `.beads` and `.sisyphus` be combined safely without duplicate durable truth?
4. What is the correct authority split between durable and active state?
5. What invariants are required to keep the merged state model coherent over time?

---

## Answers

### 1) OCK durable project truth

OCK treats `/.beads` as the durable, git-native project work ledger.

**Evidence:**
- `ock/.beads/README.md` describes beads as git-native issue tracking and durable repo state
- `ock/.beads/config.yaml` defines beads persistence/source-of-truth behavior
- `ock/.opencode/command/create.md` and `plan.md` create durable task artifacts under `/.beads/artifacts/<bead-id>/...`
- `ock/.opencode/command/verify.md` uses bead-scoped verification evidence and stamps

**Conclusion:**
The durable OCK layer is:
- `/.beads/issues.jsonl` for task registry and status
- `/.beads/artifacts/<bead-id>/...` for PRD, research, plan, handoff-worthy artifacts, and verification-adjacent records

### 2) OMO active execution truth

OMO treats `/.sisyphus` as the active execution/orchestration layer, not as a single durable project ledger.

**Evidence:**
- `omo/src/features/boulder-state/storage.ts` persists active execution ledger data (`boulder.json`)
- `omo/src/features/claude-tasks/storage.ts` stores runtime task decomposition under `.sisyphus/tasks`
- `omo/src/features/run-continuation-state/storage.ts` persists continuation markers
- `omo/src/features/builtin-commands/templates/start-work.ts` and `omo/docs/guide/orchestration.md` show plans, execution notes, and active run coordination living in sisyphus space

**Conclusion:**
The active OMO layer includes:
- `.sisyphus/boulder.json`
- `.sisyphus/tasks/`
- `.sisyphus/run-continuation/`
- `.sisyphus/plans/`
- `.sisyphus/notepads/`

This state is important and sometimes durable across sessions, but it is operational rather than canonical project truth.

### 3) Can they be combined safely?

Yes, but only if they are combined as **one operator-facing state model with two non-peer tiers**, not as a flat merged bucket.

**Key conclusion:**

- `.beads` should be the **durable ledger**
- `.sisyphus` should be the **active execution layer**

This means the merge should happen at the **model level**, not by collapsing all files into one undifferentiated storage namespace.

### 4) Correct authority split

**Durable ledger authority (`/.beads`)**

- task identity
- durable status
- dependencies
- approved artifacts
- handoffs and long-lived progress context
- verification history / durable proof

**Active execution authority (`/.sisyphus`)**

- current run state
- continuation markers
- boulder/session lineage
- runtime decomposition into execution tasks
- execution notepads and scratch coordination
- planning-in-progress before durable settlement

### 5) Required invariants

The Ultrabrain pass established that the design is coherent only if the system stays **asymmetrical**:

> `.beads` records truth, `.sisyphus` carries motion.

That means:

- the tiers are not peers
- active state may project from durable state
- active state may checkpoint back into durable state
- active state must not silently become a second durable ledger

---

## Unified State Architecture Recommendation

### Operator Model

The merged system should teach:

- **canonical work**
- **active execution state**

or equivalently:

- **durable state**
- **active state**

The user should not have to think in terms of “Beads vs Sisyphus.”

### Structural Model

The merged system should define **one state architecture with two time horizons**:

1. **Durable Ledger**
   - canonical project truth
   - git-native, handoff-safe, artifact-safe
   - survives sessions, branches, and execution interruptions

2. **Active Execution Layer**
   - current orchestration truth
   - tracks motion, continuation, decomposition, session lineage
   - may persist across sessions, but remains operational rather than canonical

### Join Key

The canonical join key should be:

- **`bead_id`**

Every runtime record that refers to durable work should be traceable back to one bead.

### Plan Settlement Rule

Plans may exist in active form while evolving, but:

- **approved plans must settle into durable bead artifacts**
- active-layer plans should be temporary, compatibility-only, or execution scaffolding
- approved plan truth must not remain dual-homed

---

## Overlap / Collision Map (Phase 1)

Using the settled durable-versus-active model, the unresolved comparative domains narrow into the following overlap map. This section is intentionally **pre-authority**: it records collisions, provisional resolution paths, and provisional handoff rules without promoting them to final ownership decisions.

### 1) Planning artifacts

**OCK role / evidence**

- OCK treats bead artifacts as the durable planning surface: `/.beads/artifacts/<bead-id>/prd.md` and optional `plan.md` are created and consumed by the bead workflow.
- Evidence: `ock/README.md`, `ock/.opencode/README.md`, `ock/.opencode/command/create.md`, `ock/.opencode/command/start.md`, `ock/.opencode/command/plan.md`

**OMO role / evidence**

- OMO treats planning as a dedicated orchestration phase centered on Prometheus and `.sisyphus/plans/*.md`, with planner-specific runtime constraints.
- Evidence: `omo/docs/guide/orchestration.md`, `omo/docs/reference/features.md`, `omo/src/plugin-handlers/plan-model-inheritance.ts`, `omo/src/hooks/prometheus-md-only/hook.ts`

**Collision / overlap**

- Both systems define a real planning surface, but OCK frames approved durable artifacts while OMO frames planning-in-motion and execution preparation.

**Provisional resolution path**

- **merge**

**Provisional ownership / handoff rule**

- Treat OMO planning material as the active-layer candidate while it is evolving; treat bead artifacts as the durable candidate once a plan becomes the approved execution contract.

### 2) Command surface

**OCK role / evidence**

- OCK defines a repo-local bead-first slash-command workflow: `/create -> /start -> /ship`, with `/plan`, `/verify`, `/status`, and related commands under `.opencode/command/`.
- Evidence: `ock/README.md`, `ock/.opencode/README.md`, `ock/.opencode/command/start.md`, `ock/.opencode/command/ship.md`, `ock/src/validation/command-doc.ts`

**OMO role / evidence**

- OMO defines its own built-in workflow commands and also acts as a command loader/merger across project, user, plugin, and compatibility paths.
- Evidence: `omo/docs/reference/features.md`, `omo/docs/reference/configuration.md`, `omo/src/tools/slashcommand/command-discovery.ts`, `omo/src/plugin-handlers/command-config-handler.ts`, `omo/src/features/claude-code-command-loader/loader.ts`

**Collision / overlap**

- Both systems present viable user-facing command entry points, and OMO also determines the effective loaded command set at runtime.

**Provisional resolution path**

- **re-scope**

**Provisional ownership / handoff rule**

- Treat OCK repo-local commands as the candidate project-workflow layer; treat OMO command loading and compatibility behavior as the candidate runtime assembly layer until a single default command path is chosen.

### 3) Verification

**OCK role / evidence**

- OCK treats verification as an explicit workflow gate with PRD-linked checks, `/verify`, and durable verification evidence such as `.beads/verify.log`.
- Evidence: `ock/.opencode/README.md`, `ock/.opencode/command/verify.md`, `ock/.opencode/command/ship.md`, `ock/.opencode/command/lfg.md`

**OMO role / evidence**

- OMO embeds verification into orchestration through reminders, completion gates, approval pauses, diagnostics, and runtime verifier prompts.
- Evidence: `omo/docs/guide/orchestration.md`, `omo/src/hooks/atlas/verification-reminders.ts`, `omo/src/hooks/atlas/final-wave-approval-gate.ts`, `omo/src/plugin/tool-execute-before.ts`

**Collision / overlap**

- Both systems define verification behavior, but OCK emphasizes durable workflow proof while OMO emphasizes runtime verification enforcement during orchestration.

**Provisional resolution path**

- **merge**

**Provisional ownership / handoff rule**

- Treat OMO verification flow as the active-layer candidate for running and enforcing checks; treat OCK bead artifacts and logs as the durable candidate for recording what was required and what passed.

### 4) Memory / runtime context

**OCK role / evidence**

- OCK defines repo-local memory files, project-context injection, observation tools, and plugin-based context compression/injection behavior.
- Evidence: `ock/.opencode/memory/README.md`, `ock/.opencode/opencode.json`, `ock/.opencode/plugin/README.md`, `ock/.opencode/plugin/memory.ts`, `ock/.opencode/plugin/lib/context.ts`, `ock/.opencode/plugin/lib/inject.ts`

**OMO role / evidence**

- OMO defines live session-time context injection, preemptive compaction, session model persistence, and active orchestration state under `.sisyphus`.
- Evidence: `omo/docs/guide/orchestration.md`, `omo/src/features/context-injector/injector.ts`, `omo/src/plugin/chat-message.ts`, `omo/src/hooks/preemptive-compaction.ts`, `omo/src/features/boulder-state/storage.ts`, `omo/src/features/run-continuation-state/storage.ts`

**Collision / overlap**

- Both systems shape what the agent sees at runtime: OCK through memory and prompt injection, OMO through session-state injection, continuation, compaction, and orchestration state.

**Provisional resolution path**

- **re-scope**

**Provisional ownership / handoff rule**

- Treat OCK memory/project files as the durable-context candidate; treat OMO session injection, continuation, and active orchestration state as the active-context candidate.

### 5) Model / provider plumbing

**OCK role / evidence**

- OCK includes repo-local agent model assignments, provider metadata, MCP config, and provider-shaping plugins such as Copilot auth/request handling.
- Evidence: `ock/.opencode/opencode.json`, `ock/.opencode/plugin/README.md`, `ock/.opencode/plugin/copilot-auth.ts`, `ock/.opencode/plugin/sdk/copilot/copilot-provider.ts`

**OMO role / evidence**

- OMO includes model fallback chains, provider/config merge logic, runtime model resolution, context-limit handling, and installer-generated model configuration.
- Evidence: `omo/docs/reference/configuration.md`, `omo/docs/guide/agent-model-matching.md`, `omo/src/plugin-config.ts`, `omo/src/plugin-handlers/provider-config-handler.ts`, `omo/src/shared/model-resolver.ts`, `omo/src/shared/model-requirements.ts`, `omo/src/cli/model-fallback.ts`

**Collision / overlap**

- Both systems contain model/provider behavior, but OMO more clearly acts as the runtime resolver while OCK still carries repo-local model/provider declarations and shaping logic.

**Provisional resolution path**

- **re-scope**

**Provisional ownership / handoff rule**

- Treat OCK-side model/provider settings as candidate declarative inputs where they remain repo-local; treat OMO-side resolution and fallback logic as the candidate runtime interpreter of those inputs.

### Comparative takeaway

This map is strong enough to enable the **candidate ownership matrix** as the next artifact. The remaining Phase 1 job is to convert these provisional resolution paths and handoff rules into domain-by-domain candidate authority without prematurely collapsing the work into Phase 2 architecture definition.

---

## Strongest Precedence Rule

**Durable wins on conflict unless an explicit write-back checkpoint updates it.**

This is the decisive rule because it converts the architecture from “sync two stores” into:

- active state proposes
- durable state records

Without this rule, the system collapses back into split authority.

---

## Top Failure Modes

### 1. Dual durable truth by accident

If `.sisyphus` retains approved plan, status, or verification meaning long enough to function as a second ledger, the model fails.

### 2. Checkpoint ambiguity

If runtime changes something durable-significant without a named promotion boundary, durable and active state will drift.

### 3. Join-key erosion

If runtime tasks, notes, or continuation records are not keyed to `bead_id`, active state becomes orphaned from project truth.

### 4. Compatibility-state inflation

If legacy active-layer files remain “temporary” in theory but continue to accumulate durable meaning in practice, migration stalls and split-brain returns.

### 5. Plan duplication drift

If approved plans exist simultaneously as durable bead artifacts and active sisyphus truth, later execution and verification will disagree.

---

## Minimum Constraints Required

To keep the model coherent over time, the merged system must enforce these constraints:

1. **Mandatory `bead_id` on every active record that refers to durable work**
2. **Durable-only fields must be exclusive to the durable ledger**
   - status
   - dependencies
   - approved plan
   - handoff state
   - verification evidence
3. **One-way promotion at explicit checkpoints**
   - active state may evolve
   - durable state is updated only through named write-back events
4. **Active copies become derived/provisional after promotion**
   - they must not remain peer truth
5. **Recovery test must hold**
   - if active state is lost, durable state must still tell us what work exists and what was approved

---

## Migration Guidance

The safest migration path is logical unification before physical unification.

### Phase A — authority first

- keep `/.beads` and `/.sisyphus`
- document the two-tier model
- encode precedence and join-key rules

### Phase B — eliminate duplicate durable meaning

- make approved plans durable-bead artifacts
- downgrade active-layer duplicates to compatibility or runtime scaffolding
- prevent durable fields from remaining authoritative in active state

### Phase C — optional façade

Later, if desired, introduce a unified operator-facing façade such as:

- `.opencode/state/`
- or another neutral path

But this should only happen after authority rules are already enforced.

---

## Recommendation

The architecture is **sound in principle and decision-quality**, but only if the merged system preserves the asymmetry:

- `/.beads` = durable ledger
- `/.sisyphus` = active execution layer
- `bead_id` = canonical join key
- approved plans settle into durable artifacts
- durable state wins unless checkpointed

The merge should therefore be framed as **one state system with two tiers**, not a raw folder merge.

---

## Open Items

1. Should approved plans settle directly into `/.beads/artifacts/<bead-id>/plan.md`, or is a façade path needed first?
2. Should `.sisyphus/tasks/` remain execution decomposition only, or be replaced by bead-derived runtime projections?
3. What future operator-facing terminology best hides the backend split while preserving architectural clarity?

---

## Sources

- `/work/ock-omo-system/.beads/artifacts/bd-l1s/prd.md`
- `/work/ock-omo-system/ock/.beads/README.md`
- `/work/ock-omo-system/ock/.beads/config.yaml`
- `/work/ock-omo-system/ock/.opencode/command/create.md`
- `/work/ock-omo-system/ock/.opencode/command/plan.md`
- `/work/ock-omo-system/ock/.opencode/command/verify.md`
- `/work/ock-omo-system/omo/src/features/claude-tasks/storage.ts`
- `/work/ock-omo-system/omo/src/features/boulder-state/storage.ts`
- `/work/ock-omo-system/omo/src/features/run-continuation-state/storage.ts`
- `/work/ock-omo-system/omo/src/features/builtin-commands/templates/start-work.ts`
- `/work/ock-omo-system/omo/docs/guide/orchestration.md`
