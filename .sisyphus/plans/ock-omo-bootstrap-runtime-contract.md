# OCK + OMO Bootstrap Runtime Contract

## TL;DR

> **Summary**: Implement the first real unification slice by making `ock` initialize and upgrade a deterministic OMO-compatible project runtime shape, while keeping OMO as the sole runtime/config/execution owner.
> **Deliverables**:
>
> - deterministic canonical OMO config emission from OCK init/upgrade
> - upgrade-safe bridge-controlled file placement under `.opencode/`
> - optional OCK runtime front-door handoff that delegates to OMO-owned runner semantics
> - contract tests proving fresh init, global-config overlap, upgrade/orphan safety, and OMO config compatibility
>   **Effort**: Medium
>   **Parallel**: YES - 2 waves
>   **Critical Path**: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

## Context

### Original Request

- User approved the MVP architecture and asked to proceed with the first implementation plan.
- The selected first slice is the bootstrap/runtime contract: prove that OCK is the front door and OMO is the runtime engine before tackling deeper bridges.

### Interview Summary

- Architecture remains frozen from `MVP.md`:
  - OCK is the public entry/front door.
  - OMO is the runtime/orchestration engine.
  - `beads_rust` stays task substrate only.
  - Compatibility bridge first.
  - Memory consolidation deferred.
- User explicitly chose to proceed with “Plan 1”.
- Planning mode was escalated to ultrabrain-level scrutiny for this slice.

### Metis Review (gaps addressed)

- This slice must be a **bridge contract plan**, not a broad merge plan.
- New installs must write **canonical** OMO identifiers only.
- Bridge-controlled files must live in upgradeable, template-owned `.opencode/` root-level locations rather than preserved user/hybrid directories.
- Any runtime front door added in OCK must **delegate** to OMO-owned runtime behavior rather than reimplementing it.
- The plan must explicitly exclude memory migration, full CLI unification, and scheduler/task-engine expansion.

## Work Objectives

### Core Objective

Implement the smallest real unification slice that proves an OCK-initialized project can be loaded and run by OMO using canonical project config and deterministic bridge-managed artifacts, with upgrade-safe behavior and no hidden reliance on machine-specific global config.

### Deliverables

- OCK init/upgrade behavior that emits canonical OMO bridge artifacts into deterministic project-local `.opencode/` locations.
- OCK preserve/skip/prune logic updated so bridge-managed files remain upgradeable and orphan-safe.
- OMO config compatibility tests covering canonical and legacy project config loading, canonical precedence, and project/user merge constraints.
- OCK-side contract tests covering init, global-config overlap, upgrade pruning, and any runtime handoff wrapper behavior introduced in this slice.
- Documentation/comments only as needed inside touched implementation files and tests; no new broad architecture docs.

### Definition of Done (verifiable conditions with commands)

```bash
cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run test && npm run build

cd /work/ock-omo-system/oh-my-openagent && bun run typecheck && bun test src/plugin-config.test.ts && bun run build

TMP="$(mktemp -d)" && cd "$TMP" && node /work/ock-omo-system/opencodekit-template/dist/index.js init --yes --project-only --beads && test -f "$TMP/.opencode/opencode.json" && test -f "$TMP/.opencode/oh-my-openagent.jsonc" && grep -q 'oh-my-openagent' "$TMP/.opencode/opencode.json" && ! grep -q 'oh-my-opencode' "$TMP/.opencode/opencode.json" && test -e "$TMP/.beads"

TMP_HOME="$(mktemp -d)" && TMP_PROJ="$(mktemp -d)" && mkdir -p "$TMP_HOME/opencode/agent" && printf 'agent\n' > "$TMP_HOME/opencode/agent/demo.md" && cd "$TMP_PROJ" && XDG_CONFIG_HOME="$TMP_HOME" node /work/ock-omo-system/opencodekit-template/dist/index.js init --yes --project-only && test -f "$TMP_PROJ/.opencode/oh-my-openagent.jsonc" && test ! -d "$TMP_PROJ/.opencode/agent"

TMP="$(mktemp -d)" && cd "$TMP" && node /work/ock-omo-system/opencodekit-template/dist/index.js init --yes && printf 'orphan\n' > "$TMP/.opencode/obsolete-bridge-file.txt" && node /work/ock-omo-system/opencodekit-template/dist/index.js upgrade --force --prune-all && test ! -f "$TMP/.opencode/obsolete-bridge-file.txt" && test -f "$TMP/.opencode/oh-my-openagent.jsonc"
```

