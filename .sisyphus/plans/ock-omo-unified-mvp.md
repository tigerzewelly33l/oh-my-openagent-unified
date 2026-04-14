# Unified OCK + OMO MVP Architecture

## TL;DR

> **Summary**: Create a root-level `MVP.md` that defines one unified product with `ock` as the user-facing entry, `oh-my-openagent` as the runtime/orchestration engine, and Rust-backed task lifecycle support without duplicating orchestration ownership.
> **Deliverables**:
>
> - `/work/ock-omo-system/MVP.md`
> - Capability Ownership Matrix + Bridge Matrix inside `MVP.md`
> - Runtime / Toolchain / Naming / Config contracts inside `MVP.md`
> - Migration paths + executable smoke-test appendix inside `MVP.md`

**Effort**: Short
**Parallel**: YES - 2 waves
**Critical Path**: 1 → (2, 3, 4, 5) → 6 → 7 → 8 → 9

## Context

### Original Request

- User wants the two systems to "work as one".
- User stated that OCK should remain organized around Rust-backed task handling, while OMO contributes stronger agent orchestration.
- User proposed `MVP.md` as the next artifact to give the combined project direction.

### Interview Summary

- MVP orientation: architecture-first, not prototype-first.
- Product shape: one unified product.
- Primary entry point: `ock` is the front door.
- Runtime owner: OMO is the orchestration/runtime engine.
- Rust requirement: Rust-based task execution is required in MVP.
- Duplication strategy: compatibility bridge first, not hard removal.

### Discovery

- Workspace root explicitly says this is **not** a runnable monorepo and that the two products have different toolchains and assumptions: `/work/ock-omo-system/AGENTS.md:8-16`, `/work/ock-omo-system/AGENTS.md:27-47`.
- OCK already owns the packaged `ock` CLI, template distribution, and governance scripts: `opencodekit-template/package.json:23-49`, `opencodekit-template/src/index.ts:35-84`, `opencodekit-template/src/index.ts:146-217`.
- OCK init/upgrade semantics preserve user-owned areas and can skip project-level directories when global config already covers them, which is critical for bridge placement: `opencodekit-template/src/commands/init.ts:40-49`, `opencodekit-template/src/commands/init.ts:60-99`, `opencodekit-template/src/commands/init.ts:186-225`, `opencodekit-template/src/commands/upgrade.ts:29-45`, `opencodekit-template/src/commands/upgrade.ts:113-189`, `opencodekit-template/src/commands/upgrade.ts:192-259`.
- OCK still carries runtime-adjacent capabilities in project payload form: direct SQLite session tools, a full memory pipeline, skill-MCP process management, and workflow commands tied to `br`/bead lifecycle: `opencodekit-template/.opencode/plugin/sessions.ts:1-67`, `opencodekit-template/.opencode/plugin/memory.ts:1-89`, `opencodekit-template/.opencode/plugin/skill-mcp.ts:146-320`, `opencodekit-template/.opencode/command/plan.md:39-94`, `opencodekit-template/.opencode/command/ship.md:49-99`.
- OMO already owns the runtime composition pipeline, manager construction, config registration, command merge order, skill discovery, session tools, and background orchestration: `oh-my-openagent/src/create-managers.ts:42-115`, `oh-my-openagent/src/plugin-handlers/config-handler.ts:21-52`, `oh-my-openagent/src/plugin-handlers/command-config-handler.ts:30-104`, `oh-my-openagent/src/features/opencode-skill-loader/loader.ts:70-121`, `oh-my-openagent/src/tools/session-manager/tools.ts:30-158`, `oh-my-openagent/src/features/background-agent/manager.ts:139-196`.
- OMO already documents a formal planning/execution split and existing runtime naming compatibility between `oh-my-openagent` and legacy `oh-my-opencode`: `oh-my-openagent/docs/guide/orchestration.md:3-24`, `oh-my-openagent/docs/guide/orchestration.md:29-163`, `oh-my-openagent/src/shared/plugin-identity.ts:1-6`, `oh-my-openagent/src/plugin-config.ts:168-254`.
- OCK’s own internal research already flags overlap/redundancy and context/tool-load problems, which supports a deliberate owner-per-capability MVP: `opencodekit-template/.opencode/memory/research/effectiveness-audit.md:171-197`, `opencodekit-template/.opencode/memory/research/context-management-analysis.md:13-16`, `opencodekit-template/.opencode/memory/research/context-management-analysis.md:75-83`, `opencodekit-template/.opencode/memory/research/context-management-analysis.md:126-163`.

