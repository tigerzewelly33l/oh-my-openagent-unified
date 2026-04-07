# Beads PRD Template

**Bead:** bd-x0u  
**Created:** 2026-04-06  
**Status:** Draft

## Bead Metadata

```yaml
depends_on: []
parallel: false
conflicts_with: []
blocks: []
estimated_hours: 8
```

---

## Problem Statement

### What problem are we solving?

The bead/process adapter work is still the same core problem: OCK needs OmO process and skill behavior to honor the bead-first contract cleanly and consistently. Durable workflow state lives in `/.beads`, bead artifacts live in `/.beads/artifacts/<bead-id>/`, and project `.opencode` commands and skills remain the canonical workflow surface. The mistake in the earlier artifact set was target selection, not bead intent. Those artifacts treated Bun-installed `opencodekit` copies and package cache copies as the implementation authority, which is not durable for the customization work we actually want.

For `bd-x0u`, the correct source of truth is the editable local OmO source at `/root/.config/opencode/omo`, with runtime wiring in `/root/.config/opencode/opencode.json` pointing to `file:///root/.config/opencode/omo`. The goal is to adapt that local OmO source so it fits the OCK contract without drifting into Bun-installed or cache-only paths.

### Why now?

The lifecycle itself is already settled: use bead memory and prior context, then `/create`, `/research`, `/start`, `/plan`, `/ship` or ultrawork, review until PR-ready, `/pr`, and only then repeat from a clean workspace. What changed is that the exploration work has now established the real durable target. Resetting the bead around the local OmO source prevents future research, planning, and implementation from continuing on the wrong path.

### Who is affected?

- **Primary users:** Developers customizing OmO so it fits OCK through the local editable source at `/root/.config/opencode/omo`
- **Secondary users:** Future agents relying on `/.beads` as the durable workflow ledger and on the runtime plugin entry at `file:///root/.config/opencode/omo`

---

## Scope

### In-Scope

- Define the bead/process adapter work strictly against `/root/.config/opencode/omo` as the implementation source of truth
- Use `/root/.config/opencode/opencode.json` only as the runtime wiring reference that proves OmO loads from the local source path
- Align future research, planning, and implementation artifacts so they point only at the local OmO source, the runtime file-path plugin entry, and root bead artifacts
- Preserve the root bead-first workflow contract as the durable authority

### Out-of-Scope

- Any implementation work against `/root/.bun/install/global/node_modules/opencodekit`
- Any implementation work against `/root/.cache/opencode/packages/**`
- Changes to unrelated workspace repos or historical experiment repos
- Broad redesign of the OCK contract itself
- Treating installed or cached package copies as durable customization seams

---

## Proposed Solution

### Overview

Use the root bead ledger `/.beads` for durable task state and treat `/root/.config/opencode/omo` as the only implementation authority for this bead. Research and implementation should focus on the local OmO repo’s real editable seams: source entry and plugin composition in `src/index.ts`, config loading and compatibility behavior in `src/plugin-config.ts`, repo-level guidance in `AGENTS.md`, and any nearby local OmO documentation that explains how the plugin should behave when loaded through `file:///root/.config/opencode/omo`. This bead should produce a file-backed understanding of how the local OmO source should honor the OCK bead-first contract without falling back to Bun-installed or cache-only copies.

### User Flow (if user-facing)

1. User creates a bead in `/.beads`
2. Research and planning artifacts are written under `/.beads/artifacts/<bead-id>/`
3. OpenCode runtime loads the plugin from `file:///root/.config/opencode/omo`
4. Local OmO source behavior is researched and adapted from `/root/.config/opencode/omo`
5. The canonical bead-first loop remains: `/create` → `/research` → `/start` → `/plan` → `/ship`/ultrawork → review → `/pr`

---

## Requirements

### Functional Requirements

#### Correct Target Authority

All implementation analysis for this bead must target the local OmO source and its runtime wiring, not Bun-installed or cache-only copies.

**Scenarios:**

