# OCK ↔ OMO Bridge Unification

## TL;DR
> **Summary**: Unify the MVP around OCK as the front door and OMO as the only runtime owner by migrating shipped OCK content onto OMO session / skill-MCP semantics, hardening init/upgrade + diagnostics, and removing duplicate OCK runtime plugins only after compatibility is proven.
> **Deliverables**:
> - Canonical project-local bridge contract for `.opencode/oh-my-openagent.jsonc` and plugin registration
> - OMO-owned compatibility path for legacy OCK-authored session and `skill_mcp` usage
> - Updated OCK distributed commands / skills / docs targeting OMO runtime semantics
> - Unified `ock status` / `ock doctor` bridge diagnostics with deterministic warnings
> - Removal of duplicate OCK runtime plugins `sessions.ts` and `skill-mcp.ts`
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 → Tasks 3/4 → Tasks 5/6 → Task 7 → Task 8

## Context
### Original Request
- “based on our MVP or implementation what is next that we need to plan and execute?”

### Interview Summary
- The likely MVP is the unified product defined in `/work/ock-omo-system/MVP.md`, not either repo in isolation.
- The user selected **Bridge Unification** over release hardening.
- The user selected **tests-after using existing infrastructure**.
- Scope is limited to runtime ownership cleanup, init/upgrade semantics, diagnostics, and duplicate-runtime removal. Memory consolidation, repo/toolchain merge, and unrelated CLI polish remain out of scope.

### Metis Review (gaps addressed)
- Freeze this phase to **project-local migration only**; do not modify global config under `~/.config/opencode`.
- Treat `.opencode/oh-my-openagent.jsonc` as a **template-owned canonical bridge file**. In this phase, its schema remains the current valid empty object (`{}`) unless OMO explicitly requires runtime config keys later.
- Do **not** rely on rewriting preserved directories (`command/`, `skill/`, `tool/`) during upgrade. Compatibility must live in OMO runtime behavior and OCK diagnostics, not in optimistic preserve-dir rewrites.
- Add deterministic coverage for versioned plugin entries, dual-basename coexistence, and preserved legacy-authored content.

### Oracle Review (defaults frozen)
- Keep migration **project-only**.
- Cover **CLI + distributed `/status`** in the diagnostics contract.
- Handle `skill_mcp` as an **OMO-owned compatibility cutover**, not two live runtime contracts.
- Do **not** port `skill_mcp_status` or `skill_mcp_disconnect` into OMO; treat them as deprecated / unsupported and surface that via diagnostics.

## Discovery
- `/work/ock-omo-system/MVP.md:81-107` and `/work/ock-omo-system/MVP.md:229-239` already freeze the ownership matrix and the bridge-placement rule: OCK owns init/upgrade/distribution, OMO owns runtime semantics, and bridge-critical behavior must live in upgradeable locations rather than skipped/preserved authoring directories.
- OCK already scaffolds the canonical bridge file and plugin registration, but the implementation is incomplete for migration safety: `/work/ock-omo-system/opencodekit-template/src/commands/init/runtime.ts:14-72` only canonicalizes exact `oh-my-opencode` entries, `/work/ock-omo-system/opencodekit-template/src/commands/upgrade/bridge.ts:5-58` mirrors the same limitation, while `/work/ock-omo-system/oh-my-openagent/src/shared/plugin-entry-migrator.ts:3-18` already handles versioned legacy entries like `oh-my-opencode@latest`.
- The canonical bridge file exists but is currently only a template-owned placeholder: `/work/ock-omo-system/opencodekit-template/.opencode/oh-my-openagent.jsonc:1-2`. That means this phase must treat **file existence + overwriteability** as the contract, not invent unsupported config keys.
- OCK still ships legacy runtime-shaped surfaces and live authored dependencies on them: `.opencode/plugin/sessions.ts:97-428`, `.opencode/plugin/skill-mcp.ts:374-618`, `.opencode/command/status.md:41-67`, `.opencode/command/resume.md:49-53`, `.opencode/skill/context-management/SKILL.md:72-74`, `.opencode/skill/context-management/SKILL.md:336-350`, `.opencode/AGENTS.md:388-396`, plus 118 `skill_mcp(skill_name=...)`-style matches across 19 distributed files.
- OMO already exposes the winning runtime surfaces: `/work/ock-omo-system/oh-my-openagent/src/tools/session-manager/tools.ts:34-157` provides `session_list`, `session_read`, `session_search`, and `session_info`; `/work/ock-omo-system/oh-my-openagent/src/tools/skill-mcp/tools.ts:121-204` provides canonical `skill_mcp(mcp_name=...)`.
- OCK `status` / `doctor` are currently buried inside an oversized mixed-responsibility file, `/work/ock-omo-system/opencodekit-template/src/commands/menu.ts:105-549`, and still emit stale Bun-oriented dependency advice (`bun install`) even though init/upgrade installs embedded dependencies with npm in `/work/ock-omo-system/opencodekit-template/src/commands/init/runtime.ts:216-230`.

## Work Objectives
### Core Objective
Make the unified MVP operationally true: OCK continues to author and distribute project content, but OMO becomes the only runtime owner for session browsing, skill-MCP execution, and bridge-critical runtime behavior.

