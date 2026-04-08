# Evidence Register

**Bead:** bd-l1s  
**Phase:** 1 (Reset)  
**Artifact:** 01-evidence-register.md  
**Status:** Active

---

## Evidence Categories

### Observed / Inferred / Proposed

| Category | Source | Count | Trust Level |
|----------|--------|-------|--------------|
| **Observed** | Runtime behavior, CLI outputs, direct file reads | 47 files | High |
| **Inferred** | Patterns from code analysis | 12 patterns | Medium |
| **Proposed** | Project-memory claims | 4 files | Low (requires validation) |

---

## Observed Evidence Sources

### OMO (oh-my-openagent/) Source Files

**Commands & Handlers:**
- `src/cli/index.ts` — CLI entry point, command registration
- `src/plugin-handlers/command-config-handler.ts` — Command registration and precedence
- `src/tools/slashcommand/command-discovery.ts` — Visible command authority

**State & Execution:**
- `src/features/background-agent/state.ts` — Active runtime state
- `src/features/boulder-state/storage.ts` — Active planning/state storage
- `src/cli/run/continuation-state.ts` — Continuation state evidence

**Memory & Context:**
- `src/features/context-injector/injector.ts` — Runtime context injection
- `src/shared/memory/*` — Durable memory implementation

**Configuration:**
- `src/plugin-config.ts` — Config precedence evidence
- `src/config/schema/*` — Configuration schemas

### OCK (opencodekit-template/) Source Files

**Commands:**
- `src/commands/init.ts` — OCK scaffolding/config baseline
- `src/commands/command.ts` — OCK command-shape evidence
- `src/commands/activate.ts` — Skill activation commands

**Durable State:**
- `.opencode/memory.ts` — Durable memory baseline
- `.opencode/command/*.md` — Command definitions

### Durable Ledger Evidence

- `.beads/issues.jsonl` — Bead ledger (bd-l1s, bd-b6a, bd-k8z, bd-x0u)
- `.beads/config.yaml` — Bead configuration
- `.sisyphus/plans/*.md` — Sisyphus plan files (if exist)

---

## Historical Inputs (Raw Only)

These files exist but are not treated as authoritative evidence:

| File | Purpose | Raw Value Only |
|------|---------|----------------|
| `.sisyphus/plans/phase-1-hard-reset.md` | Reset specification reference | Yes |
| `.opencode/command/create.md` | Workflow contract reference | Yes |
| `.opencode/command/start.md` | Workflow contract reference | Yes |
| `.opencode/command/plan.md` | Workflow contract reference | Yes |

---

## Quarantined Artifacts

The following are **QUARANTINED** — claims treated as Proposed only:

| File | Claim Type | Validation Required |
|------|------------|---------------------|
| `opencodekit-template/.opencode/memory/project/project.md` | Architecture charter | Yes |
| `opencodekit-template/.opencode/memory/project/roadmap.md` | Phase/gate roadmap | Yes |
| `opencodekit-template/.opencode/memory/project/state.md` | Steering state | Yes |

These files may contain accurate information but require validation against higher-precedence evidence before being treated as truth.

---

## Precedence Order

Evidence authority (highest to lowest):

1. **Runtime Behavior** — Executing code, CLI outputs, runtime state dumps
2. **Source Files** — TypeScript/JSON source files (not `dist/` mirrors)
3. **Durable State Files** — `.beads/issues.jsonl`, `.sisyphus/plans/*.md`
4. **Project Memory** — `.opencode/memory/project/*.md` → **QUARANTINED**
5. **Generated Artifacts** — `dist/`, `node_modules/` → **Secondary**

---

## Proof Limits

- **No credentials** — Evidence collection does not require secrets
- **No production** — No external environment access needed
- **Bounded to artifact scope** — Research only, no implementation

---

## Next Steps

This evidence register feeds into domain audits (02–07):
- Each audit must cite evidence from this register
- Proposed claims from quarantined files must be flagged
- Contradictions between observed and proposed become audit findings