- **WHEN** this bead references implementation files **THEN** they must be under `/root/.config/opencode/omo` or `/root/.config/opencode/opencode.json`, unless they are root bead artifacts or root OCK contract docs
- **WHEN** research or planning names affected files **THEN** those files must point only at the local OmO source, runtime file-path plugin entry, or root bead and contract files
- **WHEN** historical installed or cache paths are mentioned **THEN** they must be framed only as rejected or non-durable targets

#### Bead-First Durable Workflow

Durable workflow state must remain rooted in `/.beads` and `/.beads/artifacts/<bead-id>/`.

**Scenarios:**

- **WHEN** work needs durable context **THEN** it must be written under `/.beads/artifacts/bd-x0u/`
- **WHEN** OmO is analyzed for process behavior **THEN** the bead ledger remains `/.beads`, not plugin-local durable state

#### Local OmO Seam Fidelity

The bead must focus on the real editable seams in the local OmO source tree.

**Scenarios:**

- **WHEN** the local OmO source is researched **THEN** analysis should cover at least `package.json`, `AGENTS.md`, `src/index.ts`, and `src/plugin-config.ts`
- **WHEN** skill or process behavior is discussed **THEN** it must be tied to the local OmO repo or the runtime plugin entry that loads it

#### Runtime Wiring Fidelity

The bead must preserve the actual runtime loading path that points OpenCode at the editable local source.

**Scenarios:**

- **WHEN** runtime loading is documented **THEN** `/root/.config/opencode/opencode.json` must remain the reference for `file:///root/.config/opencode/omo`
- **WHEN** implementation planning discusses where OmO is loaded from **THEN** it must use the exact file-path plugin entry rather than installed-package assumptions

#### Delivery Loop Fidelity

The agreed loop must remain the acceptance reference.

**Scenarios:**

- **WHEN** planning this bead **THEN** the output must support `/research` → `/start` → `/plan` → `/ship` → review → `/pr`
- **WHEN** the bead is not committable **THEN** the loop must stay in fix-and-verify mode until clean

### Non-Functional Requirements

- **Performance:** No redesign assumption that depends on Bun-installed or cache-only seams
- **Security:** No new credential, publish, or install side effects are required to define this bead correctly
- **Compatibility:** Root `/.beads` workflow remains canonical while OmO is loaded from the local file-path plugin entry
- **Maintainability:** File references in artifacts must be unambiguous and target the actual durable local source

---

## Success Criteria

- [ ] `bd-x0u` artifacts establish the local OmO source and runtime file-path plugin entry as the active authority
  - Verify: `grep -R '/root/.config/opencode/omo\|file:///root/.config/opencode/omo' '/.beads/artifacts/bd-x0u/prd.md' '/.beads/artifacts/bd-x0u/research.md' '/.beads/artifacts/bd-x0u/prd.json' >/dev/null`
  - Verify: `sed -n '/### Affected Files/,/```/p' '/.beads/artifacts/bd-x0u/prd.md' | (! grep '/root/.bun/install/global/node_modules/opencodekit\|/root/.cache/opencode/packages')`
  - Verify: `node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('/.beads/artifacts/bd-x0u/prd.json','utf8')); const files=[...(j.context?.keyFiles||[]), ...j.tasks.flatMap(t=>t.metadata?.files||[])]; if(files.some(f=>f.includes('/root/.bun/install/global/node_modules/opencodekit')||f.includes('/root/.cache/opencode/packages'))) process.exit(1);"`
- [ ] Research identifies the exact local OmO seams relevant to process and skill behavior
  - Verify: `test -f '/.beads/artifacts/bd-x0u/research.md' && grep -n '/root/.config/opencode/omo\|src/index.ts\|src/plugin-config.ts\|file:///root/.config/opencode/omo' '/.beads/artifacts/bd-x0u/research.md'`
