# Verification and Write-Back Authority Audit

**Bead:** bd-l1s  
**Phase:** 1 (Reset)  
**Artifact:** 07-verification-writeback-audit.md  
**Status:** Draft

---

## Audit Schema

| Field | Value |
|-------|-------|
| Question | Where does verification run, where does approval-relevant evidence write back, where does shadow authority appear, and what does this mean for the Phase 2 gate? |
| Current Behavior | See Verification Sources, Write-Back Authority, and Shadow Authority sections |
| Claimed Behavior | Project-memory claims about unified verification (QUARANTINED) |
| Evidence | Source file analysis from verify.md, verification-before-completion skill, bead workflow files |
| Contradictions | See findings below |
| Authority Candidates | Split: OCK owns verification command, OMO has independent verification hooks, no unified write-back |
| Unresolved Questions | See below |
| Confidence | High |
| Gate Impact | Blocking (if not addressed) |

---

## Verification Sources

### OCK (opencodekit-template/)

**Verification Command:** `/verify` — defined in `.opencode/command/verify.md`

**Verification Flow:**
```
1. Load bead PRD and artifacts (prd.md, plan.md, research.md)
2. Check verification cache (.beads/verify.log)
3. Phase 2: Completeness — verify each PRD requirement against implementation
4. Phase 3: Correctness — run gates (typecheck, lint, test, build)
5. Phase 4: Coherence — cross-reference artifacts for contradictions
6. Phase 5: Report — output result and add comment to bead
7. Write PASS stamp to .beads/verify.log
```

**Evidence:**
- `.opencode/command/verify.md:43-60` — Cache check using git stamp
- `.opencode/command/verify.md:119-123` — Write PASS to verify.log
- `.opencode/skill/verification-before-completion/SKILL.md:164-187` — Gate enforcement via verify.log

**Verification Modes:**
| Mode | Trigger | Behavior |
|------|---------|----------|
| Incremental | Default, <20 changed files | Lint/test changed files only |
| Full | `--full` flag, >20 changed, or ship | Lint/test all files |

### OMO (oh-my-openagent/)

**Verification Mechanisms:**

1. **Todo Continuation Enforcer** — verifies completion claims via prompts
   - `src/hooks/todo-continuation-enforcer/` — injects verification prompts
   - Checks for "QA: [how to verify]" field in tasks

2. **Ultrawork Hook** — enforces verification criteria
   - `src/hooks/keyword-detector/ultrawork/default.ts:205-214` — mandates QA field
   - Triggers on "complete", "done", "finished" keywords

3. **Review Work Skill** — multi-agent verification
   - `src/features/builtin-skills/skills/review-work.ts` — 5 parallel sub-agents
   - Oracle (goal/constraint verification), code quality, security, QA, context mining

4. **Agent Self-Verification** — built into agent prompts
   - Sisyphus: "Re-verify after EVERY fix attempt"
   - Hephaestus: "verify before assuming", "verify by checking one more layer"

**Evidence:**
```
verify.md phases:
  ├─ Phase 0: Cache check (.beads/verify.log)
  ├─ Phase 2: Completeness (PRD requirements)
  ├─ Phase 3: Correctness (gates: typecheck, lint, test)
  ├─ Phase 4: Coherence (artifact cross-reference)
  └─ Phase 5: Report (bead comment)

OMO verification hooks:
  ├─ todo-continuation-enforcer/ — completion claim verification
  ├─ keyword-detector/ultrawork/ — QA field enforcement
  ├─ builtin-skills/review-work.ts — multi-agent verification
  └─ agent prompts — self-verification requirements
```

---

## Write-Back Authority

### Verification Write-Back Locations

| System | Write-Back Location | Write-Back Trigger |
|--------|--------------------|--------------------|
| OCK `/verify` | `.beads/verify.log` | Successful gate completion |
| OCK `/verify` | `.beads/issues.jsonl` (comment) | Verification report |
| OCK `/ship` | `.beads/artifacts/$ARGUMENTS/progress.txt` | Ship command |
| OMO Hooks | Active runtime state only | Session lifecycle |
| Bead progress | `.beads/artifacts/$ARGUMENTS/progress.txt` | Manual or skill |

### Verify.Log Format

```
<sha256-stamp> <ISO-timestamp> <PASS|FAIL>
```