### Deliverables
- OCK init/upgrade canonicalization that handles exact and versioned legacy plugin entries while always refreshing the template-owned canonical bridge file.
- OMO-owned compatibility support for legacy OCK-authored `find_sessions`, `read_session`, and `skill_mcp(skill_name=...)` usage.
- OCK distributed commands, skills, AGENTS docs, and plugin docs migrated to OMO runtime semantics.
- Extracted `ock status` / `ock doctor` modules with bridge-aware diagnostics and deterministic warning / error behavior.
- OCK duplicate runtime plugins removed from the distributed template once compatibility and migration coverage pass.

### Definition of Done (verifiable conditions with commands)
- `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run lint && npm run test && npm run build`
- `cd /work/ock-omo-system/oh-my-openagent && bun run typecheck && bun test && bun run build`
- Fresh or upgraded OCK-generated projects register `oh-my-openagent` canonically in `.opencode/opencode.json`, including versioned legacy-entry migration.
- `.opencode/oh-my-openagent.jsonc` remains template-owned and refreshable after `ock init`, `ock init --project-only`, and `ock upgrade --force`.
- Distributed OCK content contains no live references to `find_sessions`, `read_session`, `skill_mcp(skill_name=...)`, `skill_mcp_status`, or `skill_mcp_disconnect` outside intentional deprecation messaging.
- `ock status`, `ock doctor`, and distributed `/status` report bridge drift deterministically for legacy plugin entries, dual-basename coexistence, and preserved authored-content drift.
- `.opencode/plugin/sessions.ts` and `.opencode/plugin/skill-mcp.ts` are absent from source and built template output, with compatibility now owned by OMO runtime behavior.

### Must Have
- Project-only migration semantics.
- Template-owned canonical bridge file refresh.
- Exact + versioned plugin-entry canonicalization.
- OMO-owned compatibility for legacy authored content that cannot be rewritten during preserve-dir upgrades.
- Deterministic diagnostics and regression tests for canonical, legacy, and mixed states.

### Bridge File Mutation Policy
- `.opencode/oh-my-openagent.jsonc` is **template-owned**. `ock init`, `ock init --project-only`, and `ock upgrade` always refresh it from the template. User edits are unsupported and may be overwritten.
- `.opencode/opencode.json` is **user-owned but bridge-mutated in place**. This phase may change only the plugin-array entries needed for canonicalization/deduplication and must preserve all unrelated keys and non-bridge plugin entries byte-for-byte where possible.
- `.opencode/plugin/sessions.ts` and `.opencode/plugin/skill-mcp.ts` remain template-owned during the bridge window and are removed from the distributed template only in Task 8. If upgraded projects still contain drifted copies after removal, `ock status` / `ock doctor` must warn explicitly rather than silently relying on them.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No global-config mutation under `~/.config/opencode`.
- No memory-consolidation work.
- No release-hardening / CI-expansion work.
- No full internal OMO rename sweep beyond plugin entries, bridge basenames, and generated/user-facing runtime references.
- No repo/toolchain merge.
- No unrelated CLI polish or feature expansion.
- No bridge-critical reliance on preserved directories `command/`, `skill/`, or `tool/`.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + existing repo infrastructure (`vitest` / governance checks in OCK, `bun test` in OMO)
- QA policy: Every task includes happy-path and failure/edge-path scenarios with exact commands, file assertions, or deterministic warning strings.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: foundation
- Task 1 — extract `status` / `doctor` modules from OCK menu
- Task 2 — harden OCK init/upgrade bridge canonicalization
- Task 3 — add OMO legacy session compatibility
- Task 4 — add OMO legacy `skill_mcp` compatibility and deprecations

Wave 2: migrate authored content + diagnostics
- Task 5 — migrate distributed OCK session-authored content
- Task 6 — migrate distributed OCK `skill_mcp` docs/examples and plugin docs
- Task 7 — add unified bridge diagnostics to OCK CLI and distributed `/status`

Wave 3: cleanup and seal
- Task 8 — remove duplicate OCK runtime plugins and complete cross-repo regression coverage

### Dependency Matrix (full, all tasks)
| Task | Depends On | Why |
|---|---|---|
| 1 | — | Required before adding more behavior to `src/commands/menu.ts`. |
| 2 | — | Bridge canonicalization can be hardened independently. |
| 3 | — | OMO session compatibility is foundational and independent. |
| 4 | — | OMO `skill_mcp` compatibility is foundational and independent. |
| 5 | 3 | Distributed session-authored content should target the finalized OMO session surface. |
| 6 | 4 | Distributed `skill_mcp` examples must follow the finalized OMO compatibility contract. |
| 7 | 1, 2, 5, 6 | Diagnostics must build on extracted modules, canonicalization behavior, and migrated content. |
| 8 | 3, 4, 5, 6, 7 | Duplicate runtime plugins can only be removed after compatibility + diagnostics + migration coverage are complete. |