### Metis Review (gaps addressed)

- Freeze one owner per capability; never leave duplicate runtime ownership implicit.
- Treat “one unified product” as a product-surface decision, **not** a root build/repo merge in MVP.
- Do not claim OMO already replaces OCK memory without proof; default memory ownership to OCK/deferred until parity is explicitly established.
- Define bridge behavior, precedence, migration, and removal triggers inside the MVP doc itself.
- Keep Rust as a bounded execution/task-lifecycle contract under OMO orchestration, not a second scheduler.
- Freeze the target model as dual-store, single-control-plane, with `.beads` as the durable user-facing surface, `.sisyphus` as rebuildable runtime state, `ock` as public authority, and OMO as the internal runtime engine.

## Work Objectives

### Core Objective

Produce `/work/ock-omo-system/MVP.md` as the canonical architecture document for the unified product, with explicit ownership, compatibility, migration, and verification rules so future implementation can proceed without re-deciding product boundaries.

### Deliverables

- A root-level `MVP.md` with fixed section structure and no unresolved placeholders.
- A capability ownership table covering all overlapping OCK/OMO/Rust surfaces.
- A bridge/deprecation table with explicit removal triggers.
- A runtime/toolchain matrix covering Node/npm, Bun, and Rust responsibilities.
- A naming/config contract covering `ock`, `oh-my-openagent`, and legacy `oh-my-opencode` compatibility.
- A migration contract for fresh OCK projects, existing OCK projects, and existing OMO projects.
- An executable acceptance-suite appendix describing future smoke tests and expected artifacts.

### Definition of Done (verifiable conditions with commands)

```bash
test -f "/work/ock-omo-system/MVP.md"

python - <<'PY'
from pathlib import Path
text = Path('/work/ock-omo-system/MVP.md').read_text()
required = [
    '# OCK + OMO Unified MVP',
    '## Problem Statement',
    '## Product Goal',
    '## Decision Ledger',
    '## Non-Goals',
    '## Canonical Topology',
    '## Capability Ownership Matrix',
    '## Bridge Matrix',
    '## Runtime / Toolchain Matrix',
    '## Naming and Config Contract',
    '## Command and Skill Compatibility Contract',
    '## Migration Paths',
    '## Acceptance Suite',
    '## Post-MVP Removal Triggers',
]
missing = [h for h in required if h not in text]
assert not missing, f'Missing headings: {missing}'
PY

python - <<'PY'
from pathlib import Path
text = Path('/work/ock-omo-system/MVP.md').read_text()
for capability in [
    'init', 'upgrade', 'validation', 'session tools', 'memory', 'skill-MCP',
    'background orchestration', 'command loading', 'skill loading',
    'Rust task lifecycle', 'doctor/status diagnostics'
]:
    assert capability.lower() in text.lower(), f'Missing capability coverage: {capability}'
assert '[DECISION NEEDED' not in text
assert 'TBD' not in text
PY

python - <<'PY'
from pathlib import Path
text = Path('/work/ock-omo-system/MVP.md').read_text()
assert 'one scheduler' in text.lower()
assert 'oh-my-openagent' in text
assert 'oh-my-opencode' in text
assert 'ock' in text
PY
```

### Must Have

- One explicit MVP owner for every overlapping capability.
- One explicit public entry point: `ock`.
- One explicit runtime/orchestration owner: OMO.
- One explicit Rust boundary that does **not** duplicate scheduling/orchestration.
- One explicit compatibility policy for commands, skills, config files, and legacy naming.
- One explicit migration story for fresh OCK, existing OCK, and existing OMO installs.
- One explicit bridge removal trigger per temporary adapter/shim.

### Must NOT Have

- No root monorepo/toolchain merge as part of this MVP artifact.
- No rewrite of OCK memory pipeline in MVP.
- No blanket rewrite of OCK slash commands in MVP.
- No new third plugin/config basename introduced for the runtime.
- No claims that memory is duplicated unless parity is newly proven during execution.
- No second scheduler owned by Rust.
- No implementation tasks outside architecture/document direction.

## Verification Strategy

> ZERO HUMAN INTERVENTION - all verification is agent-executed.

