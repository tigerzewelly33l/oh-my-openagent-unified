# Reset Rules and Quarantine Protocol

**Bead:** bd-l1s  
**Phase:** 1 (Reset)  
**Artifact:** 00-reset-rules-and-quarantine.md  
**Status:** Active

---

## Evidence vs Claims

This reset distinguishes between **observable evidence** and **stated claims**:

| Category | Definition | Trust Level |
|----------|------------|--------------|
| **Observed Evidence** | Direct file reads, command outputs, runtime behavior captured during this bead | High |
| **Inferred Evidence** | Patterns derived from multiple observed data points | Medium |
| **Proposed Claims** | Statements from project-memory files, roadmaps, or architecture docs | Low (requires validation) |
| **Historical Inputs** | Past decisions, old specs, or deprecated patterns that inform but don't govern | Low |

---

## Source-of-Truth Precedence

Evidence authority is ordered as follows (highest to lowest):

1. **Runtime Behavior** — Executing code, CLI outputs, runtime state dumps
2. **Source Files** — TypeScript/JSON/MD source files in `src/` or root (not `dist/` mirrors)
3. **Durable State Files** — `.beads/issues.jsonl`, `.sisyphus/plans/*.md`
4. **Project Memory** — `.opencode/memory/project/*.md` → **QUARANTINED as Proposed Claims**
5. **Generated Artifacts** — `dist/`, `node_modules/`, cached outputs → **Secondary to source**

**Rule:** Lower-precedence evidence cannot override higher-precedence evidence. Project-memory claims must be validated against higher-precedence evidence before being treated as truth.

---

## Quarantined Files

The following files are quarantined — their claims are treated as **Proposed Claims** requiring validation:

| File | Reason for Quarantine |
|------|----------------------|
| `.opencode/memory/project/project.md` | Conclusion-heavy architecture charter, not validated in this reset |
| `.opencode/memory/project/roadmap.md` | Phase/gate roadmap claims predate this reset |
| `.opencode/memory/project/state.md` | Steering state contains claims not verified by current evidence |

These files may contain accurate information, but the reset cannot assume their correctness. Each claim must be re-validated against source-of-truth precedence.

---

## Audit Schema

Every domain audit artifact (02–07) must use this schema:

```yaml
Question: <specific question this audit answers>
Current Behavior: <what source files/runtime show today>
Claimed Behavior: <what project-memory or docs claim>
Evidence: <file paths, command outputs, or runtime observations>
Contradictions: <where current and claimed diverge>
Authority Candidates: <OCK, OMO, Split, or Ambiguous>
Unresolved Questions: <gaps requiring deeper research>
Confidence: <High / Medium / Low>
Gate Impact: <Blocking / Non-Blocking / Informational>
```

**Requirements:**
- Every audit MUST have at least one `Contradiction` entry if current and claimed differ
- `Authority Candidates` must be categorized as: **Clearly OCK**, **Clearly OMO**, **Genuinely Split**, or **Still Ambiguous**
- `Gate Impact` determines whether this audit blocks Phase 2 restart
- All evidence must cite file paths or command outputs (not project-memory claims)

---

## Reset Principles

1. **Zero Trust** — No claim is accepted without evidence; no evidence is trusted without source verification
2. **Bounded Scope** — Audit artifacts (02–07) remain research-only; no implementation or redesign
3. **Explicit Contradictions** — Divergences between observed and claimed are documented, not smoothed over
4. **Gate Transparency** — Phase 2 restart conditions are explicit, not implied
5. **Verification Required** — Every claim in every audit must be backed by cited evidence

---

## Next Steps

This protocol governs all subsequent artifacts:
- **01-evidence-register.md** — Inventory of all evidence sources
- **02–07** — Domain audits using the schema above
- **08** — Contradiction synthesis
- **09** — Phase 2 restart gate