- [ ] Machine-convertible planning points only at the local OmO target plus bead artifacts
  - Verify: `node -e "const p=require('fs').readFileSync('/.beads/artifacts/bd-x0u/prd.json','utf8'); const j=JSON.parse(p); const s=JSON.stringify(j); if(!s.includes('/root/.config/opencode/omo')) process.exit(1); if(s.includes('/root/.bun/install/global/node_modules/opencodekit')||s.includes('/root/.cache/opencode/packages')) process.exit(2);"`
- [ ] The bead remains grounded in the canonical root loop
  - Verify: `grep -n '/create\|/research\|/start\|/plan\|/ship\|/pr' '/.beads/artifacts/bd-x0u/prd.md'`

---

## Technical Context

### Existing Patterns

- Root `/create` contract at `/.opencode/command/create.md` creates the bead plus `/.beads/artifacts/<bead-id>/prd.md`
- Root research and planning contracts at `/.opencode/command/research.md`, `/.opencode/command/start.md`, and `/.opencode/command/plan.md` assume bead-scoped durable artifacts
- Local OmO source at `/root/.config/opencode/omo` is a real git checkout of `oh-my-opencode` version `3.15.3`, with source under `src/`, build output in `dist/`, and repo-specific OpenCode assets under `.opencode/`
- Runtime loading currently points to `file:///root/.config/opencode/omo` from `/root/.config/opencode/opencode.json`
- Repo guidance in `/root/.config/opencode/omo/AGENTS.md` identifies `src/index.ts` and `src/plugin-config.ts` as core entry and config seams for plugin behavior

### Key Files

- `/.opencode/command/create.md` - root create contract
- `/.opencode/command/research.md` - root research contract
- `/.opencode/command/start.md` - root start contract
- `/.opencode/command/plan.md` - root plan contract
- `/root/.config/opencode/opencode.json` - runtime plugin entry proving OmO loads from the local file path
- `/root/.config/opencode/omo/package.json` - local OmO identity and package shape
- `/root/.config/opencode/omo/AGENTS.md` - local architecture and code-location guidance
- `/root/.config/opencode/omo/src/index.ts` - local plugin entry and composition seam
- `/root/.config/opencode/omo/src/plugin-config.ts` - local multi-level plugin config seam
- `/root/.config/opencode/omo/README.md` - local install and compatibility guidance

### Affected Files

Files this bead will likely inspect or modify (for conflict detection):

```yaml
files:
  - /.beads/artifacts/bd-x0u/prd.md # bead intent authority
  - /.beads/artifacts/bd-x0u/research.md # bead research findings
  - /.beads/artifacts/bd-x0u/prd.json # machine-convertible task authority
  - /.beads/artifacts/bd-x0u/plan.md # future execution authority if generated
  - /root/.config/opencode/opencode.json # runtime plugin entry
  - /root/.config/opencode/omo/src/index.ts # local plugin entry and composition
  - /root/.config/opencode/omo/src/plugin-config.ts # local plugin config and compatibility behavior
  - /root/.config/opencode/omo/README.md # local install and compatibility docs if needed
  - /root/.config/opencode/omo/AGENTS.md # local architecture contract reference
```

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| ---- | ---------- | ------ | ---------- |
| Scope drifts back to Bun-installed or cache-only copies | High | High | Reject any artifact reference outside `/.beads`, `/.opencode`, `/root/.config/opencode/opencode.json`, and `/root/.config/opencode/omo` |
| Runtime still points at the wrong plugin target | Medium | High | Use the exact `file:///root/.config/opencode/omo` plugin entry as the wiring reference in research and planning |
| Process and skill behavior stay ambiguous | Medium | High | Use root OCK command docs plus local OmO architecture guidance and source entry files as the only contract evidence |
| Exact implementation seam is broader than the first read | Medium | Medium | Keep the bead focused on source-of-truth correction first, then narrow the concrete source files during planning |

---

## Open Questions