- Test decision: tests-after. This is a document-first architecture artifact; verification is content validation + source-grounding.
- QA policy: Every task includes agent-executable content checks. `MVP.md` must also include an exact future smoke-test appendix for the later implementation phase.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.txt`

## Execution Strategy

### Parallel Execution Waves

> Target: 5-8 tasks per wave. Extract shared dependencies first, then draft and review once ownership decisions are frozen.

Wave 1: 1) doc skeleton + decision ledger, 2) capability ownership matrix, 3) naming/packaging contract, 4) runtime/toolchain/Rust contract, 5) config/command/skill precedence contract

Wave 2: 6) migration + preserve/skip contract, 7) draft full `MVP.md`, 8) add acceptance-suite appendix, 9) evidence review + consistency pass

### Dependency Matrix (full, all tasks)

| Task | Depends On          | Blocks     |
| ---- | ------------------- | ---------- |
| 1    | —                   | 7          |
| 2    | —                   | 7, 9       |
| 3    | —                   | 6, 7, 8, 9 |
| 4    | —                   | 7, 8, 9    |
| 5    | —                   | 6, 7, 8, 9 |
| 6    | 3, 5                | 7, 8, 9    |
| 7    | 1, 2, 3, 4, 5, 6    | 8, 9       |
| 8    | 3, 4, 5, 6, 7       | 9          |
| 9    | 2, 3, 4, 5, 6, 7, 8 | F1-F4      |

### Agent Dispatch Summary

| Wave | Task Count | Categories                                     |
| ---- | ---------- | ---------------------------------------------- |
| 1    | 5          | `writing` x1, `deep` x4                        |
| 2    | 4          | `deep` x1, `writing` x2, `unspecified-high` x1 |

## TODOs

<!-- TASKS INSERT HERE -->

- [x] 1. Create the `MVP.md` skeleton and decision ledger

  **What to do**: Create `/work/ock-omo-system/MVP.md` with the final section structure already fixed: problem statement, product goal, decision ledger, non-goals, canonical topology, capability ownership matrix, bridge matrix, runtime/toolchain matrix, naming/config contract, command/skill compatibility contract, migration paths, acceptance suite, post-MVP removal triggers. Write the decision ledger first so every downstream section inherits the same frozen assumptions: one unified product, `ock` entry, OMO runtime, Rust required in MVP, compatibility bridge first.
  **Must NOT do**: Do not include implementation instructions beyond architecture direction. Do not leave placeholder sections, TBDs, or open decision questions. Do not treat “one product” as a root repository merge.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: primary output is a strategic architecture document with fixed headings and crisp wording.
  - Skills: [] - no extra skill required; this is custom architecture writing grounded in repo findings.
  - Omitted: [`git-master`] - no git work is needed.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7 | Blocked By: none

  **References**:
  - Pattern: `/work/ock-omo-system/opencodekit-template/.opencode/memory/project/roadmap.md:17-42` - concise MVP framing pattern with goals, success criteria, and out-of-scope section.
  - Pattern: `/work/ock-omo-system/oh-my-openagent/docs/guide/orchestration.md:29-79` - architecture exposition pattern that separates layers explicitly.
  - Research: `/work/ock-omo-system/AGENTS.md:8-16` - confirms the current state is two separate products, so MVP doc must explain unification deliberately.

  **Acceptance Criteria**:
  - [x] `/work/ock-omo-system/MVP.md` exists with the exact heading structure listed in the plan Definition of Done.
  - [x] The decision ledger explicitly states all five user-confirmed decisions without contradiction.
  - [x] No line in `MVP.md` contains `TBD`, `[DECISION NEEDED`, or equivalent placeholders.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Skeleton created with required sections
    Tool: Bash
    Steps: Run `test -f "/work/ock-omo-system/MVP.md"` and the heading-validation Python snippet from Definition of Done.
    Expected: File exists and all required headings are present.
    Evidence: .sisyphus/evidence/task-1-mvp-skeleton.txt

  Scenario: No unresolved placeholders remain
    Tool: Bash
    Steps: Run Python to assert `TBD` and `[DECISION NEEDED` are absent from `/work/ock-omo-system/MVP.md`.
    Expected: Script exits 0 with no missing decisions.
    Evidence: .sisyphus/evidence/task-1-mvp-skeleton-error.txt
  ```

  **Commit**: NO | Message: `docs(mvp): create architecture skeleton` | Files: [`/work/ock-omo-system/MVP.md`]

- [x] 2. Build the Capability Ownership Matrix

  **What to do**: Add a table to `MVP.md` that enumerates each overlapping or adjacent capability and assigns exactly one MVP owner. At minimum include: `init`, `upgrade`, `validation`, `doctor/status diagnostics`, `session tools`, `memory`, `skill-MCP`, `command loading`, `skill loading`, `background orchestration`, `config merge/loading`, `Rust task lifecycle`, and `workflow slash commands`. For each row include current OCK owner, current OMO owner, MVP owner, bridge mechanism, and post-MVP fate.
  **Must NOT do**: Do not mark runtime capabilities as “shared” without precise split language. Do not state OMO owns memory unless parity is proven; treat memory as OCK-owned or deferred if necessary.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is the core architecture decision artifact and requires high-precision reasoning.
  - Skills: [] - no external skill needed.
  - Omitted: [`review-work`] - premature; this is still primary drafting.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7, 9 | Blocked By: none

  **References**:
  - OCK owner evidence: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:40-49`, `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:29-45`, `/work/ock-omo-system/opencodekit-template/package.json:35-49`.
  - OCK overlap evidence: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/sessions.ts:1-67`, `/work/ock-omo-system/opencodekit-template/.opencode/plugin/memory.ts:1-89`, `/work/ock-omo-system/opencodekit-template/.opencode/plugin/skill-mcp.ts:146-320`, `/work/ock-omo-system/opencodekit-template/.opencode/command/plan.md:39-94`, `/work/ock-omo-system/opencodekit-template/.opencode/command/ship.md:49-99`.
  - OMO owner evidence: `/work/ock-omo-system/oh-my-openagent/src/create-managers.ts:42-115`, `/work/ock-omo-system/oh-my-openagent/src/plugin-handlers/config-handler.ts:21-52`, `/work/ock-omo-system/oh-my-openagent/src/plugin-handlers/command-config-handler.ts:30-104`, `/work/ock-omo-system/oh-my-openagent/src/tools/session-manager/tools.ts:30-158`, `/work/ock-omo-system/oh-my-openagent/src/features/background-agent/manager.ts:139-196`.
  - Risk guidance: `/work/ock-omo-system/opencodekit-template/.opencode/memory/research/effectiveness-audit.md:171-197`.

  **Acceptance Criteria**:
  - [x] Every required capability row exists in the matrix.
  - [x] Every row has exactly one MVP owner and a non-empty bridge column.
  - [x] No row uses vague ownership terms like “both”, “hybrid”, or “shared runtime” without a narrow explanatory clause.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Ownership table covers all mandatory capabilities
    Tool: Bash
    Steps: Run Python to read `/work/ock-omo-system/MVP.md` and assert each required capability keyword appears in the Capability Ownership Matrix section.
    Expected: All listed capabilities are present exactly once or more with no omissions.
    Evidence: .sisyphus/evidence/task-2-ownership-matrix.txt

  Scenario: No ambiguous shared runtime owners
    Tool: Bash
    Steps: Run Python to scan the Capability Ownership Matrix section for forbidden phrases like `shared runtime`, `both own`, or `TBD`.
    Expected: Forbidden phrases are absent unless part of an explicitly negated statement.
    Evidence: .sisyphus/evidence/task-2-ownership-matrix-error.txt
  ```

  **Commit**: NO | Message: `docs(mvp): define capability ownership` | Files: [`/work/ock-omo-system/MVP.md`]

- [x] 3. Define naming, packaging, and config identity contract

  **What to do**: Write the section of `MVP.md` that freezes public identity and compatibility rules. Explicitly state that the user-facing entry is `ock`, that OMO remains the runtime/plugin identity under canonical `oh-my-openagent`, and that legacy `oh-my-opencode` names/config files remain accepted during MVP. Also define whether MVP ships as one product surface backed by separate internal packages/builds, not a root build merge.
  **Must NOT do**: Do not invent a third runtime/plugin/config basename. Do not promise immediate brand/package convergence if the repos and package metadata do not support it yet.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: naming/config compatibility errors create long-lived migration cost.
  - Skills: []
  - Omitted: [`frontend-ui-ux`] - irrelevant.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6, 7, 8, 9 | Blocked By: none

  **References**:
  - OCK package/binary: `/work/ock-omo-system/opencodekit-template/package.json:2-25`.
  - OCK CLI identity: `/work/ock-omo-system/opencodekit-template/src/index.ts:35-84`.
  - OMO package/binary: `/work/ock-omo-system/oh-my-openagent/package.json:2-10`.
  - OMO canonical/legacy identity: `/work/ock-omo-system/oh-my-openagent/src/shared/plugin-identity.ts:1-6`.
  - OMO config migration rules: `/work/ock-omo-system/oh-my-openagent/src/plugin-config.ts:168-254`.
  - Workspace split guardrail: `/work/ock-omo-system/AGENTS.md:27-47`.

  **Acceptance Criteria**:
  - [x] `MVP.md` states one public entry (`ock`) and one canonical runtime plugin identity (`oh-my-openagent`).
  - [x] `MVP.md` explicitly preserves legacy `oh-my-opencode` compatibility during MVP.
  - [x] `MVP.md` states that MVP product unification does not require root toolchain unification.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Naming contract is explicit
    Tool: Bash
    Steps: Run Python to assert `/work/ock-omo-system/MVP.md` contains `ock`, `oh-my-openagent`, and `oh-my-opencode` within the naming/config section.
    Expected: All three identifiers appear with explicit compatibility wording.
    Evidence: .sisyphus/evidence/task-3-naming-contract.txt

  Scenario: No third runtime identity introduced
    Tool: Bash
    Steps: Run Python to search the naming/config section for phrases indicating a new plugin basename beyond the known three identifiers.
    Expected: No new runtime/plugin/config identity is introduced.
    Evidence: .sisyphus/evidence/task-3-naming-contract-error.txt
  ```

  **Commit**: NO | Message: `docs(mvp): freeze naming and config contract` | Files: [`/work/ock-omo-system/MVP.md`]

- [x] 4. Freeze the runtime, toolchain, and Rust boundary contract

  **What to do**: Add a Runtime / Toolchain Matrix that assigns responsibilities to Node/npm, Bun, and Rust. State that OCK remains the Node/npm-facing CLI shell and upgrade path, OMO remains the Bun runtime/orchestration engine, and Rust is the bounded task-lifecycle engine required in MVP. Define that Rust is subordinate to OMO scheduling: task launch/execution may be Rust-backed, but queueing, cancellation semantics, retries, polling, notifications, and session integration remain OMO-owned unless explicitly delegated.
  **Must NOT do**: Do not let Rust become a second scheduler. Do not blur responsibilities between Node and Bun. Do not imply a root shared build pipeline.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is the highest-risk architectural seam and has cross-runtime implications.
  - Skills: []
  - Omitted: [`git-master`] - irrelevant.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7, 8, 9 | Blocked By: none

  **References**:
  - OCK toolchain: `/work/ock-omo-system/opencodekit-template/package.json:35-77`, `/work/ock-omo-system/AGENTS.md:35-40`.
  - OMO toolchain: `/work/ock-omo-system/oh-my-openagent/package.json:23-35`, `/work/ock-omo-system/AGENTS.md:35-40`.
  - OMO orchestration engine: `/work/ock-omo-system/oh-my-openagent/src/features/background-agent/manager.ts:139-196`.
  - OMO manager composition: `/work/ock-omo-system/oh-my-openagent/src/create-managers.ts:66-115`.
  - OCK Rust-oriented formatting/task hint: `/work/ock-omo-system/opencodekit-template/.opencode/opencode.json:46-49` and user-confirmed requirement in draft context.

  **Acceptance Criteria**:
  - [x] Runtime / Toolchain Matrix includes Node/npm, Bun, and Rust columns or equivalent explicit assignments.
  - [x] `MVP.md` explicitly states “one scheduler” or equivalent language making OMO the orchestration owner.
  - [x] Rust responsibilities include execution semantics but exclude orchestration ownership.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Toolchain matrix is complete
    Tool: Bash
    Steps: Run Python to assert the Runtime / Toolchain Matrix section mentions Node, Bun, and Rust and includes responsibility language for each.
    Expected: All three runtimes are explicitly assigned roles.
    Evidence: .sisyphus/evidence/task-4-runtime-matrix.txt

  Scenario: Rust is not described as scheduler owner
    Tool: Bash
    Steps: Run Python to scan the Rust section for forbidden phrases like `Rust orchestrates`, `Rust schedules`, or equivalent unless explicitly negated.
    Expected: No second-scheduler language appears.
    Evidence: .sisyphus/evidence/task-4-runtime-matrix-error.txt
  ```

  **Commit**: NO | Message: `docs(mvp): define runtime and rust boundary` | Files: [`/work/ock-omo-system/MVP.md`]

- [x] 5. Define command, skill, session, and config precedence contract

  **What to do**: Add sections that explain how project commands/skills/configs remain compatible under the unified product. Explicitly document merge order and precedence so same-named project assets still override lower-priority/builtin assets where intended. Cover command agent remapping, skill discovery scopes, session-tool owner behavior, and how OCK project payload content is loaded or bridged through OMO runtime systems.
  **Must NOT do**: Do not hand-wave precedence. Do not assume OCK commands work unchanged without documenting how agent names and tools map into OMO. Do not ignore session tool overlap.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this requires careful reasoning across loaders, precedence rules, and compatibility semantics.
  - Skills: []
  - Omitted: [`playwright`] - not relevant.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6, 7, 8, 9 | Blocked By: none

  **References**:
  - OMO command merge order: `/work/ock-omo-system/oh-my-openagent/src/plugin-handlers/command-config-handler.ts:36-96`.
  - OMO skill discovery priority: `/work/ock-omo-system/oh-my-openagent/src/features/opencode-skill-loader/loader.ts:70-121`.
  - OMO session tools: `/work/ock-omo-system/oh-my-openagent/src/tools/session-manager/tools.ts:30-158`.
  - OCK session plugin DB behavior: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/sessions.ts:38-67`.
  - OCK skill-MCP loading semantics: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/skill-mcp.ts:146-320`.
  - OCK command assumptions: `/work/ock-omo-system/opencodekit-template/.opencode/command/plan.md:17-23`, `/work/ock-omo-system/opencodekit-template/.opencode/command/ship.md:15-20`.

  **Acceptance Criteria**:
  - [x] `MVP.md` states project-vs-builtin precedence for commands and skills.
  - [x] `MVP.md` explains how OCK agent names/tool expectations are preserved or mapped into OMO runtime behavior.
  - [x] `MVP.md` includes a specific stance on session tools and skill-MCP bridge ownership.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Compatibility contract names precedence explicitly
    Tool: Bash
    Steps: Run Python to assert the command/skill compatibility section contains words like `precedence`, `override`, and references to project vs builtin behavior.
    Expected: Merge order is explicitly documented.
    Evidence: .sisyphus/evidence/task-5-compatibility-contract.txt

  Scenario: Session and skill-MCP overlap are not omitted
    Tool: Bash
    Steps: Run Python to assert `session` and `skill-MCP`/`skill_mcp` are both mentioned in the compatibility section.
    Expected: Both overlap areas are explicitly addressed.
    Evidence: .sisyphus/evidence/task-5-compatibility-contract-error.txt
  ```

  **Commit**: NO | Message: `docs(mvp): define precedence and compatibility` | Files: [`/work/ock-omo-system/MVP.md`]

- [x] 6. Define migration paths and preserve/skip rules

  **What to do**: Add a Migration Paths section covering at least three scenarios: fresh unified project from `ock`, existing OCK-generated project, and existing OMO-configured project. Explain how OCK preserve/skip semantics interact with bridge-managed files, including what must live in replaceable locations vs preserved user-owned locations. Also define how legacy OMO config files are recognized and migrated under the unified product.
  **Must NOT do**: Do not place bridge-critical behavior in directories OCK preserves indefinitely without calling that out. Do not ignore `--project-only` / global-config skip behavior.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: migration failure is one of the highest-risk practical outcomes of the MVP.
  - Skills: []
  - Omitted: [`review-work`] - still drafting.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7, 8, 9 | Blocked By: 3, 5

  **References**:
  - OCK global-config skip behavior: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:47-77`, `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:186-225`.
  - OCK preserve user dirs: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:40-49`, `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:29-45`, `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:141-159`, `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:192-259`.
  - OMO legacy/canonical config handling: `/work/ock-omo-system/oh-my-openagent/src/plugin-config.ts:168-254`.

  **Acceptance Criteria**:
  - [x] `MVP.md` documents fresh install, existing OCK, and existing OMO migration paths.
  - [x] `MVP.md` explicitly discusses preserved directories and skipped global-config directories.
  - [x] `MVP.md` defines where bridge-managed files live and why they remain upgradeable.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Migration section covers all three user states
    Tool: Bash
    Steps: Run Python to assert the Migration Paths section contains phrases matching fresh project, existing OCK project, and existing OMO project.
    Expected: All three scenarios are present.
    Evidence: .sisyphus/evidence/task-6-migration-paths.txt

  Scenario: Preserve/skip semantics are explicitly addressed
    Tool: Bash
    Steps: Run Python to assert the migration section mentions `project-only` or global skip behavior and also mentions preserved directories/user-owned content.
    Expected: Both skip and preserve semantics are documented.
    Evidence: .sisyphus/evidence/task-6-migration-paths-error.txt
  ```

  **Commit**: NO | Message: `docs(mvp): define migration contract` | Files: [`/work/ock-omo-system/MVP.md`]

- [x] 7. Draft the complete `MVP.md`

  **What to do**: Using Tasks 1-6 outputs, write the full root-level `MVP.md` as a polished, self-contained architecture document. It must read as the authoritative direction for future implementation, not as meeting notes. Include clear rationale for why OCK remains the front door, why OMO remains the engine, why Rust is bounded, and why bridge-first is temporary by design.
  **Must NOT do**: Do not simply dump tables without narrative. Do not contradict earlier sections. Do not copy repo docs verbatim; synthesize them into a unified product architecture.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is the main document-authoring task.
  - Skills: []
  - Omitted: [`git-master`] - no git work.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 8, 9 | Blocked By: 1, 2, 3, 4, 5, 6

  **References**:
  - Product-shape context: `/work/ock-omo-system/AGENTS.md:8-16`, `/work/ock-omo-system/AGENTS.md:27-47`.
  - OMO architecture narrative: `/work/ock-omo-system/oh-my-openagent/docs/guide/orchestration.md:29-163`.
  - OCK roadmap pattern: `/work/ock-omo-system/opencodekit-template/.opencode/memory/project/roadmap.md:17-42`.
  - Overlap-risk framing: `/work/ock-omo-system/opencodekit-template/.opencode/memory/research/effectiveness-audit.md:171-197`, `/work/ock-omo-system/opencodekit-template/.opencode/memory/research/context-management-analysis.md:75-83`, `/work/ock-omo-system/opencodekit-template/.opencode/memory/research/context-management-analysis.md:126-163`.

  **Acceptance Criteria**:
  - [x] `MVP.md` is coherent narrative + tables, not raw notes.
  - [x] `MVP.md` includes all required sections and uses consistent terminology throughout.
  - [x] `MVP.md` makes no statements that conflict with the source-grounded findings cited in this plan.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Full document passes structure and terminology checks
    Tool: Bash
    Steps: Run the heading-validation snippet plus Python assertions that `ock`, `OMO`, `Rust`, `bridge`, and `migration` all appear in meaningful sections.
    Expected: Document structure is complete and key architectural terms are present.
    Evidence: .sisyphus/evidence/task-7-draft-mvp.txt

  Scenario: Document has no unresolved contradictions markers
    Tool: Bash
    Steps: Run Python to assert `TODO`, `FIXME`, `TBD`, and `[DECISION NEEDED` are absent from `/work/ock-omo-system/MVP.md`.
    Expected: No unresolved drafting markers remain.
    Evidence: .sisyphus/evidence/task-7-draft-mvp-error.txt
  ```

  **Commit**: NO | Message: `docs(mvp): draft unified architecture` | Files: [`/work/ock-omo-system/MVP.md`]

- [x] 8. Add executable acceptance-suite appendix to `MVP.md`

  **What to do**: Add a final Acceptance Suite section to `MVP.md` that tells future implementers exactly how the unified MVP will later be proven. Include smoke tests for fresh init, OCK upgrade on customized projects, legacy OMO config loading, command/skill precedence, session bridge behavior, skill-MCP bridge behavior, and Rust/beads task lifecycle. Each test must list expected artifacts, config keys, and exit conditions.
  **Must NOT do**: Do not use vague end-to-end wording. Do not leave the Rust requirement untestable or implicit.

  **Recommended Agent Profile**:
  - Category: `writing` - Reason: this is QA-document authoring with specific executable checks.
  - Skills: []
  - Omitted: [`playwright`] - browser automation is not relevant to this architecture artifact.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 9 | Blocked By: 3, 4, 5, 6, 7

  **References**:
  - OCK verification baseline: `/work/ock-omo-system/opencodekit-template/package.json:35-49`, `/work/ock-omo-system/opencodekit-template/.opencode/README.md:47-54`.
  - OMO verification baseline: `/work/ock-omo-system/oh-my-openagent/package.json:23-35`, `/work/ock-omo-system/AGENTS.md:35-40`.
  - OCK init/upgrade behavior that future tests must cover: `/work/ock-omo-system/opencodekit-template/src/index.ts:64-84`, `/work/ock-omo-system/opencodekit-template/src/index.ts:159-177`, `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:186-225`, `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:113-189`.
  - OMO config compatibility behavior that future tests must cover: `/work/ock-omo-system/oh-my-openagent/src/plugin-config.ts:168-254`.

  **Acceptance Criteria**:
  - [x] `MVP.md` contains an Acceptance Suite section with all mandatory future smoke tests.
  - [x] Each smoke test names exact commands or exact assertions/artifacts to check.
  - [x] The suite covers dual-repo verification plus unified-product compatibility behavior.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Acceptance suite includes all mandatory smoke tests
    Tool: Bash
    Steps: Run Python to assert the Acceptance Suite section includes fresh init, upgrade-preserve, legacy config, precedence, session bridge, skill-MCP bridge, and Rust/beads smoke test labels.
    Expected: All mandatory smoke tests are listed.
    Evidence: .sisyphus/evidence/task-8-acceptance-suite.txt

  Scenario: Acceptance suite avoids vague end-to-end claims
    Tool: Bash
    Steps: Run Python to scan the Acceptance Suite for forbidden vague phrases like `works end-to-end` unless immediately followed by explicit assertions.
    Expected: Tests are concrete and assertion-based.
    Evidence: .sisyphus/evidence/task-8-acceptance-suite-error.txt
  ```

  **Commit**: NO | Message: `docs(mvp): add acceptance suite` | Files: [`/work/ock-omo-system/MVP.md`]

- [x] 9. Perform architecture consistency and evidence pass

  **What to do**: Review the completed `MVP.md` against the source references and this plan. Check for contradictions around memory ownership, bridge permanence, naming, scheduler ownership, preserve/skip semantics, and repo/toolchain assumptions. Tighten language where it could accidentally authorize over-scoped implementation.
  **Must NOT do**: Do not add new scope during review. Do not silently change frozen decisions. Do not leave narrative claims unsupported by the cited repo reality.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is a skeptical high-precision review task.
  - Skills: []
  - Omitted: [`review-work`] - not needed; this is already a review-style task.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: F1-F4 | Blocked By: 2, 3, 4, 5, 6, 7, 8

  **References**:
  - Memory caution: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/memory.ts:1-89`, `/work/ock-omo-system/opencodekit-template/.opencode/memory/research/context-management-analysis.md:13-16`.
  - Scheduler ownership: `/work/ock-omo-system/oh-my-openagent/src/features/background-agent/manager.ts:139-196`.
  - Config/name migration: `/work/ock-omo-system/oh-my-openagent/src/shared/plugin-identity.ts:1-6`, `/work/ock-omo-system/oh-my-openagent/src/plugin-config.ts:168-254`.
  - OCK preserve/skip semantics: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:47-77`, `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:29-45`.

  **Acceptance Criteria**:
  - [x] No contradiction remains between `MVP.md` and the frozen decisions in this plan.
  - [x] No contradiction remains between `MVP.md` and cited OCK/OMO source evidence.
  - [x] `MVP.md` contains explicit bridge removal triggers and does not normalize permanent duplication.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Consistency pass verifies critical claims
    Tool: Bash
    Steps: Run Python assertions for key phrases including `one scheduler`, memory ownership wording, legacy compatibility wording, and bridge removal trigger wording.
    Expected: All critical architecture claims are present and mutually consistent.
    Evidence: .sisyphus/evidence/task-9-consistency-pass.txt

  Scenario: Review catches no permanent-bridge drift
    Tool: Bash
    Steps: Run Python to ensure `temporary`, `bridge`, and `removal trigger` language all appear, and that no section frames bridge logic as final architecture.
    Expected: The bridge is clearly temporary by design.
    Evidence: .sisyphus/evidence/task-9-consistency-pass-error.txt
  ```

  **Commit**: NO | Message: `docs(mvp): review architecture consistency` | Files: [`/work/ock-omo-system/MVP.md`]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Document Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy

- Do not commit as part of MVP document creation unless the user explicitly requests it.
- If the user later requests a commit after approval, use a docs-scoped message that only stages the new architecture artifact and any directly related root-level docs, e.g. `docs(mvp): define unified ock-omo architecture`.

## Success Criteria

- `MVP.md` exists at workspace root and can be used as the single direction-setting architecture doc for the combined project.
- The document freezes ownership for every overlapping capability with no ambiguous “shared” runtime rows.
- The document preserves `ock` as the front door, OMO as the runtime engine, and Rust as a bounded task-lifecycle contract.
- The document explains how legacy OMO names/configs survive MVP without introducing a new third runtime identity.
- The document defines migration and bridge removal rules that respect OCK preserve/skip semantics.
- The document includes an executable acceptance-suite appendix for the future implementation phase.