### Must Have

- New installs emit only canonical `oh-my-openagent` plugin/config identifiers.
- Legacy `oh-my-opencode` project config remains readable by OMO, but is not emitted by OCK for new installs.
- Bridge-controlled files live outside preserved directories like `agent/`, `command/`, `context/`, `memory/`, `skill/`, and `tool/`.
- OCK remains responsible for bootstrap/upgrade UX and artifact writing.
- OMO remains responsible for config parsing, config merge, runtime registration, and runtime execution semantics.
- Any OCK runtime front-door command added in this slice preserves OMO `run` contract semantics rather than forking them.

### Must NOT Have

- No memory migration or memory ownership changes.
- No command/skill/session bridge completion.
- No task scheduling changes or new Rust worker/scheduler behavior.
- No package-manager/toolchain unification.
- No broad CLI merge of doctor/install/TUI/OAuth/version flows.
- No runtime bridge files placed only inside preserved user/hybrid directories.
- No dual-write of canonical and legacy OMO config files for new installs.

## Verification Strategy

> ZERO HUMAN INTERVENTION - all verification is agent-executed.

- Test decision: tests-after. This slice spans two repos and is best validated with fixture-based contract tests plus temp-dir smoke checks after implementation.
- QA policy: every task includes implementation + verification together; no “write code now, test later” split tasks.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy

### Parallel Execution Waves

> The critical path is OCK bootstrap contract first, then OMO compatibility and final cross-repo verification.

Wave 1: 1) extract OCK init helpers, 2) extract OCK upgrade helpers, 3) define canonical bridge artifact policy, 4) add OMO config compatibility tests

Wave 2: 5) implement OCK init/upgrade bridge behavior, 6) add OCK contract tests, 7) add optional runtime handoff wrapper if needed, 8) run cross-repo verification pass

### Dependency Matrix (full, all tasks)

| Task | Depends On | Blocks     |
| ---- | ---------- | ---------- |
| 1    | —          | 5, 6, 7    |
| 2    | —          | 5, 6       |
| 3    | 1, 2       | 5, 6, 7, 8 |
| 4    | —          | 8          |
| 5    | 1, 2, 3    | 6, 7, 8    |
| 6    | 1, 2, 3, 5 | 8          |
| 7    | 1, 3, 5    | 8          |
| 8    | 4, 5, 6, 7 | F1-F4      |

### Agent Dispatch Summary

| Wave | Task Count | Categories                       |
| ---- | ---------- | -------------------------------- |
| 1    | 4          | `deep` x4                        |
| 2    | 4          | `deep` x2, `unspecified-high` x2 |

## TODOs

<!-- TASKS INSERT HERE -->

> Historical task and acceptance checkboxes below track execution progress inside this plan. They are distinct from the final user-approval gates in F1-F4, which must remain unchecked until explicit user okay is recorded.