**Example:**
```
a1b2c3d4e5f6... 2026-04-08T12:34:56Z PASS
```

**Cache Validation:**
- Compares current git HEAD + diff against last stamp
- If unchanged since last PASS → skip verification (cached PASS)
- If files changed → re-run gates

**Evidence:**
- `.opencode/skill/verification-before-completion/references/VERIFICATION_PROTOCOL.md:111` — PASS stamp format
- `.opencode/skill/verification-before-completion/SKILL.md:179-187` — Cache invalidation rules

### Progress.txt Write-Back

**Location:** `.beads/artifacts/<bead-id>/progress.txt`

**Write-Back Triggers:**
- `/ship` command appends progress
- `prd-task` skill updates progress
- Manual updates via agent

**Format:** Append-only, timestamped entries

**Evidence:**
- `.opencode/command/ship.md:88-100` — Progress append on ship
- `.opencode/skill/prd-task/SKILL.md:43` — Ensure progress.txt exists

---

## Shadow Authority

### Hidden Verification Paths

| Authority Type | Location | Description |
|---------------|----------|-------------|
| Active State Cleanup | `omo/src/plugin/tool-execute-before.ts:178-183` | `/stop-continuation` clears boulder state without bead checkpoint |
| Hook-Based Verification | `omo/src/hooks/*` | Verification happens in hooks, not in bead artifacts |
| Runtime-Only Evidence | `omo/src/features/boulder-state/` | Active planning state not persisted to bead artifacts |

### Key Finding: Write-Back Gap

**Risk:** Active boulder state can be cleared without any durable bead checkpoint.

**Evidence:**
- `omo/src/plugin/tool-execute-before.ts:178-183` — `clearBoulderState(ctx.directory)` on `/stop-continuation`
- No checkpoint to `.beads/` before cleanup
- Session state lost, bead artifacts not updated

**Contradiction:** OCK verification expects durable artifacts, but OMO active state can be cleared without artifact sync.

---

## Findings

### Finding 1: Dual Verification Systems

| Aspect | OCK | OMO |
|--------|-----|-----|
| Command | `/verify` | N/A (hook-based) |
| Cache | `.beads/verify.log` | None (runtime only) |
| Gate enforcement | verify.log read before ship | Hook prompts on completion claims |
| Artifact binding | PRD vs implementation | QA field enforcement |

**Contradiction:** No coordination between OCK verification and OMO hooks.

### Finding 2: Write-Back Fragmentation

- `.beads/verify.log` — OCK verification cache
- `.beads/issues.jsonl` — Bead status/comments
- `.beads/artifacts/$ARGUMENTS/progress.txt` — Ship progress
- Active runtime state — OMO hooks only

**Contradiction:** No single source of truth for verification state.

### Finding 3: Cache Stamp Vulnerabilities

| Vulnerability | Description |
|--------------|-------------|
| Git dependency | Cannot work without git repo |
| Diff-only | Ignores new untracked files |
| Timestamp only | No enforcement of recent verification |

### Finding 4: Phase 2 Gate Risk

**Blocking Issue:** If verification runs in OMO hooks but OCK `/verify` is not run:
- OCK cannot detect completion
- Bead cannot ship
- Phase 2 handoff blocked by incomplete verification

---

## Unresolved Questions

| Question | Impact | Resolution Path |
|----------|--------|------------------|
| Should OMO hooks write to verify.log? | High | Define unified verification path |
| What happens if active state clears without checkpoint? | High | Add bead checkpoint before clear |
| Can OCK verify detect OMO completion claims? | Medium | Add hook detection to verify |

---

## Gate Impact

**Blocking:** The write-back gap between active state clearing and bead checkpoint creates a Phase 2 blocker. If `/stop-continuation` clears state without updating bead artifacts, verification cannot prove completion.

**Recommendation:** Require bead checkpoint before active state cleanup.

---

## References

- `.opencode/command/verify.md` — OCK verification command
- `.opencode/skill/verification-before-completion/SKILL.md` — Verification skill
- `omo/src/hooks/todo-continuation-enforcer/` — Completion verification hooks
- `omo/src/plugin/tool-execute-before.ts:178-183` — State clear without checkpoint
- `omo/src/features/builtin-skills/skills/review-work.ts` — Multi-agent verification