| Question | Owner | Due Date | Status |
| -------- | ----- | -------- | ------ |
| Which exact local OmO modules govern bead/process behavior beyond `src/index.ts` and `src/plugin-config.ts`? | Agent | 2026-04-06 | Open |
| Which local OmO docs or repo-local `.opencode` assets need tailoring for the bead-first loop? | Agent | 2026-04-06 | Open |
| What is the narrowest local-source seam for OCK-mode process adaptation? | Agent | 2026-04-06 | Open |

---

## Tasks

Write tasks in a machine-convertible format for `prd-task` skill.

### Audit local OmO workflow seams [research]

A file-backed research artifact exists that maps the local OmO source, runtime plugin entry, and process or skill seams against the root OCK bead-first contract.

**Metadata:**

```yaml
depends_on: []
parallel: true
conflicts_with: []
files:
  - /.beads/artifacts/bd-x0u/research.md
  - /root/.config/opencode/opencode.json
  - /root/.config/opencode/omo/package.json
  - /root/.config/opencode/omo/AGENTS.md
  - /root/.config/opencode/omo/src/index.ts
  - /root/.config/opencode/omo/src/plugin-config.ts
```

**Verification:**

- `test -f '/.beads/artifacts/bd-x0u/research.md'`
- `grep -n '/root/.config/opencode/omo\|file:///root/.config/opencode/omo\|src/index.ts\|src/plugin-config.ts\|bead' '/.beads/artifacts/bd-x0u/research.md'`

### Define local OmO adapter boundary [design]

A concrete ownership model and implementation boundary exist for making the local OmO source honor the root OCK bead-first contract.

**Metadata:**

```yaml
depends_on: ["Audit local OmO workflow seams"]
parallel: false
conflicts_with: []
files:
  - /.beads/artifacts/bd-x0u/plan.md
  - /root/.config/opencode/opencode.json
  - /root/.config/opencode/omo/AGENTS.md
  - /root/.config/opencode/omo/src/index.ts
  - /root/.config/opencode/omo/src/plugin-config.ts
```

**Verification:**

- `test -f '/.beads/artifacts/bd-x0u/plan.md'`
- `grep -n 'adapter\|ownership\|Affected Files\|file:///root/.config/opencode/omo' '/.beads/artifacts/bd-x0u/plan.md'`

### Implement local OmO process alignment [integration]

The local OmO source uses the root OCK bead-first contract without drifting into Bun-installed or cache-only workflow assumptions.

**Metadata:**

```yaml
depends_on: ["Define local OmO adapter boundary"]
parallel: false
conflicts_with: []
files:
  - /root/.config/opencode/opencode.json
  - /root/.config/opencode/omo/src/index.ts
  - /root/.config/opencode/omo/src/plugin-config.ts
  - /root/.config/opencode/omo/README.md
```

**Verification:**

- `grep -n 'file:///root/.config/opencode/omo' '/root/.config/opencode/opencode.json'`
- `test -f '/root/.config/opencode/omo/dist/index.js'`

### Verify canonical bead-first loop [verification]

The final implementation preserves the agreed `/create` → `/research` → `/start` → `/plan` → `/ship` → review → `/pr` loop while OmO is loaded from the local source path.

**Metadata:**

```yaml
depends_on: ["Implement local OmO process alignment"]
parallel: false
conflicts_with: []
files:
  - /root/.config/opencode/opencode.json
  - /.beads/artifacts/bd-x0u/prd.md
  - /.beads/artifacts/bd-x0u/progress.txt
```

**Verification:**

- `grep -n '/create\|/research\|/start\|/plan\|/ship\|/pr' '/.beads/artifacts/bd-x0u/prd.md'`
- `grep -n 'file:///root/.config/opencode/omo' '/root/.config/opencode/opencode.json'`
- `test -f '/.beads/artifacts/bd-x0u/progress.txt'`

---

## Notes

The bead ledger remains `/.beads`. The implementation authority for this bead is `/root/.config/opencode/omo`, and the runtime loading reference is `file:///root/.config/opencode/omo` in `/root/.config/opencode/opencode.json`. Bun-installed and cache-only copies are historical context only, not durable targets.
