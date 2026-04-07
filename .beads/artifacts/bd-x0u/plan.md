# OCK Bead-First OMO Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `skill({ name: "executing-plans" })` to implement this plan task-by-task.

**Goal:** When `oh-my-opencode` runs inside an OCK bead-first repo, repo-local `.opencode` workflow surfaces stay authoritative and OMO does not activate competing plugin-owned workflow or durable task behavior.

**Architecture:** Add one small shared detector for “OCK bead-first repo” and thread that signal into the two real conflict seams: command merge policy and optional task-system activation. Keep existing `.opencode` command and skill discovery intact. Avoid invasive persistence rewrites by suppressing OMO’s task-system path in OCK repos instead of trying to reimplement beads inside OMO.

**Tech Stack:** Bun, TypeScript, OpenCode plugin config pipeline, `.opencode` command/skill discovery, optional OMO task system

---

## Must-Haves

**Goal:** Local OMO source honors the root OCK bead-first contract without drifting into plugin-owned `.sisyphus` workflow or plugin-owned durable task state.

### Observable Truths

1. In an OCK bead-first repo, OMO does not expose competing plugin workflow commands that drive `.sisyphus` loops.
2. In an OCK bead-first repo, enabling `experimental.task_system` does not register plugin `task_*` tools or deny `TodoWrite` and `TodoRead`.
3. In an OCK bead-first repo, repo-local `.opencode/command*` and `.opencode/skill*` discovery still works as before.
4. In a non-OCK repo, existing OMO command loading and task-system behavior are unchanged.
5. The behavior is determined from the current project directory, not from hardcoded machine-specific paths.

### Required Artifacts

| Artifact               | Provides                                      | Path                                                                          |
| ---------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| bead-first detector    | Repo-mode decision point                      | `/root/.config/opencode/omo/src/shared/ock-bead-first-project.ts`               |
| detector tests         | Regression-proof repo detection               | `/root/.config/opencode/omo/src/shared/ock-bead-first-project.test.ts`          |
| shared export          | Reusable import surface                       | `/root/.config/opencode/omo/src/shared/index.ts`                                |
| command merge policy   | Suppresses conflicting builtins in OCK repos  | `/root/.config/opencode/omo/src/plugin-handlers/command-config-handler.ts`      |
| command merge tests    | Proves suppression is scoped to OCK repos     | `/root/.config/opencode/omo/src/plugin-handlers/command-config-handler.test.ts` |
| tool registration gate | Prevents `task_*` registration in OCK repos   | `/root/.config/opencode/omo/src/plugin/tool-registry.ts`                        |
| permission gate        | Prevents todo denial in OCK repos             | `/root/.config/opencode/omo/src/plugin-handlers/tool-config-handler.ts`         |
| hook gate              | Prevents TodoWrite-disabler hook in OCK repos | `/root/.config/opencode/omo/src/plugin/hooks/create-tool-guard-hooks.ts`        |

### Key Links

| From                | To                       | Via                    | Risk                                       |
| ------------------- | ------------------------ | ---------------------- | ------------------------------------------ |
| repo root detection | command namespace        | `applyCommandConfig()` | wrong detection leaks conflicting builtins |
| repo root detection | task tool registration   | `createToolRegistry()` | OMO task tools still appear in OCK repos   |
| repo root detection | todo permissions         | `applyToolConfig()`    | TodoWrite incorrectly denied in OCK repos  |
| repo root detection | tool guard hook creation | `createToolGuardHooks()` | hidden TodoWrite blocker remains active    |

## Dependency Graph

```text
Task A: needs nothing, creates shared OCK bead-first detector
Task B: needs Task A, creates command suppression in OCK repos
Task C: needs Task A, creates task-system suppression in OCK repos

Wave 1: Task A
Wave 2: Task B, Task C
```

## Tasks

### Task 1: Add OCK Bead-First Project Detector

**Files:**
Create: `/root/.config/opencode/omo/src/shared/ock-bead-first-project.ts`  
Create: `/root/.config/opencode/omo/src/shared/ock-bead-first-project.test.ts`  
Modify: `/root/.config/opencode/omo/src/shared/index.ts`