### Agent Dispatch Summary (wave → task count → categories)
| Wave | Task Count | Recommended Categories |
|---|---:|---|
| Wave 1 | 4 | 3 × `unspecified-high`, 1 × `ultrabrain` |
| Wave 2 | 3 | 2 × `unspecified-high`, 1 × `deep` |
| Wave 3 | 1 | 1 × `unspecified-high` |

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [ ] 1. Extract `ock status` and `ock doctor` out of `src/commands/menu.ts`

  **What to do**: Create focused command modules under `/work/ock-omo-system/opencodekit-template/src/commands/` for status and doctor behavior, move the existing logic out of `/work/ock-omo-system/opencodekit-template/src/commands/menu.ts`, and leave `menu.ts` responsible only for interactive selection/wiring. Keep output behavior unchanged in this task except for dependency-install guidance strings that must be normalized to the current npm-based embedded install flow. Add or update Vitest coverage for the extracted modules.
  **Must NOT do**: Do not add new bridge logic in `menu.ts`. Do not expand the feature set of status/doctor yet. Do not change unrelated interactive menu actions.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-file CLI extraction with tests and architecture guardrails
  - Skills: [] - no extra skill required beyond repo conventions
  - Omitted: [`git-master`] - no git operation is part of execution

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [7] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/work/ock-omo-system/opencodekit-template/src/commands/menu.ts:105-549` - current mixed-responsibility implementation that must be split before adding bridge logic
  - Pattern: `/work/ock-omo-system/opencodekit-template/src/AGENTS.md` - command handlers belong in `src/commands/`, with npm-based verification expectations
  - API/Type: `/work/ock-omo-system/opencodekit-template/src/commands/init/runtime.ts:216-230` - current embedded dependency install path uses npm, not bun
  - Test: `/work/ock-omo-system/opencodekit-template/src/index.test.ts:21-52` - existing CLI contract style
  - Test: `/work/ock-omo-system/opencodekit-template/src/commands/init-upgrade.test.ts:1-300` - colocated regression style and temporary-directory patterns

  **Acceptance Criteria** (agent-executable only):
  - [ ] `statusCommand` and `doctorCommand` no longer live in `/work/ock-omo-system/opencodekit-template/src/commands/menu.ts`
  - [ ] `/work/ock-omo-system/opencodekit-template/src/commands/menu.ts` remains an interactive menu/wiring file only
  - [ ] Dependency guidance emitted by extracted commands references `cd .opencode && npm install`, not `bun install`
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run test -- src/commands` passes for the touched command tests
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run lint && npm run test && npm run build` passes

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Extracted command modules remain callable
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run test -- src/commands
    Expected: Vitest passes for the extracted status/doctor command coverage with no failures
    Evidence: .sisyphus/evidence/task-1-status-doctor-extraction.txt

  Scenario: Dependency guidance uses npm path, not bun
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run test -- src/commands && npm run build
    Expected: Tests assert the warning/fix string references `cd .opencode && npm install`; build succeeds
    Evidence: .sisyphus/evidence/task-1-status-doctor-extraction-error.txt
  ```

  **Commit**: NO | Message: `refactor(ock): extract status and doctor bridge modules` | Files: [`src/commands/menu.ts`, `src/commands/status*.ts`, `src/commands/doctor*.ts`, related tests]

- [ ] 2. Harden OCK init/upgrade bridge canonicalization for exact and versioned plugin entries

  **What to do**: Update OCK init/upgrade bridge scaffolding so both `/work/ock-omo-system/opencodekit-template/src/commands/init/runtime.ts` and `/work/ock-omo-system/opencodekit-template/src/commands/upgrade/bridge.ts` canonicalize legacy plugin entries using the same semantics as OMO’s `/work/ock-omo-system/oh-my-openagent/src/shared/plugin-entry-migrator.ts`. Preserve version suffixes like `@latest`, deduplicate plugin entries, always ensure `oh-my-openagent` is present, and keep `.opencode/oh-my-openagent.jsonc` template-owned and refreshable. Expand OCK regression tests for project-only init, upgrade, exact legacy entries, versioned legacy entries, and prune behavior.
  **Must NOT do**: Do not add runtime config keys to `.opencode/oh-my-openagent.jsonc` beyond the current valid template content. Do not modify global config handling. Do not move bridge-critical behavior into preserved directories.

  **Recommended Agent Profile**:
  - Category: `ultrabrain` - Reason: migration semantics must match OMO behavior exactly and cover edge cases
  - Skills: [] - repository evidence is sufficient
  - Omitted: [`gitnexus-refactoring`] - this is not a symbol-rename/refactor workflow

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [7, 8] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/work/ock-omo-system/opencodekit-template/src/commands/init/runtime.ts:14-72` - current canonicalization only replaces exact legacy plugin strings
  - Pattern: `/work/ock-omo-system/opencodekit-template/src/commands/upgrade/bridge.ts:5-58` - same limitation in upgrade path
  - Pattern: `/work/ock-omo-system/oh-my-openagent/src/shared/plugin-entry-migrator.ts:3-18` - canonical reference for exact + versioned plugin-entry migration
  - Pattern: `/work/ock-omo-system/opencodekit-template/.opencode/oh-my-openagent.jsonc:1-2` - template-owned bridge file contract for this phase
  - Test: `/work/ock-omo-system/opencodekit-template/src/commands/init-upgrade.test.ts:156-267` - existing bridge regression coverage to extend
  - Guardrail: `/work/ock-omo-system/opencodekit-template/src/commands/upgrade/constants.ts:1-15` - preserve-dir behavior means bridge fixes cannot rely on command/skill/tool rewrites

  **Acceptance Criteria** (agent-executable only):
  - [ ] Exact legacy entry `oh-my-opencode` is rewritten to `oh-my-openagent`
  - [ ] Versioned legacy entry such as `oh-my-opencode@latest` is rewritten to `oh-my-openagent@latest`
  - [ ] Duplicate plugin registrations are deduplicated while preserving non-bridge plugin entries
  - [ ] `.opencode/oh-my-openagent.jsonc` is always refreshed from the template on init/upgrade and is not pruned by upgrade cleanup
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run test -- src/commands/init-upgrade.test.ts` passes with new migration cases
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run lint && npm run test && npm run build` passes

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Versioned legacy plugin entry canonicalizes on upgrade
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run test -- src/commands/init-upgrade.test.ts
    Expected: Regression test proves `oh-my-opencode@latest` becomes `oh-my-openagent@latest` while preserving other plugin entries
    Evidence: .sisyphus/evidence/task-2-bridge-canonicalization.txt

  Scenario: Project-only init still refreshes local bridge file
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run test -- src/commands/init-upgrade.test.ts
    Expected: Regression test proves skipped `agent/command/skill/tool` directories do not prevent `.opencode/oh-my-openagent.jsonc` refresh
    Evidence: .sisyphus/evidence/task-2-bridge-canonicalization-error.txt
  ```

  **Commit**: NO | Message: `fix(bridge): canonicalize runtime registration and legacy compatibility` | Files: [`src/commands/init/runtime.ts`, `src/commands/upgrade/bridge.ts`, `src/commands/init-upgrade.test.ts`]