- [x] 1. Extract OCK init bridge logic into focused modules before behavior changes

  **What to do**: Refactor `opencodekit-template/src/commands/init.ts` so the bootstrap/runtime bridge behavior can be added without extending an already oversized file. Extract focused helpers for: global-config detection, project-only skip decisions, canonical bridge artifact emission, `.beads` initialization, and dependency-install outcome handling. Keep `init.ts` as the orchestrator while moving new slice-specific logic into dedicated modules under `src/commands/init/` or a similarly scoped folder.
  **Must NOT do**: Do not change memory semantics. Do not move template-authoring concerns out of `.opencode/`. Do not clean up unrelated command-surface debt while doing this extraction.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this touches high-risk bootstrap logic and must preserve existing behavior while creating safe seams.
  - Skills: []
  - Omitted: [`git-master`] - no git work is needed.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 6, 7 | Blocked By: none

  **References**:
  - Implementation: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:40-49` - preserve-user dirs contract.
  - Implementation: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:47-99` - global-config detection and path rules.
  - Implementation: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:186-225` - selective `.opencode` copy behavior.
  - CLI entry: `/work/ock-omo-system/opencodekit-template/src/index.ts:63-84` - `ock init` command options and license gate.
  - Local rule: `/work/ock-omo-system/opencodekit-template/src/AGENTS.md:18-31` - keep command behavior in `src/commands/`, preserve CLI/template split.

  **Acceptance Criteria** (agent-executable only):
  - [x] `init.ts` delegates slice-specific bridge logic to extracted modules rather than adding more large in-file branches.
  - [x] Existing `ock init` options and license-gate behavior remain intact.
  - [x] LSP diagnostics for the touched OCK command subtree report no new errors.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Init extraction preserves command surface
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run test -- src/commands/init-upgrade.test.ts`
    Expected: Typecheck passes and existing init/upgrade tests still pass after extraction.
    Evidence: .sisyphus/evidence/task-1-init-extraction.txt

  Scenario: Extraction does not introduce compiler regressions
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/opencodekit-template && npm run build`
    Expected: Build completes successfully with extracted modules included.
    Evidence: .sisyphus/evidence/task-1-init-extraction-error.txt
  ```

  **Commit**: NO | Message: `refactor(init): extract bootstrap bridge helpers` | Files: [`opencodekit-template/src/commands/init.ts`, `opencodekit-template/src/commands/init/*`]