**Intent:** centralize the repo-mode decision so command suppression and task-system suppression use one exact rule.

#### Step 1: Write the failing detector tests

Add a new test file with these cases:

```ts
import { describe, expect, it } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { isOckBeadFirstProject } from "./ock-bead-first-project"

describe("isOckBeadFirstProject", () => {
  it("returns true when nearest ancestor has .beads and OCK workflow commands", () => {})
  it("returns false when only .opencode exists", () => {})
  it("returns false when only .beads exists", () => {})
  it("uses nearest matching ancestor inside nested directories", () => {})
})
```

Use concrete fixtures:
- positive fixture: `.beads/`, `.opencode/command/create.md`, `.opencode/command/research.md`, `.opencode/command/start.md`, `.opencode/command/plan.md`, `.opencode/command/ship.md`
- negative fixture A: `.opencode/command/create.md` only
- negative fixture B: `.beads/` only

#### Step 2: Run the targeted test to verify it fails

Run:

```bash
bun test /root/.config/opencode/omo/src/shared/ock-bead-first-project.test.ts
```

Expected:
- fail with module not found or missing export

#### Step 3: Implement the minimal detector

Create `ock-bead-first-project.ts` with a tight API:

```ts
export function isOckBeadFirstProject(startDirectory: string): boolean
```

Implementation constraints:
- reuse `findProjectOpencodeCommandDirs(startDirectory)` from `src/shared/project-discovery-dirs.ts`
- derive project root from each candidate command dir by stripping `/.opencode/{command|commands}`
- require both:
  - `join(projectRoot, ".beads")` exists
  - at least one command dir under that root contains the canonical OCK workflow command set marker
- keep the marker rule strict enough to avoid false positives:
  - require `create.md`
  - require at least 3 of `research.md`, `start.md`, `plan.md`, `ship.md`, `pr.md`

Keep the file small and pure. No logging.

#### Step 4: Export it through the shared barrel

Modify `src/shared/index.ts`:

```ts
export * from "./ock-bead-first-project"
```

#### Step 5: Re-run the targeted test

Run:

```bash
bun test /root/.config/opencode/omo/src/shared/ock-bead-first-project.test.ts
```

Expected:
- all tests pass

### Task 2: Suppress Conflicting Builtin Workflow Commands In OCK Repos

**Files:**
Modify: `/root/.config/opencode/omo/src/plugin-handlers/command-config-handler.ts`  
Modify: `/root/.config/opencode/omo/src/plugin-handlers/command-config-handler.test.ts`

**Intent:** keep existing command and skill discovery untouched, but stop OMO from injecting parallel `.sisyphus` workflow commands when OCK is the repo contract.

#### Step 1: Add failing command-merge tests

Extend `command-config-handler.test.ts` with two tests:

```ts
test("omits conflicting builtin workflow commands in OCK bead-first repos", async () => {})
test("keeps builtin workflow commands in non-OCK repos", async () => {})
```

For the positive OCK test:
- create a temp directory with `.beads/` and `.opencode/command/create.md`
- mock `loadBuiltinCommands()` to return:
  - `start-work`
  - `ralph-loop`
  - `ulw-loop`
  - `cancel-ralph`
  - `stop-continuation`
  - `refactor`
- call `applyCommandConfig({ ctx: { directory: tempDir }, ... })`
- assert absent:
  - `start-work`
  - `ralph-loop`
  - `ulw-loop`
  - `cancel-ralph`
  - `stop-continuation`
- assert present:
  - `refactor`

For the non-OCK test:
- use a temp dir without `.beads`
- assert all mocked builtins remain

#### Step 2: Run the targeted test to verify it fails

Run:

```bash
bun test /root/.config/opencode/omo/src/plugin-handlers/command-config-handler.test.ts
```

Expected:
- new OCK-scoped assertions fail because all builtins still merge

#### Step 3: Implement builtin filtering at the merge seam

In `command-config-handler.ts`:
- import `isOckBeadFirstProject`
- add a local constant:

