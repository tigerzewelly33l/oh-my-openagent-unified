# Cross-Domain Contradiction and Authority Map

**Bead:** bd-l1s  
**Phase:** 1 (Reset)  
**Artifact:** 08-conflict-authority-map.md  
**Status:** Draft

---

## Purpose

This artifact synthesizes findings from the seven domain audits (02–07) into a unified authority map with explicit contradiction buckets. It answers: Where does authority actually live? What contradictions exist? What blocks Phase 2?

---

## Summary Authority Matrix

| Domain | Clearly OCK | Clearly OMO | Genuinely Split | Still Ambiguous |
|--------|-------------|-------------|-----------------|------------------|
| **Command Authority** | Static command registration | Dynamic discovery, 52 hooks | Visible vs execution separation | Unified registry? |
| **State Authority** | None | `.boulder/`, `.sisyphus/`, session state | Shared `.beads/` | OCK state needs? |
| **Planning Ownership** | None | Prometheus plans, boulder tracking | Plan format (markdown) | OCK planning? |
| **Memory/Context** | SQLite/FTS5, durable memory | Runtime context injection | Context injection authority | Unify context? |
| **Config Precedence** | CLI scaffolding | Multi-level merge, Zod schema | No cross-system merge | Coexistence rules? |
| **Verification/Writeback** | `/verify` command, verify.log | Hook-based verification, QA fields | Dual systems, no coordination | Unified path? |

---

## Blocking Contradictions

### BC-1: Verification Write-Back Gap

**Severity:** Blocking

**Description:** Active boulder state can be cleared via `/stop-continuation` without any durable bead checkpoint. OCK verification expects `.beads/verify.log` evidence, but OMO active state cleanup bypasses bead artifacts entirely.

**Evidence:**
- `omo/src/plugin/tool-execute-before.ts:178-183` — `clearBoulderState()` without checkpoint
- Artifact 07, Finding 4: Phase 2 Gate Risk

**Impact:** Phase 2 cannot trust completion claims if active state can be cleared without verification artifact sync.

**Resolution:** Require bead checkpoint before active state cleanup.

---

### BC-2: No Unified Verification Path

**Severity:** Blocking

**Description:** OCK verification (`/verify`) and OMO hook-based verification operate independently. OCK checks `.beads/verify.log`; OMO uses completion prompts and QA field enforcement. No coordination exists.

**Evidence:**
- Artifact 07, Finding 1: Dual Verification Systems
- `.opencode/command/verify.md` vs `omo/src/hooks/todo-continuation-enforcer/`

**Impact:** A bead can appear complete in OMO hooks but incomplete in OCK verification, blocking Phase 2 handoff.

**Resolution:** Define unified verification path with shared write-back to `.beads/verify.log`.

---

### BC-3: Command Surface Mismatch

**Severity:** Non-Blocking (documentation only)

**Description:** OCK uses static command registration; OMO uses dynamic file-system discovery + 52 lifecycle hooks. The "visible command" differs from the "executed command."

**Evidence:**
- Artifact 02, Conflict Matrix: Dynamic vs Static discovery
- `omo/src/tools/slashcommand/command-discovery.ts` vs `ock/src/commands/command.ts`

**Impact:** User-visible commands may not reflect actual execution authority. Non-blocking for Phase 2 but should be documented.

**Resolution:** Document in Phase 2 architecture; no immediate action needed.

---

## Authority Buckets

### Clearly OCK

| Capability | Evidence | Notes |
|------------|----------|-------|
| Durable Memory (SQLite/FTS5) | `.opencode/memory/memory.db` | Full LTM pipeline |
| Memory Tools | observation, memory-search, etc. | 6 dedicated tools |
| Project Memory Files | `.opencode/memory/project/*.md` | User preferences, tech stack |
| Static Command Registration | `src/commands/command.ts` | Abstract base class pattern |
| CLI Scaffolding | `src/commands/init.ts` | Project bootstrap |
| Skill Activation | `src/commands/activate.ts` | Enable/disable skills |

### Clearly OMO