- [ ] 3. Add OMO-owned compatibility for legacy OCK session surfaces

  **What to do**: Extend OMO so legacy OCK-authored `find_sessions` and `read_session({ focus })` usage can continue to function during the bridge window even though OMO remains the only runtime owner. Implement compatibility at the OMO runtime/tool layer, not in OCK distributed plugins, by either aliasing legacy tool names to OMO session-manager behavior or providing a temporary compatibility adapter backed by `/work/ock-omo-system/oh-my-openagent/src/tools/session-manager/`. Preserve current canonical `session_*` tools as the documented winning interface. Compatibility bridges **invocation syntax only**: the output should stay OMO-native, human-readable string output rather than reproducing OCK’s old JSON envelope. Add Bun tests covering legacy-name invocation, `focus` behavior mapping, and coexistence with canonical tools.
  **Must NOT do**: Do not reintroduce SQLite-direct session access in OMO. Do not keep OCK `sessions.ts` as the long-term owner. Do not invent a second session API contract outside the bridge window.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: runtime compatibility change with focused tool-layer tests
  - Skills: [] - direct repo patterns are enough
  - Omitted: [`playwright`] - no browser work required

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [5, 8] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/work/ock-omo-system/oh-my-openagent/src/tools/session-manager/tools.ts:34-157` - canonical session tool surface to preserve
  - Pattern: `/work/ock-omo-system/oh-my-openagent/src/tools/session-manager/storage.ts:44-161` - backend access path already abstracted away from SQLite-only ownership
  - Pattern: `/work/ock-omo-system/oh-my-openagent/src/tools/session-manager/session-formatter.ts:149-199` - search behavior available for implementing `focus` / legacy semantics
  - Legacy behavior: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/sessions.ts:97-428` - exact legacy tool names, parameters, and result shape expectations from OCK
  - Authored dependency: `/work/ock-omo-system/opencodekit-template/.opencode/command/status.md:41-67`
  - Authored dependency: `/work/ock-omo-system/opencodekit-template/.opencode/command/resume.md:49-53`
  - Test: `/work/ock-omo-system/oh-my-openagent/src/tools/session-manager/tools.test.ts:24-136` - existing tool test style to extend

  **Acceptance Criteria** (agent-executable only):
  - [ ] OMO runtime exposes a temporary compatibility path for `find_sessions` and `read_session`
  - [ ] Legacy `read_session({ session_id, focus })` works via OMO-owned behavior without requiring OCK `sessions.ts`
  - [ ] Legacy compatibility returns OMO-native readable output rather than reviving OCK’s direct-SQLite JSON payload contract
  - [ ] Canonical `session_*` tools remain unchanged and documented as preferred
  - [ ] `cd /work/ock-omo-system/oh-my-openagent && bun test src/tools/session-manager/tools.test.ts` passes with legacy compatibility coverage
  - [ ] `cd /work/ock-omo-system/oh-my-openagent && bun run typecheck && bun test && bun run build` passes

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Legacy find/read session calls work via OMO runtime
    Tool: Bash
    Steps: cd /work/ock-omo-system/oh-my-openagent && bun test src/tools/session-manager/tools.test.ts
    Expected: Added tests prove `find_sessions` and `read_session` compatibility succeeds alongside canonical `session_*` tools
    Evidence: .sisyphus/evidence/task-3-session-compatibility.txt

  Scenario: Legacy focus filtering maps correctly without direct SQLite plugin ownership
    Tool: Bash
    Steps: cd /work/ock-omo-system/oh-my-openagent && bun test src/tools/session-manager/tools.test.ts
    Expected: Added tests prove `read_session({ focus })` compatibility path returns filtered results or deterministic compatibility output using OMO-owned code paths
    Evidence: .sisyphus/evidence/task-3-session-compatibility-error.txt
  ```

  **Commit**: NO | Message: `fix(omo): add temporary legacy session compatibility` | Files: [`src/tools/session-manager/*`, tool registry wiring if needed, related tests]

- [ ] 4. Add OMO-owned compatibility for legacy OCK `skill_mcp` usage and deprecations

  **What to do**: Extend OMO’s `skill_mcp` tool so OCK-authored content written against `skill_name=` and optional `list_tools=true` can survive the bridge window while converging on canonical `mcp_name=` semantics. Implement compatibility at OMO’s tool layer by detecting legacy argument shapes, resolving `skill_name` to the correct MCP server when unambiguous, preserving `includeTools` behavior via the skill MCP manager, and surfacing deterministic deprecation messages. Freeze the resolution rules now: (1) if `mcp_name` is provided, it wins; (2) if only `skill_name` is provided and the skill has exactly one MCP server, map to that server; (3) if the skill exposes multiple servers and `mcp_name` is omitted, fail with a deterministic deprecation error telling the caller to supply `mcp_name`; (4) compatibility bridges **invocation syntax only**, so output remains OMO-native rather than reviving OCK’s old JSON wrapper contract. Explicitly do **not** add OMO-native `skill_mcp_status` or `skill_mcp_disconnect`; instead, ensure diagnostics and docs can call them deprecated / unsupported after migration. Add Bun tests covering canonical calls, legacy `skill_name` calls, ambiguous multi-server cases, and deprecation messaging.
  **Must NOT do**: Do not leave two live `skill_mcp` contracts with conflicting schemas. Do not keep OCK `skill-mcp.ts` as a runtime owner after the bridge window. Do not add new persistent status/disconnect tools to OMO.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: nuanced compatibility mapping at the tool/runtime layer
  - Skills: [] - direct code references are enough
  - Omitted: [`gitnexus-impact-analysis`] - not needed for a plan-execution task that already has explicit references

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [6, 8] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/work/ock-omo-system/oh-my-openagent/src/tools/skill-mcp/tools.ts:121-204` - canonical tool implementation to extend
  - Pattern: `/work/ock-omo-system/oh-my-openagent/src/features/skill-mcp-manager/manager.ts:57-103` - canonical manager APIs already support list/call/resource/prompt operations
  - Pattern: `/work/ock-omo-system/oh-my-openagent/src/tools/skill-mcp/tools.test.ts:33-196` - existing canonical test suite to extend
  - Legacy behavior: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/skill-mcp.ts:389-615` - exact legacy args and deprecated status/disconnect tools
  - Legacy docs: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/README.md:53-56`
  - Legacy content samples: `/work/ock-omo-system/opencodekit-template/.opencode/skill/v1-run/SKILL.md:83-140`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/playwright/SKILL.md:258-284`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/figma-go/SKILL.md:42-56`
  - MCP server naming evidence: `/work/ock-omo-system/opencodekit-template/.opencode/skill/playwright/mcp.json:1-16`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/v1-run/mcp.json:1-6`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/chrome-devtools/mcp.json:1-19`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/supabase/mcp.json:1-27`

  **Acceptance Criteria** (agent-executable only):
  - [ ] OMO `skill_mcp` accepts canonical `mcp_name=` calls unchanged
  - [ ] OMO `skill_mcp` supports a temporary legacy `skill_name=` compatibility path when the target MCP server is unambiguous
  - [ ] Ambiguous or unsupported legacy calls return deterministic deprecation/error text instructing callers to use `mcp_name=`
  - [ ] If both `skill_name` and `mcp_name` are present, OMO honors `mcp_name` and ignores `skill_name` for server selection
  - [ ] Compatibility preserves OMO output shape; it does not restore OCK’s old JSON wrapper contract
  - [ ] OMO does not add `skill_mcp_status` or `skill_mcp_disconnect` as canonical runtime tools
  - [ ] `cd /work/ock-omo-system/oh-my-openagent && bun test src/tools/skill-mcp/tools.test.ts src/features/skill-mcp-manager/manager.test.ts` passes
  - [ ] `cd /work/ock-omo-system/oh-my-openagent && bun run typecheck && bun test && bun run build` passes

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Legacy skill_name-based skill_mcp calls remain usable through OMO bridge
    Tool: Bash
    Steps: cd /work/ock-omo-system/oh-my-openagent && bun test src/tools/skill-mcp/tools.test.ts
    Expected: Added tests prove `skill_name=` compatibility resolves the intended MCP server when unambiguous and emits deprecation guidance
    Evidence: .sisyphus/evidence/task-4-skill-mcp-compatibility.txt

  Scenario: Unsupported status/disconnect parity is explicit
    Tool: Bash
    Steps: cd /work/ock-omo-system/oh-my-openagent && bun test src/tools/skill-mcp/tools.test.ts src/features/skill-mcp-manager/manager.test.ts
    Expected: Tests and runtime messages confirm `skill_mcp_status` / `skill_mcp_disconnect` are not canonical OMO tools and are surfaced as deprecated/unsupported through diagnostics instead of silent failure
    Evidence: .sisyphus/evidence/task-4-skill-mcp-compatibility-error.txt
  ```

  **Commit**: NO | Message: `fix(omo): add legacy skill-mcp bridge compatibility` | Files: [`src/tools/skill-mcp/*`, related manager helpers/tests if needed]

- [ ] 5. Migrate distributed OCK session-authored content to OMO `session_*` tools

  **What to do**: Update OCK-authored commands, skills, and AGENTS guidance so newly distributed content targets OMO session semantics instead of legacy OCK session plugin tools. Minimum migration set: `/work/ock-omo-system/opencodekit-template/.opencode/command/status.md`, `/work/ock-omo-system/opencodekit-template/.opencode/command/resume.md`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/context-management/SKILL.md`, and `/work/ock-omo-system/opencodekit-template/.opencode/AGENTS.md`. Replace `find_sessions` / `read_session` examples with `session_list`, `session_read`, `session_search`, and `session_info` as appropriate. Update governance tests or add new validation if needed to keep the distributed authoring corpus from regressing.
  **Must NOT do**: Do not assume preserved project copies of these files are upgraded in-place. Do not remove compatibility in OMO yet. Do not silently keep legacy names in authored examples.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: broad but deterministic template-content migration with governance validation
  - Skills: [] - repo references are sufficient
  - Omitted: [`writing`] - this is behavior-bearing template migration, not prose-only work

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [7, 8] | Blocked By: [3]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `/work/ock-omo-system/opencodekit-template/.opencode/command/status.md:41-90` - current `find_sessions` dependency in distributed `/status`
  - Pattern: `/work/ock-omo-system/opencodekit-template/.opencode/command/resume.md:49-53` - current `find_sessions` dependency in `/resume`
  - Pattern: `/work/ock-omo-system/opencodekit-template/.opencode/skill/context-management/SKILL.md:67-75` and `:330-350` - current session tool guidance to rewrite
  - Pattern: `/work/ock-omo-system/opencodekit-template/.opencode/AGENTS.md:388-396` - global template rules still teach legacy session tools
  - Winning API: `/work/ock-omo-system/oh-my-openagent/src/tools/session-manager/tools.ts:34-157` - canonical session tool names and parameters
  - Validation pattern: `/work/ock-omo-system/opencodekit-template/src/validation/command-doc.test.ts:39-132` - governance-oriented validation style

  **Acceptance Criteria** (agent-executable only):
  - [ ] No live distributed OCK command/skill/AGENTS guidance references `find_sessions` or `read_session`
  - [ ] Distributed `/status` and `/resume` docs target `session_*` tools with valid argument shapes
  - [ ] Context-management and global AGENTS session guidance target OMO `session_*` tools
  - [ ] Governance or regression validation prevents reintroduction of legacy session-tool references in distributed content
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run validate:governance && npm run test` passes
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run lint && npm run test && npm run build` passes

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Distributed authored content is free of legacy session tools
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run validate:governance && npm run test
    Expected: Validation and tests pass with authored content updated to `session_*` references only
    Evidence: .sisyphus/evidence/task-5-session-content-migration.txt

  Scenario: Legacy session references are intentionally blocked from reappearing
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run validate:governance
    Expected: Governance validation fails if `find_sessions` or `read_session` is reintroduced into distributed command/skill guidance
    Evidence: .sisyphus/evidence/task-5-session-content-migration-error.txt
  ```

  **Commit**: NO | Message: `refactor(template): migrate session guidance to omo runtime tools` | Files: [`.opencode/command/status.md`, `.opencode/command/resume.md`, `.opencode/skill/context-management/SKILL.md`, `.opencode/AGENTS.md`, validation/tests if added]

- [ ] 6. Migrate distributed OCK `skill_mcp` docs, examples, and plugin docs to canonical OMO semantics

  **What to do**: Update distributed OCK skill docs and plugin docs so canonical examples use `skill_mcp(mcp_name=...)` rather than `skill_name=...`, and explicitly remove or deprecate references to `skill_mcp_status` and `skill_mcp_disconnect`. Minimum scope includes `/work/ock-omo-system/opencodekit-template/.opencode/plugin/README.md`, and all distributed skills / docs that currently match `skill_mcp(` with `skill_name=` or status/disconnect references. Convert examples using actual server names from each skill’s `mcp.json` or YAML frontmatter. Add governance validation or regression checks that prevent reintroduction of the legacy syntax in distributed content.
  **Must NOT do**: Do not change skill-local MCP metadata formats themselves. Do not keep `skill_mcp_status` / `skill_mcp_disconnect` as normative examples. Do not remove OMO compatibility before authored content migration is complete.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: many distributed skill files with nuanced per-skill MCP naming and documentation consistency concerns
  - Skills: [] - repository content is the source of truth
  - Omitted: [`frontend-ui-ux`] - irrelevant to the migration

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [7, 8] | Blocked By: [4]

  **References** (executor has NO interview context - be exhaustive):
  - Inventory source: grep results across `/work/ock-omo-system/opencodekit-template/.opencode` for `skill_mcp(`, `skill_mcp_status`, and `skill_mcp_disconnect`
  - Plugin docs: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/README.md:53-56`
  - Legacy runtime plugin docs/examples: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/skill-mcp.ts:389-615`
  - Example skill docs using legacy syntax: `/work/ock-omo-system/opencodekit-template/.opencode/skill/v1-run/SKILL.md:83-140`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/playwright/SKILL.md:258-284`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/figma-go/SKILL.md:42-56`
  - MCP server naming evidence: `/work/ock-omo-system/opencodekit-template/.opencode/skill/playwright/mcp.json:1-16`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/v1-run/mcp.json:1-6`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/chrome-devtools/mcp.json:1-19`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/supabase/mcp.json:1-27`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/pencil/SKILL.md:1-9`, `/work/ock-omo-system/opencodekit-template/.opencode/skill/figma-go/SKILL.md:1-8`
  - Winning API: `/work/ock-omo-system/oh-my-openagent/src/tools/skill-mcp/tools.ts:124-203`

  **Acceptance Criteria** (agent-executable only):
  - [ ] Distributed canonical examples use `mcp_name=` and valid server names drawn from each skill’s metadata
  - [ ] No live distributed docs or examples reference `skill_mcp_status` or `skill_mcp_disconnect` except explicit deprecation messaging
  - [ ] Plugin README documents OMO as the runtime owner for skill-MCP lifecycle
  - [ ] Governance or regression validation prevents reintroduction of `skill_name=` canonical examples in distributed content
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run validate:governance && npm run test` passes
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run lint && npm run test && npm run build` passes

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Distributed skill MCP docs use canonical mcp_name-based examples
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run validate:governance && npm run test
    Expected: Validation passes with migrated examples and no unsupported status/disconnect documentation
    Evidence: .sisyphus/evidence/task-6-skill-mcp-doc-migration.txt

  Scenario: Legacy skill_name examples are intentionally blocked from reappearing
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run validate:governance
    Expected: Governance validation fails if `skill_mcp(skill_name=...)` or `skill_mcp_status` / `skill_mcp_disconnect` are reintroduced into distributed content
    Evidence: .sisyphus/evidence/task-6-skill-mcp-doc-migration-error.txt
  ```

  **Commit**: NO | Message: `refactor(template): migrate skill-mcp docs to canonical omo semantics` | Files: [`.opencode/plugin/README.md`, distributed skill docs, validation/tests if added]

- [ ] 7. Add unified bridge diagnostics to `ock status`, `ock doctor`, and distributed `/status`

  **What to do**: Implement the bridge diagnostics contract after Tasks 1, 2, 5, and 6 land. `ock doctor` must detect and report: missing canonical plugin registration, versioned legacy plugin entries before/after migration, dual-basename coexistence (`oh-my-openagent.*` and `oh-my-opencode.*` both present), stale dependency guidance, and preserved authored-content drift (legacy `find_sessions`, `read_session`, `skill_mcp(skill_name=...)`, `skill_mcp_status`, `skill_mcp_disconnect` still present in project-local preserved content). Freeze the exit-code contract now: `0` = healthy/no warnings, `2` = warning/drift but project still runnable, `1` = hard error/missing required bridge state. Freeze the required strings now:
  - `BRIDGE OK: canonical OMO runtime registration detected`
  - `BRIDGE WARNING: both canonical and legacy runtime config basenames exist; OMO currently loads canonical first`
  - `BRIDGE WARNING: preserved project content still references legacy runtime surfaces`
  - `BRIDGE ERROR: canonical plugin entry "oh-my-openagent" missing from .opencode/opencode.json`
  `ock status` must always exit `0`, display `Bridge Health: OK|WARN|ERROR`, and expose concise bridge health at the CLI surface. Distributed `/status` must consume OMO `session_*` tools and avoid claiming health through legacy surfaces. Add deterministic exit-code/string coverage.
  **Must NOT do**: Do not turn diagnostics into a full generic CLI overhaul. Do not inspect or mutate global config. Do not hide drift; warnings must be explicit and machine-verifiable.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-cutting CLI/runtime diagnostics with deterministic tests
  - Skills: [] - repo references are enough
  - Omitted: [`review-work`] - final review belongs to the plan’s final verification wave, not this task

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [8] | Blocked By: [1, 2, 5, 6]

  **References** (executor has NO interview context - be exhaustive):
  - Current CLI logic: `/work/ock-omo-system/opencodekit-template/src/commands/menu.ts:105-549` - source behavior that will exist in extracted modules after Task 1
  - Bridge canonicalization: `/work/ock-omo-system/opencodekit-template/src/commands/init/runtime.ts:46-72`, `/work/ock-omo-system/opencodekit-template/src/commands/upgrade/bridge.ts:28-58`
  - Dual-basename runtime truth: `/work/ock-omo-system/oh-my-openagent/src/shared/jsonc-parser.ts:78-98`, `/work/ock-omo-system/oh-my-openagent/docs/reference/configuration.md:56`, `/work/ock-omo-system/oh-my-openagent/docs/reference/cli.md:234`
  - Winning plugin identity: `/work/ock-omo-system/oh-my-openagent/src/shared/plugin-identity.ts:1-4`
  - Distributed `/status`: `/work/ock-omo-system/opencodekit-template/.opencode/command/status.md:1-117`
  - Preservation constraints: `/work/ock-omo-system/opencodekit-template/src/commands/upgrade/constants.ts:1-15`

  **Acceptance Criteria** (agent-executable only):
  - [ ] `ock doctor` emits deterministic warnings/errors for dual basenames, missing canonical plugin registration, and preserved authored-content drift
  - [ ] `ock doctor` exit codes follow the frozen contract: `0` healthy, `2` warning/drift, `1` hard error
  - [ ] `ock status` always exits `0` and shows `Bridge Health: OK|WARN|ERROR` without requiring manual interpretation
  - [ ] Distributed `/status` uses OMO `session_*` semantics and no longer references legacy session plugin tools
  - [ ] Exact assertions exist for the frozen `BRIDGE OK`, `BRIDGE WARNING`, and `BRIDGE ERROR` strings and their exit codes in new/updated tests
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run test` passes with the new diagnostics coverage
  - [ ] `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run lint && npm run test && npm run build` passes

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Dual-basename coexistence is diagnosed deterministically
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run test
    Expected: Tests assert exact warning/error strings and exit-code behavior when both `.opencode/oh-my-openagent.jsonc` and `.opencode/oh-my-opencode.jsonc` exist
    Evidence: .sisyphus/evidence/task-7-bridge-diagnostics.txt

  Scenario: Preserved legacy-authored content drift is surfaced
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run test
    Expected: Tests prove `ock doctor` or `ock status` emits deterministic bridge-drift warnings when preserved project content still references legacy session or `skill_mcp` surfaces
    Evidence: .sisyphus/evidence/task-7-bridge-diagnostics-error.txt
  ```

  **Commit**: NO | Message: `feat(ock): add unified bridge diagnostics` | Files: [`src/commands/status*.ts`, `src/commands/doctor*.ts`, `.opencode/command/status.md`, related tests]

- [ ] 8. Remove duplicate OCK runtime plugins and seal the bridge with cross-repo regression coverage

  **What to do**: After compatibility, content migration, and diagnostics are all in place, remove `/work/ock-omo-system/opencodekit-template/.opencode/plugin/sessions.ts` and `/work/ock-omo-system/opencodekit-template/.opencode/plugin/skill-mcp.ts` from the distributed template, update plugin docs/build expectations, and add final regression coverage proving a fresh/init/upgrade-generated project still works with OMO-owned runtime behavior only. Ensure built template output no longer includes those runtime plugins. Verify OCK and OMO full validation commands. If any project-local preserved authored content still references legacy surfaces, diagnostics must continue to warn rather than silently break.
  **Must NOT do**: Do not remove OMO compatibility adapters in the same task. Do not leave plugin docs stale. Do not forget to verify built `dist/template/.opencode/` output.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: coordinated cleanup plus cross-repo validation
  - Skills: [] - direct evidence and existing tests are sufficient
  - Omitted: [`git-master`] - commits are still not authorized

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [F1-F4] | Blocked By: [3, 4, 5, 6, 7]

  **References** (executor has NO interview context - be exhaustive):
  - Plugin files to remove: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/sessions.ts`, `/work/ock-omo-system/opencodekit-template/.opencode/plugin/skill-mcp.ts`
  - Plugin docs to update: `/work/ock-omo-system/opencodekit-template/.opencode/plugin/README.md:5-72`
  - Build copies template payload: `/work/ock-omo-system/opencodekit-template/package.json:35-48`
  - OCK bridge regressions: `/work/ock-omo-system/opencodekit-template/src/commands/init-upgrade.test.ts:156-267`
  - OMO compatibility surfaces added in Tasks 3 and 4
  - OMO full verification command: `/work/ock-omo-system/oh-my-openagent/package.json:23-35`

  **Acceptance Criteria** (agent-executable only):
  - [ ] `.opencode/plugin/sessions.ts` and `.opencode/plugin/skill-mcp.ts` are removed from OCK source template and absent from built `dist/template/.opencode/plugin/`
  - [ ] Plugin README no longer documents those files as active runtime owners
  - [ ] Fresh init / project-only init / upgrade flows remain functional through OMO-owned runtime behavior only
  - [ ] OCK full verification passes: `cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run lint && npm run test && npm run build`
  - [ ] OMO full verification passes: `cd /work/ock-omo-system/oh-my-openagent && bun run typecheck && bun test && bun run build`
  - [ ] Diagnostics still surface preserved legacy-authored drift instead of silent failure after plugin removal

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Duplicate runtime plugins are gone from source and built template output
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run build && test ! -f .opencode/plugin/sessions.ts && test ! -f .opencode/plugin/skill-mcp.ts && test ! -f dist/template/.opencode/plugin/sessions.ts && test ! -f dist/template/.opencode/plugin/skill-mcp.ts
    Expected: All file assertions pass and build succeeds
    Evidence: .sisyphus/evidence/task-8-plugin-removal.txt

  Scenario: Cross-repo bridge still works after plugin removal
    Tool: Bash
    Steps: cd /work/ock-omo-system/opencodekit-template && npm run typecheck && npm run lint && npm run test && npm run build && cd /work/ock-omo-system/oh-my-openagent && bun run typecheck && bun test && bun run build
    Expected: Both repos pass their full verification commands with OMO-owned compatibility still covering legacy preserved project content during the bridge window
    Evidence: .sisyphus/evidence/task-8-plugin-removal-error.txt
  ```

  **Commit**: NO | Message: `chore(bridge): remove duplicate ock runtime plugins` | Files: [`.opencode/plugin/sessions.ts`, `.opencode/plugin/skill-mcp.ts`, `.opencode/plugin/README.md`, build/test files]

## Final Verification Wave (MANDATORY — after ALL implementation tasks)
> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.
> **Do NOT auto-proceed after verification. Wait for user's explicit approval before marking work complete.**
> **Never mark F1-F4 as checked before getting user's okay.** Rejection or user feedback -> fix -> re-run -> present again -> wait for okay.
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Default execution mode is **no auto-commit**. The user has not authorized commits yet.
- Executors should prepare atomic commit boundaries that align to Wave 1 foundation, Wave 2 migration/diagnostics, and Wave 3 plugin removal, but only create commits if the user explicitly requests them during execution.
- If commit authorization is granted later, use prepared commit themes in this order:
  1. `refactor(ock): extract status and doctor bridge modules`
  2. `fix(bridge): canonicalize runtime registration and legacy compatibility`
  3. `refactor(template): migrate distributed content to omo runtime surfaces`
  4. `chore(bridge): remove duplicate ock runtime plugins`

## Success Criteria
- The unified product can be described simply and truthfully: `ock` installs and upgrades the project, OMO owns runtime behavior, and no duplicate OCK runtime plugin remains necessary for session browsing or skill-MCP execution.
- Old projects upgrade predictably without touching global config and without relying on preserved authoring directories to receive bridge-critical fixes.
- Diagnostics tell the truth about bridge state instead of only counting files.
- Regression coverage proves exact legacy-entry migration, dual-basename handling, preserved-content drift warnings, and post-removal runtime compatibility.
