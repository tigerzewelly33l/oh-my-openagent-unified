# Planning Ownership Audit

**Bead:** bd-l1s  
**Phase:** 1 (Reset)  
**Artifact:** 04-planning-ownership-audit.md  
**Status:** Active

---

## Audit Schema

| Field | Value |
|-------|-------|
| Question | Where does durable planning live vs runtime planning behavior, and what plan-meaning collisions exist? |
| Current Behavior | See Durable Plan Artifact and Runtime Planning Behavior sections |
| Claimed Behavior | Project-memory claims about unified planning system (QUARANTINED) |
| Evidence | Source file analysis from prometheus/, boulder-state/, sisyphus/plans/, plan-model-inheritance.ts |
| Contradictions | See Plan Meaning Collisions section |
| Authority Candidates | Split: OMO owns Prometheus/durable plans, OCK has no planning system |
| Unresolved Questions | See below |
| Confidence | High |
| Gate Impact | Non-Blocking |

---

## Durable Plan Artifact

### OMO (oh-my-openagent/) — Durable Planning

**Prometheus Plans (`.sisyphus/plans/`):**
- Prometheus agent generates markdown plans with checkbox tasks
- Location: `.sisyphus/plans/{plan-name}.md`
- Format: `- [ ] task` / `- [x] completed task`
- Persistent across sessions (file-based)

**Evidence:**
- `src/agents/prometheus/plan-generation.ts:94` — "Generate the work plan immediately to `.sisyphus/plans/{name}.md`"
- `src/agents/prometheus/plan-template.ts:10` — "Generate plan to: `.sisyphus/plans/{name}.md`"
- `src/agents/prometheus/identity-constraints.ts:122` — "Your ONLY valid output locations are `.sisyphus/plans/*.md`"

**Boulder State (`.boulder/`):**
- Tracks active plan reference and task session state
- `boulder.json` stores: active_plan, plan_name, task_sessions
- Links `.sisyphus/plans/` files to active execution state

**Evidence:**
- `src/features/boulder-state/storage.ts:18-54` — readBoulderState()
- `src/features/boulder-state/types.ts:8-24` — BoulderState interface

**Plan Model Inheritance:**
- `src/plugin-handlers/plan-model-inheritance.ts:13-26` — buildPlanDemoteConfig()
- Allows prometheus config to flow into subagent plan behavior

### OCK (opencodekit-template/) — Durable Planning

**None Observed:**
- No `.sisyphus/` directory
- No Prometheus agent
- No boulder-state system
- No durable plan files

**Evidence:**
- `glob opencodekit-template/.sisyphus/` — no matches
- `grep -r "plan" opencodekit-template/src/commands/` — only command definitions, no planning logic

---

## Runtime Planning Behavior

### OMO (oh-my-openagent/) — Runtime Planning

**Prompt-Based Planning:**
- Prometheus uses LLM to generate plans from prompts
- Plan generation happens at runtime during agent execution
- Plans are written to `.sisyphus/plans/` as durable artifacts

**Runtime Hook Integration:**
- `prometheus-md-only` hook monitors `.sisyphus/plans/` writes
- `atlas` agent reads plans for task tracking
- `sisyphus-junior-notepad` treats plans as "SACRED and READ-ONLY"

**Evidence:**
- `src/hooks/prometheus-md-only/hook.ts:64` — detects writes to `.sisyphus/plans/`
- `src/agents/atlas/agent.ts:135` — "User provides a todo list path (.sisyphus/plans/{name}.md)"
- `src/hooks/sisyphus-junior-notepad/constants.ts:16-20` — PLAN PATH guardrails

### OCK (opencodekit-template/) — Runtime Planning

**None Observed:**
- No runtime planning hooks
- No planning agent integration
- CLI commands are stateless (execute → exit)

**Evidence:**
- No hooks related to planning in opencodekit-template/src/
- No agent files in opencodekit-template/src/agents/

---

## Plan Meaning Collisions

| Collision | Description | Severity |
|-----------|-------------|----------|
| **Term Overload** | "plan" means both: (1) Prometheus markdown file, (2) general task list | Medium |
| **Durable vs Runtime** | Plans are file-based (durable) but generated at runtime | Low |
| **Plan Path Conflicts** | OMO path `.sisyphus/plans/` conflicts with any future OCK plans | Medium |
| **Boulder vs Plan** | `boulder.json` active_plan points to `.sisyphus/plans/` — two systems for same plan | Medium |

**Evidence:**
- `src/features/boulder-state/storage.ts:14-16` — getBoulderFilePath() uses `.boulder/`
- `src/agents/prometheus/identity-constraints.ts:117-122` — explicit path enforcement

---

## Authority Candidates

### Clearly OMO
- Prometheus plan generation (`src/agents/prometheus/`)
- `.sisyphus/plans/` file management
- `.boulder/` active plan tracking
- Atlas task execution from plans

### Clearly OCK
- None — OCK has no planning system

### Genuinely Split
- Plan artifact format — markdown with checkboxes (OMO standard)
- No shared plan registry between systems

### Still Ambiguous
- Should OCK adopt Prometheus-style plans?
- Can OMO plans be used in OCK workflow?
- Is there value in a unified "plan" concept?

---

## Unresolved Questions

1. **Plan Standard** — Should OCK adopt the `.sisyphus/plans/*.md` format, or maintain separate?
2. **Boulder Integration** — Should OCK use boulder-state for active plan tracking?
3. **Plan vs Bead** — How do bead-scoped plans relate to Prometheus plans?
4. **Path Conflict** — Is `.sisyphus/plans/` reserved for OMO, or shared workspace?

---

## Gate Impact

**Non-Blocking** — Planning authority is clearly OMO-owned. OCK has no planning system, making this a capability gap rather than a blocking contradiction. The question of whether OCK needs a planning system should be resolved in Phase 2 architecture work.

---

## Next Steps

This audit feeds into the contradiction synthesis (08):
- Planning is entirely OMO-owned
- OCK has no durable or runtime planning
- No overlap exists beyond shared workspace