- [x] 2. Extract OCK upgrade bridge logic into focused modules before behavior changes

  **What to do**: Refactor `opencodekit-template/src/commands/upgrade.ts` so bridge-controlled file ownership, orphan pruning, and preserve-vs-template rules can be modified safely. Extract focused helpers for template-owned bridge file lists, preserve/prune rules, and bridge artifact refresh decisions. Preserve existing patch/orphan behavior while creating a narrow seam for the new canonical runtime contract.
  **Must NOT do**: Do not alter preserve behavior for memory, context, command, skill, tool, or agent beyond what is required to keep bridge-controlled files out of those directories. Do not introduce a new upgrade strategy unrelated to bridge artifacts.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: upgrade semantics are brittle and tightly coupled to preserve/prune behavior.
  - Skills: []
  - Omitted: [`review-work`] - premature.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5, 6 | Blocked By: none

  **References**:
  - Implementation: `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:29-44` - preserved files and directories.
  - Implementation: `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:113-189` - copy with preserve rules.
  - Implementation: `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:280-291` - orphan detection.
  - Implementation: `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:439-485` - prune flow.
  - CLI entry: `/work/ock-omo-system/opencodekit-template/src/index.ts:159-177` - `ock upgrade` command options and license gate.

  **Acceptance Criteria** (agent-executable only):
  - [x] `upgrade.ts` delegates bridge-related ownership decisions to extracted modules.
  - [x] Existing preserve/prune behavior remains stable except where explicitly changed for bridge-controlled files.
  - [x] LSP diagnostics for the touched OCK command subtree report no new errors.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Upgrade extraction preserves test behavior
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/opencodekit-template && npm run test -- src/commands/init-upgrade.test.ts`
    Expected: Existing init/upgrade tests still pass after extraction.
    Evidence: .sisyphus/evidence/task-2-upgrade-extraction.txt

  Scenario: Upgrade extraction preserves build behavior
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/opencodekit-template && npm run build`
    Expected: Build completes successfully after extraction.
    Evidence: .sisyphus/evidence/task-2-upgrade-extraction-error.txt
  ```

  **Commit**: NO | Message: `refactor(upgrade): extract bridge ownership helpers` | Files: [`opencodekit-template/src/commands/upgrade.ts`, `opencodekit-template/src/commands/upgrade/*`]

- [x] 3. Define and implement the canonical bridge artifact contract in OCK

  **What to do**: Change OCK bootstrap output so new installs emit canonical OMO identifiers only. Ensure project-local runtime bridge artifacts include `.opencode/oh-my-openagent.jsonc` (or `.json` only if there is a compelling existing parser constraint proven in code), and ensure any plugin registration or runtime reference emitted by OCK uses `oh-my-openagent`, not `oh-my-opencode`. Keep legacy-name compatibility as read-only behavior in OMO; do not dual-write both names for fresh installs.
  **Must NOT do**: Do not remove OMO’s legacy-read compatibility. Do not create a third config basename. Do not emit canonical and legacy variants together for new projects.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is the central contract decision of the slice.
  - Skills: []
  - Omitted: [`git-master`] - irrelevant.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5, 6, 7, 8 | Blocked By: 1, 2

  **References**:
  - Canonical identity: `/work/ock-omo-system/oh-my-openagent/src/shared/plugin-identity.ts:1-4`.
  - OMO config loading: `/work/ock-omo-system/oh-my-openagent/src/plugin-config.ts:168-228` - canonical/legacy detection and migration rules.
  - OCK build/template bundling: `/work/ock-omo-system/opencodekit-template/package.json:35-49` - `.opencode/` bundle path.
  - OCK init selective copy: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:186-225`.

  **Acceptance Criteria** (agent-executable only):
  - [x] Fresh OCK-generated projects emit only canonical `oh-my-openagent` plugin/config identifiers.
  - [x] No fresh-install path emits a new `oh-my-opencode` project config file.
  - [x] OMO legacy-read compatibility is unchanged for pre-existing repos.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Fresh init emits canonical OMO identifiers only
    Tool: Bash
    Steps: Run `TMP="$(mktemp -d)" && cd "$TMP" && node /work/ock-omo-system/opencodekit-template/dist/index.js init --yes --project-only --beads && test -f "$TMP/.opencode/oh-my-openagent.jsonc" && grep -q 'oh-my-openagent' "$TMP/.opencode/opencode.json" && ! grep -q 'oh-my-opencode' "$TMP/.opencode/opencode.json"`
    Expected: Canonical file exists and project bootstrap does not emit legacy OMO identifiers for fresh install.
    Evidence: .sisyphus/evidence/task-3-canonical-bridge.txt

  Scenario: Legacy support remains read-compatible only
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/oh-my-openagent && bun test src/plugin-config.test.ts`
    Expected: Plugin-config tests confirm canonical load, legacy load, and canonical precedence without requiring OCK to dual-write legacy files.
    Evidence: .sisyphus/evidence/task-3-canonical-bridge-error.txt
  ```

  **Commit**: NO | Message: `feat(bootstrap): emit canonical omo bridge config` | Files: [`opencodekit-template/.opencode/**`, `opencodekit-template/src/commands/init.ts`, `opencodekit-template/src/commands/upgrade.ts`]

- [x] 4. Extend OMO config compatibility tests for the bootstrap contract

  **What to do**: Add or extend `oh-my-openagent/src/plugin-config.test.ts` so OMO proves the runtime side of the bridge contract. Cover canonical project config loading, legacy project config loading, canonical precedence when both exist, and the fact that `mcp_env_allowlist` remains user-sourced rather than project-sourced. Use temp-dir fixtures; do not rely on a live OCK install in this repo’s tests.
  **Must NOT do**: Do not change OMO config semantics beyond what is required for the tests to reflect the intended contract. Do not add OCK-specific bootstrap logic into OMO tests.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this locks the runtime side of the contract with executable tests.
  - Skills: []
  - Omitted: [`playwright`] - irrelevant.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 8 | Blocked By: none

  **References**:
  - Test file: `/work/ock-omo-system/oh-my-openagent/src/plugin-config.test.ts`.
  - Config loader: `/work/ock-omo-system/oh-my-openagent/src/plugin-config.ts:168-244`.
  - Identity constants: `/work/ock-omo-system/oh-my-openagent/src/shared/plugin-identity.ts:1-4`.

  **Acceptance Criteria** (agent-executable only):
  - [x] OMO tests cover canonical `.opencode/oh-my-openagent.jsonc` load.
  - [x] OMO tests cover legacy `.opencode/oh-my-opencode.jsonc` load.
  - [x] OMO tests prove canonical wins when both exist.
  - [x] OMO tests prove `mcp_env_allowlist` comes from user config, not project config.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: OMO plugin-config contract tests pass
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/oh-my-openagent && bun test src/plugin-config.test.ts`
    Expected: All config compatibility cases pass.
    Evidence: .sisyphus/evidence/task-4-omo-config-tests.txt

  Scenario: OMO typecheck and build still pass
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/oh-my-openagent && bun run typecheck && bun run build`
    Expected: No runtime or schema regressions were introduced.
    Evidence: .sisyphus/evidence/task-4-omo-config-tests-error.txt
  ```

  **Commit**: NO | Message: `test(config): cover canonical and legacy bridge loading` | Files: [`oh-my-openagent/src/plugin-config.test.ts`]

- [x] 5. Implement OCK bootstrap and upgrade behavior for bridge-controlled files

  **What to do**: Update OCK init/upgrade behavior so canonical OMO bridge-controlled files are always written to deterministic, template-owned `.opencode/` root-level locations and remain refreshable on upgrade. Ensure this works with `--project-only`, global-config overlap, `--force`, `--backup`, and prune flows. If a bridge-controlled file currently lives in a preserved directory, move its responsibility to an upgradeable root-level bridge location.
  **Must NOT do**: Do not move user-owned memory/context content. Do not relocate arbitrary command/skill/tool authoring files as part of this slice. Do not depend on global config for runtime-critical bridge artifacts.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is the main behavior change in the OCK repo and touches delicate file lifecycle semantics.
  - Skills: []
  - Omitted: [`review-work`] - not yet.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 6, 7, 8 | Blocked By: 1, 2, 3

  **References**:
  - OCK init skip logic: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:198-225`.
  - OCK global-config overlap: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:47-99`.
  - OCK preserve-user dirs: `/work/ock-omo-system/opencodekit-template/src/commands/init.ts:40-49`.
  - OCK upgrade preserve dirs: `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:35-44`.
  - OCK orphan/prune logic: `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:280-291`, `/work/ock-omo-system/opencodekit-template/src/commands/upgrade.ts:439-485`.

  **Acceptance Criteria** (agent-executable only):
  - [x] `ock init --project-only` still creates canonical bridge-controlled files even when shared dirs are skipped.
  - [x] `ock upgrade --force --prune-all` preserves canonical bridge-controlled files and removes obsolete bridge-owned files.
  - [x] Bridge-controlled files are not placed solely inside preserved user/hybrid directories.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Global-config overlap still yields local canonical bridge contract
    Tool: Bash
    Steps: Run `TMP_HOME="$(mktemp -d)" && TMP_PROJ="$(mktemp -d)" && mkdir -p "$TMP_HOME/opencode/agent" && printf 'agent\n' > "$TMP_HOME/opencode/agent/demo.md" && cd "$TMP_PROJ" && XDG_CONFIG_HOME="$TMP_HOME" node /work/ock-omo-system/opencodekit-template/dist/index.js init --yes --project-only && test -f "$TMP_PROJ/.opencode/oh-my-openagent.jsonc" && test ! -d "$TMP_PROJ/.opencode/agent"`
    Expected: Shared dirs may be skipped, but canonical local bridge config still exists.
    Evidence: .sisyphus/evidence/task-5-bootstrap-bridge.txt

  Scenario: Upgrade prunes obsolete bridge files without deleting canonical bridge config
    Tool: Bash
    Steps: Run `TMP="$(mktemp -d)" && cd "$TMP" && node /work/ock-omo-system/opencodekit-template/dist/index.js init --yes && printf 'orphan\n' > "$TMP/.opencode/obsolete-bridge-file.txt" && node /work/ock-omo-system/opencodekit-template/dist/index.js upgrade --force --prune-all && test ! -f "$TMP/.opencode/obsolete-bridge-file.txt" && test -f "$TMP/.opencode/oh-my-openagent.jsonc"`
    Expected: Obsolete bridge file is removed, canonical bridge config remains.
    Evidence: .sisyphus/evidence/task-5-bootstrap-bridge-error.txt
  ```

  **Commit**: NO | Message: `feat(upgrade): preserve canonical omo bridge artifacts` | Files: [`opencodekit-template/src/commands/init.ts`, `opencodekit-template/src/commands/upgrade.ts`, `opencodekit-template/.opencode/**`]

- [x] 6. Add OCK contract tests for bootstrap and upgrade bridge behavior

  **What to do**: Extend or add OCK tests so the bridge contract is covered directly in the OCK repo. Use fixture/temp-dir tests for canonical config emission, project-only + global-config overlap, upgrade prune behavior, and any dependency-install success/failure semantics that this slice decides. Reuse `src/commands/init-upgrade.test.ts` if practical; create a new focused contract test file if that keeps the suite cleaner.
  **Must NOT do**: Do not create tests that rely on a live remote model/provider. Do not encode memory/session/skill-MCP expectations into this slice’s contract tests.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is cross-behavior fixture testing with nuanced lifecycle assertions.
  - Skills: []
  - Omitted: [`playwright`] - not relevant.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1, 2, 3, 5

  **References**:
  - Existing test: `/work/ock-omo-system/opencodekit-template/src/commands/init-upgrade.test.ts`.
  - OCK CLI options: `/work/ock-omo-system/opencodekit-template/src/index.ts:63-84`, `/work/ock-omo-system/opencodekit-template/src/index.ts:159-177`.
  - OCK build/test commands: `/work/ock-omo-system/opencodekit-template/package.json:35-49`.

  **Acceptance Criteria** (agent-executable only):
  - [x] OCK tests cover canonical bridge config emission.
  - [x] OCK tests cover project-only + global-config overlap behavior.
  - [x] OCK tests cover upgrade prune behavior for obsolete bridge-owned files.
  - [x] OCK test suite passes in the local repo.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: OCK bridge contract tests pass
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/opencodekit-template && npm run test -- src/commands/init-upgrade.test.ts`
    Expected: Bridge-related init/upgrade scenarios pass in the OCK test suite.
    Evidence: .sisyphus/evidence/task-6-ock-contract-tests.txt

  Scenario: OCK typecheck and build still pass
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run build`
    Expected: No CLI/build regressions were introduced.
    Evidence: .sisyphus/evidence/task-6-ock-contract-tests-error.txt
  ```

  **Commit**: NO | Message: `test(bootstrap): cover canonical runtime bridge contract` | Files: [`opencodekit-template/src/commands/init-upgrade.test.ts` or `opencodekit-template/src/commands/*bridge*.test.ts`]

- [x] 7. Add a minimal OCK runtime front-door handoff only if needed for this slice

  **What to do**: Decide whether this slice truly requires an OCK-side runtime handoff command. If required to prove “OCK fronts runtime,” implement the thinnest possible wrapper that delegates to OMO-owned `run` behavior without reimplementing config loading, session lifecycle, SIGINT behavior, JSON-output semantics, or `--port`/`--attach` validation. If not strictly required for slice acceptance, document that the front-door proof is satisfied by `ock init` + OMO runtime execution and skip adding the wrapper.
  **Must NOT do**: Do not clone OMO runner logic into OCK. Do not add a broad CLI merge. Do not touch unrelated OMO CLI commands.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: this is a boundary/ownership decision with potential for architectural drift.
  - Skills: []
  - Omitted: [`frontend-ui-ux`] - irrelevant.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1, 3, 5

  **References**:
  - OMO CLI run command: `/work/ock-omo-system/oh-my-openagent/src/cli/cli-program.ts:69-129`.
  - OMO run behavior: `/work/ock-omo-system/oh-my-openagent/src/cli/run/runner.ts:32-162`.
  - OCK CLI entrypoint: `/work/ock-omo-system/opencodekit-template/src/index.ts:35-177`.

  **Acceptance Criteria** (agent-executable only):
  - [x] If a wrapper is added, it preserves OMO run contract semantics for forwarded args, JSON mode, SIGINT, and `--port` + `--attach` exclusivity.
  - [x] If no wrapper is added, the implementation documents and tests that slice-one runtime proof uses OCK bootstrap plus OMO runtime execution directly.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: Runtime handoff wrapper preserves OMO run semantics
    Tool: Bash
    Steps: Run the relevant OCK-side runtime handoff test suite, e.g. `cd /work/ock-omo-system/opencodekit-template && npm run test -- src/commands/run-bridge.test.ts`
    Expected: Forwarded args, JSON mode, and invalid `--port` + `--attach` behavior match the OMO contract.
    Evidence: .sisyphus/evidence/task-7-runtime-handoff.txt

  Scenario: No-wrapper path remains explicitly verified
    Tool: Bash
    Steps: If no wrapper is implemented, run a documentation/contract test that asserts slice-one proof is `ock init` + `bunx oh-my-opencode run --directory "$TMP" --json ...` rather than an OCK-owned runtime.
    Expected: The slice proves architecture without creating runtime ownership drift.
    Evidence: .sisyphus/evidence/task-7-runtime-handoff-error.txt
  ```

  **Commit**: NO | Message: `feat(runtime): add thin ock-to-omo handoff` | Files: [`opencodekit-template/src/index.ts`, `opencodekit-template/src/commands/*`, optional tests]

- [x] 8. Run the cross-repo bridge verification pass

  **What to do**: Execute the full contract verification after implementation. This includes OCK typecheck/test/build, OMO typecheck/plugin-config tests/build, and the temp-dir smoke tests for fresh init, global-config overlap, and upgrade prune behavior. Treat any mismatch between OCK-emitted artifacts and OMO-loaded artifacts as a slice failure.
  **Must NOT do**: Do not substitute manual inspection for executable checks. Do not sign off if the bridge only works on the local machine because of global config side effects.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: this is multi-repo contract QA with high skepticism.
  - Skills: []
  - Omitted: [`review-work`] - the final verification wave already covers formal review.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: F1-F4 | Blocked By: 4, 5, 6, 7

  **References**:
  - OCK verification commands: `/work/ock-omo-system/opencodekit-template/AGENTS.md:38-47`.
  - OMO verification commands: `/work/ock-omo-system/oh-my-openagent/AGENTS.md:96-103`.
  - MVP contract: `/work/ock-omo-system/MVP.md:79-148`, `/work/ock-omo-system/MVP.md:210-387`.

  **Acceptance Criteria** (agent-executable only):
  - [x] All OCK verification commands pass.
  - [x] All OMO verification commands pass.
  - [x] Temp-dir smoke tests for init, project-only overlap, and upgrade prune all pass.
  - [x] The resulting project artifacts match the canonical OMO bridge contract.

  **QA Scenarios** (MANDATORY - task incomplete without these):

  ```
  Scenario: OCK verification suite passes
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run test && npm run build`
    Expected: OCK repo passes the full verification suite for this slice.
    Evidence: .sisyphus/evidence/task-8-ock-cross-repo-verify.txt

  Scenario: OMO verification suite and temp-dir smoke tests pass
    Tool: Bash
    Steps: Run `cd /work/ock-omo-system/oh-my-openagent && bun run typecheck && bun test src/plugin-config.test.ts && bun run build`, then execute the temp-dir smoke commands from Definition of Done.
    Expected: OMO passes compatibility verification and the cross-repo bridge contract holds under temp-dir bootstrap scenarios.
    Evidence: .sisyphus/evidence/task-8-omo-cross-repo-verify.txt
  ```

  **Commit**: NO | Message: `test(contract): verify ock-omo bootstrap bridge` | Files: [verification only]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.

- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy

- Do not commit automatically.
- If the user requests a commit after approval, use a message scoped to the bridge contract slice only, e.g. `feat(bootstrap): add omo runtime contract to ock init`.

## Success Criteria

- `ock init` and `ock upgrade` deterministically manage canonical OMO bridge artifacts at project scope.
- OMO can load canonical project config and still read legacy project config during the compatibility window.
- The bridge survives `--project-only`, global-config overlap, upgrade preserve rules, and orphan pruning.
- No runtime ownership drift into OCK and no memory/task-engine scope creep occurs.
