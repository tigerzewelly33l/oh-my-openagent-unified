# State Authority Audit

**Bead:** bd-l1s  
**Phase:** 1 (Reset)  
**Artifact:** 03-state-authority-audit.md  
**Status:** Active

---

## Audit Schema

| Field | Value |
|-------|-------|
| Question | Where does durable truth live vs active runtime truth, and what are the join-key relationships? |
| Current Behavior | See Durable Truth Inventory and Active Runtime Truth Inventory sections |
| Claimed Behavior | Project-memory claims about unified state management (QUARANTINED) |
| Evidence | Source file analysis from boulder-state/, bead systems, session state |
| Contradictions | See Join-Key Evidence and Shadow Overlap sections |
| Authority Candidates | Split: OMO owns all observed state systems, OCK has no comparable state layer |
| Unresolved Questions | See below |
| Confidence | High |
| Gate Impact | Non-Blocking |

---

## Durable Truth Inventory

### OMO (oh-my-openagent/) — Durable State

**Bead Ledger (`.beads/`):**
- `.beads/issues.jsonl` — Bead registry with IDs, titles, status, priorities
- `.beads/beads.db` — SQLite database for bead metadata
- `.beads/config.yaml` — Bead configuration
- `.beads/artifacts/bd-*/` — Per-bead artifact storage

**Boulder State (`.boulder/`):**
- `src/features/boulder-state/storage.ts` — Reads/writes `.boulder/boulder.json`
- `.boulder/boulder.json` — Active plan tracking with session_ids, task_sessions
- Stores: active_plan, started_at, session_ids[], plan_name, agent, worktree_path, task_sessions

**Prometheus Plans (`.sisyphus/plans/`):**
- Named plans with checkboxes, task tracking (file reference, not yet verified)

**Evidence:**
- `src/features/boulder-state/storage.ts:18-54` — readBoulderState() with JSON validation
- `src/features/boulder-state/storage.ts:56-85` — writeBoulderState() with atomic write
- `src/features/boulder-state/types.ts:8-24` — BoulderState interface definition

### OCK (opencodekit-template/) — Durable State

**Bead Ledger (inherited via workspace):**
- `.beads/issues.jsonl` — Shared bead registry
- `.beads/artifacts/` — Shared artifact storage

**No Native State Layer:**
- No equivalent to boulder-state/ — no active plan tracking
- No .boulder/ directory or boulder.json
- No .sisyphus/ directory for plans

**Evidence:**
- glob `opencodekit-template/src/**/*state*` — no matches
- No state management in src/commands/*.ts

---

## Active Runtime Truth Inventory

### OMO (oh-my-openagent/) — Runtime State

**Session State (`src/shared/`):**
- `session-model-state.ts` — Current model per session
- `session-prompt-params-state.ts` — Prompt parameters per session
- `session-cursor.ts` — Cursor state for continuation

**Feature State (`src/features/`):**
- `claude-code-session-state.ts` — Subagent session tracking (subagentSessions Map)
- `background-agent/` — Task lifecycle state (pending/running/completed/error)
- `run-continuation-state.ts` — Continuation state persistence

**Plugin State (`src/plugin/`):**
- `plugin-state.ts` — Global plugin state
- Tool execution metadata store

**Evidence:**
- `src/features/claude-code-session-state.ts` — Map<subagentID, SessionInfo>
- `src/features/background-agent/` — BackgroundManager with task state machine
- `src/shared/session-model-state.ts` — getSessionModel(), setSessionModel()

### OCK (opencodekit-template/) — Runtime State

**None Observed:**
- No session state management
- No task lifecycle management
- No runtime context tracking

**Evidence:**
- No session-related state files in src/
- CLI commands are stateless (execute → exit)

---

## Join-Key Evidence

| Relationship | OMO System | Join Key | Status |
|--------------|-----------|----------|--------|
| Bead → Artifact | .beads/issues.jsonl → .beads/artifacts/bd-*/ | bead ID (bd-*) | Defined |
| Plan → Task | .sisyphus/plans/*.md → boulder.json | plan_name | Partial |
| Session → Task | session_ids[] → task_sessions{} | session_id | Defined |
| Session → Model | session_model_state → chat messages | sessionID | Defined |

**Join-Key Conflicts:**
- bead IDs use format `bd-xxx` (from .beads/issues.jsonl)
- planner task references use format `todo:1`, `final-wave:F1` (from Prometheus)
- No guaranteed unique key across systems

---

## Shadow Overlap

**OMO Internal Overlap:**
- `boulder-state` stores active_plan path
- `sisyphus/plans/` contains plan files with same active_plan name
- Potential drift if plan file moves without boulder.json update

**OMO → OCK Overlap:**
- Shared `.beads/` directory (workspace-level)
- OCK can read bead artifacts but has no write path
- No OCK-native state to overlap

**Evidence:**
- `src/features/boulder-state/storage.ts:14-16` — getBoulderFilePath() uses `.boulder/boulder.json`
- `.beads/` is workspace-level, accessible to both products

---

## Authority Candidates

### Clearly OMO
- `.beads/` bead ledger management
- `.boulder/` active plan state
- `.sisyphus/` plan file management
- Session state (session-model-state, session-prompt-params)
- Background task state (background-agent/)
- Continuation state (run-continuation-state/)

### Clearly OCK
- None — OCK has no state layer

### Genuinely Split
- Shared `.beads/` workspace — both read, OMO writes

### Still Ambiguous
- Should OCK adopt boulder-state pattern for plan tracking?
- Is shared `.beads/` sufficient for OCK state needs?
- What is the canonical "project state" beyond bead tracking?

---

## Unresolved Questions

1. **State Scope** — What constitutes "project state" for OCK? Bead tracking alone?
2. **Boulder Adoption** — Should OCK integrate boulder-state for plan tracking?
3. **Join-Key Hygiene** — Can bead IDs and planner task references be unified?
4. **Shadow Authority** — Who "owns" .boulder/ when both products run in same workspace?

---

## Gate Impact

**Non-Blocking** — The state authority split is documented. OMO owns all observed state systems; OCK has none. This is a genuine capability gap for OCK, not a blocking contradiction. The question of whether OCK needs its own state layer should be resolved in Phase 2 architecture work.

---

## Next Steps

This audit feeds into the contradiction synthesis (08):
- State authority is clearly OMO-owned
- OCK has no comparable durable or runtime state
- Shared .beads/ is the only overlap point