```ts
const OCK_CONFLICTING_BUILTIN_COMMANDS = new Set([
  "start-work",
  "ralph-loop",
  "ulw-loop",
  "cancel-ralph",
  "stop-continuation",
])
```

- add a small helper:

```ts
function filterBuiltinCommandsForOckRepo(
  commands: Record<string, unknown>,
  beadFirstProject: boolean,
): Record<string, unknown>
```

- compute:

```ts
const beadFirstProject = isOckBeadFirstProject(params.ctx.directory)
const builtinCommands = filterBuiltinCommandsForOckRepo(
  loadBuiltinCommands(...),
  beadFirstProject,
)
```

Do not change merge order for:
- project `.opencode` commands
- project `.opencode` skills
- `.claude` / `.agents` compatibility
- plugin component commands

#### Step 4: Re-run targeted tests

Run:

```bash
bun test /root/.config/opencode/omo/src/plugin-handlers/command-config-handler.test.ts
```

Expected:
- old tests still pass
- new OCK and non-OCK tests pass

#### Step 5: Run adjacent command-discovery regressions

Run:

```bash
bun test \
  /root/.config/opencode/omo/src/features/claude-code-command-loader/loader.test.ts \
  /root/.config/opencode/omo/src/features/opencode-skill-loader/project-skill-discovery.test.ts
```

Expected:
- all pass
- proves repo-local `.opencode` loading was not disturbed

### Task 3: Suppress OMO Task-System Activation In OCK Repos

**Files:**
Modify: `/root/.config/opencode/omo/src/plugin/tool-registry.ts`  
Modify: `/root/.config/opencode/omo/src/plugin/tool-registry.test.ts`  
Modify: `/root/.config/opencode/omo/src/plugin-handlers/tool-config-handler.ts`  
Modify: `/root/.config/opencode/omo/src/plugin-handlers/tool-config-handler.test.ts`  
Modify: `/root/.config/opencode/omo/src/plugin-handlers/config-handler.ts`  
Modify: `/root/.config/opencode/omo/src/plugin/hooks/create-tool-guard-hooks.ts`  
Create: `/root/.config/opencode/omo/src/plugin/hooks/create-tool-guard-hooks.test.ts`

**Intent:** in OCK repos, OMO must not own durable task workflow, even if `experimental.task_system` is enabled in plugin config.

#### Step 1: Add failing tool-registry test

Extend `tool-registry.test.ts`:

```ts
test("#when task_system is enabled in an OCK repo #then task tools are not registered", () => {})
```

Use a temp directory containing `.beads/` and `.opencode/command/create.md`, pass it as `ctx.directory`, and set:

```ts
pluginConfig: { experimental: { task_system: true } }
```

Assert:
- `taskSystemEnabled === false`
- no `task_create`
- no `task_get`
- no `task_list`
- no `task_update`

#### Step 2: Add failing permission test

Extend `tool-config-handler.test.ts` so `createParams()` can accept `directory`.

Add test:

```ts
it("does not deny todo tools in OCK repos even when task_system is enabled", () => {})
```

Assert:
- global `tools.todowrite` and `tools.todoread` stay `undefined`
- agent permissions for `atlas`, `sisyphus`, `hephaestus`, `prometheus`, `sisyphus-junior` do not get `todowrite: "deny"` or `todoread: "deny"`

#### Step 3: Add failing hook-creation test

Create `create-tool-guard-hooks.test.ts` with:

```ts
import { describe, expect, it } from "bun:test"
import { createToolGuardHooks } from "./create-tool-guard-hooks"

describe("createToolGuardHooks", () => {
  it("does not create tasksTodowriteDisabler in OCK repos", () => {})
  it("still creates tasksTodowriteDisabler in non-OCK repos when task_system is enabled", () => {})
})
```

Assert:
- in OCK temp repo, `hooks.tasksTodowriteDisabler === null`
- in non-OCK temp repo, `hooks.tasksTodowriteDisabler !== null`

#### Step 4: Run targeted tests to verify they fail

Run:

```bash
bun test \
  /root/.config/opencode/omo/src/plugin/tool-registry.test.ts \
  /root/.config/opencode/omo/src/plugin-handlers/tool-config-handler.test.ts \
  /root/.config/opencode/omo/src/plugin/hooks/create-tool-guard-hooks.test.ts
```

Expected:
- all new OCK-mode assertions fail before implementation

#### Step 5: Implement task-system suppression at the real integration points

In `src/plugin/tool-registry.ts`:
- import `isOckBeadFirstProject`
- change:

```ts
const taskSystemEnabled = isTaskSystemEnabled(pluginConfig)
```

to:

```ts
const beadFirstProject = isOckBeadFirstProject(ctx.directory)
const taskSystemEnabled = !beadFirstProject && isTaskSystemEnabled(pluginConfig)
```

In `src/plugin-handlers/tool-config-handler.ts`:
- add `directory: string` to `applyToolConfig` params
- compute the same `beadFirstProject` gate
- preserve existing behavior outside OCK repos

In `src/plugin-handlers/config-handler.ts`:
- pass `directory: ctx.directory` into `applyToolConfig(...)`

In `src/plugin/hooks/create-tool-guard-hooks.ts`:
- import `isOckBeadFirstProject`
- compute `beadFirstProject` once
- only create `tasksTodowriteDisabler` when:
  - hook is enabled
  - `!beadFirstProject`

Do not change:
- `src/features/claude-tasks/storage.ts`
- `src/features/claude-tasks/session-storage.ts`

That is deliberate. This plan disables the competing task system instead of redirecting OMO persistence into `.beads`.

#### Step 6: Re-run targeted tests

Run:

```bash
bun test \
  /root/.config/opencode/omo/src/plugin/tool-registry.test.ts \
  /root/.config/opencode/omo/src/plugin-handlers/tool-config-handler.test.ts \
  /root/.config/opencode/omo/src/plugin/hooks/create-tool-guard-hooks.test.ts
```

Expected:
- all targeted tests pass

#### Step 7: Run adjacent unchanged-behavior tests

Run:

```bash
bun test \
  /root/.config/opencode/omo/src/hooks/tasks-todowrite-disabler/hook.test.ts \
  /root/.config/opencode/omo/src/features/claude-tasks/storage.test.ts \
  /root/.config/opencode/omo/src/features/claude-tasks/session-storage.test.ts
```

Expected:
- all pass
- confirms the existing hook and task storage behavior remains valid outside the new OCK-mode gate

## Verification

Run the focused regression suite:

```bash
bun test \
  /root/.config/opencode/omo/src/shared/ock-bead-first-project.test.ts \
  /root/.config/opencode/omo/src/plugin-handlers/command-config-handler.test.ts \
  /root/.config/opencode/omo/src/plugin/tool-registry.test.ts \
  /root/.config/opencode/omo/src/plugin-handlers/tool-config-handler.test.ts \
  /root/.config/opencode/omo/src/plugin/hooks/create-tool-guard-hooks.test.ts \
  /root/.config/opencode/omo/src/features/claude-code-command-loader/loader.test.ts \
  /root/.config/opencode/omo/src/features/opencode-skill-loader/project-skill-discovery.test.ts \
  /root/.config/opencode/omo/src/features/claude-tasks/storage.test.ts \
  /root/.config/opencode/omo/src/features/claude-tasks/session-storage.test.ts \
  /root/.config/opencode/omo/src/hooks/tasks-todowrite-disabler/hook.test.ts
```

Expected:
- all tests pass

Run typecheck:

```bash
bun run typecheck
```

Expected:
- no type errors

Optional broader confidence pass:

```bash
bun test
```

Expected:
- full suite passes or any unrelated failures are pre-existing and documented before merge

## Notes

1. This plan intentionally does not rewrite `.sisyphus` storage.
2. The minimal boundary is “detect OCK repo, suppress competing OMO ownership.”
3. `task-reminder` is not part of the active hook composition, so no work is planned there.
4. Background child-session directory resolution already has a focused test and does not need code changes for this adapter.