| Capability | Evidence | Notes |
|------------|----------|-------|
| Dynamic Command Discovery | `command-discovery.ts` | File-system scan |
| Lifecycle Hooks (52) | `src/plugin/hooks/` | Session, tool-guard, transform, continuation, skill |
| Active State (.boulder/) | `src/features/boulder-state/` | Plan tracking |
| Plan Files (.sisyphus/) | `.sisyphus/plans/*.md` | Prometheus plans |
| Background Agent | `src/features/background-agent/` | Task execution |
| Runtime Context Injection | `src/features/context-injector/` | Priority-based |
| Multi-Level Config Merge | `src/plugin-config.ts` | User + project + defaults |
| Zod Schema Validation | `src/config/schema/` | 27 schema files |

### Genuinely Split

| Concern | OCK Side | OMO Side | Conflict |
|---------|----------|----------|----------|
| Context Injection | LTM via system.transform | ContextCollector via experimental.chat.messages.transform | Both inject, no coordination |
| Skill System | Command-based activation (activate.ts) | Hook-based loading (4 scopes) | Different paradigms |
| Config Files | `opencode.json` | `oh-my-opencode.jsonc` | No precedence rules |
| Verification | `/verify` command + verify.log | Hook prompts + QA fields | Dual systems |
| Bead Access | Read-only | Read-write | OMO writes, OCK reads |

### Still Ambiguous

| Question | Evidence | Phase 2 Relevance |
|----------|----------|-------------------|
| Unified command registry? | Artifact 02, Unresolved Questions | Core workflow design |
| OCK state layer needs? | Artifact 03, Still Ambiguous | Architecture decision |
| OCK planning adoption? | Artifact 04, Still Ambiguous | Workflow integration |
| Context pipeline unification? | Artifact 05, Still Ambiguous | Memory system design |
| Config coexistence rules? | Artifact 06, Unresolved Questions | Project setup |
| Unified verification path? | Artifact 07, Unresolved Questions | Gate enforcement |

---

## Cross-Domain Dependencies

```
Command Authority (02)
  └─ Config (06) → Commands discovered from .opencode/command/ directories
  └─ Verification (07) → /verify is a command

State Authority (03)
  └─ Planning (04) → .boulder/ tracks active plan
  └─ Verification (07) → Active state affects completion claims

Memory (05)
  └─ Config (06) → Memory settings in oh-my-opencode.jsonc
  └─ Verification (07) → Memory state can affect verification context

Planning (04)
  └─ Command (02) → /plan is a command
  └─ State (03) → Plans tracked in .boulder/
```

---

## Gate Readiness Assessment

| Gate Criterion | Status | Evidence |
|----------------|--------|----------|
| Command authority documented | ✅ Pass | Artifact 02 complete |
| State authority mapped | ✅ Pass | Artifact 03 complete |
| Planning ownership identified | ✅ Pass | Artifact 04 complete |
| Memory/context split understood | ✅ Pass | Artifact 05 complete |
| Config precedence documented | ✅ Pass | Artifact 06 complete |
| Verification/writeback analyzed | ⚠️ Blocking | BC-1, BC-2 (write-back gap) |
| No blocking contradictions | ⚠️ No | BC-1, BC-2 block Phase 2 |

**Phase 2 May Begin Only When:**
- BC-1 resolved: Bead checkpoint added before active state cleanup
- BC-2 resolved: Unified verification path defined with shared write-back

---

## Non-Blocking Findings (Phase 2 Can Proceed With)

1. **Command surface mismatch** — Documentation only, no runtime conflict
2. **Memory/context split** — Different paradigms, no blocking overlap
3. **Config coexistence** — Both systems functional within boundaries
4. **Planning ownership** — Entirely OMO-owned, no OCK conflict

---

## References

- `.beads/artifacts/bd-l1s/phase-1-reset/02-command-authority-audit.md`
- `.beads/artifacts/bd-l1s/phase-1-reset/03-state-authority-audit.md`
- `.beads/artifacts/bd-l1s/phase-1-reset/04-planning-ownership-audit.md`
- `.beads/artifacts/bd-l1s/phase-1-reset/05-memory-context-audit.md`
- `.beads/artifacts/bd-l1s/phase-1-reset/06-config-precedence-audit.md`
- `.beads/artifacts/bd-l1s/phase-1-reset/07-verification-writeback-audit.md`