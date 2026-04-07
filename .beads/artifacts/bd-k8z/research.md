# Research: bd-k8z - Command authority audit

**Date:** 2026-04-07  
**Depth:** Moderate  
**Tool Calls:** 29  
**Confidence:** High

**Artifact role:** This is a narrow bead-scoped command-authority audit derived from the completed Phase 1 research package, especially `.beads/artifacts/bd-l1s/research.md`. It is not itself the broad Phase 1 comparative-research package and it is not a Phase 3 implementation plan. Its role is to carry one specific command-surface seam forward from that completed Phase 1 basis into later Phase 3 work, specifically around command-surface authority, precedence, and duplicate-entry risk.

---

## Questions Asked

1. Where is runtime command execution precedence assembled?
2. Where is visible slash-command discovery and ordering assembled?
3. Can visible command precedence diverge from actual execution precedence?
4. Which commands currently act as primary workflow roots vs support vs compatibility/adapters?
5. What is the actual end-to-end slash-command execution path from user input to replacement/execution?
6. Which workflow command names currently collide across source tiers in this repo, and which source wins in discovery vs runtime?

---

## Answer Status

| Question                                                 | Status   | Confidence |
| -------------------------------------------------------- | -------- | ---------- |
| Runtime execution precedence assembly                    | Answered | High       |
| Visible slash discovery and ordering                     | Answered | High       |
| Divergence risk between visible and runtime authority    | Answered | High       |
| Workflow-root vs support vs compatibility classification | Answered | High       |
| End-to-end slash-command execution path                  | Answered | High       |
| Workflow command collision matrix for this repo          | Answered | High       |

---

## Key Findings

This audit should be read on top of the completed Phase 1 outputs rather than as a detached standalone memo. In particular, `bd-l1s` already established the broader overlap/collision map, OCK and OMO capability audits, preserved strengths, candidate ownership matrix, and command/runtime follow-through notes. `bd-k8z` does not reopen or replace that package; it tightens the command-authority slice that later enforcement still depends on.

### 1) Runtime command execution precedence is assembled in `applyCommandConfig()`

**Primary file:** `omo/src/plugin-handlers/command-config-handler.ts`

`applyCommandConfig()` builds `params.config.command` by object spread, so later sources win on name collisions. The current merge order is:

1. `loadBuiltinCommands(...)`
2. `skillsToCommandDefinitionRecord(configSourceSkills)`
3. `loadUserCommands()`
4. `loadUserSkills()`
5. `loadGlobalAgentsSkills()`
6. `loadOpencodeGlobalCommands()`
7. `loadOpencodeGlobalSkills()`
8. existing `systemCommands`
9. `loadProjectCommands()`
10. `loadProjectSkills()`
11. `loadProjectAgentsSkills()`
12. `loadOpencodeProjectCommands()`
13. `loadOpencodeProjectSkills()`
14. `pluginComponents.commands`
15. `pluginComponents.skills`

**Implications:**

- Runtime authority is **last-write-wins**.
- Repo-local `.opencode` project commands override `.claude` project commands.
- Plugin commands and plugin skill-derived commands currently have the **strongest runtime execution authority** because they are merged last.

**Evidence:**

- `omo/src/plugin-handlers/command-config-handler.ts:27-93`

### 2) Visible slash-command discovery is assembled separately in `discoverCommandsSync()`

**Primary file:** `omo/src/tools/slashcommand/command-discovery.ts`

Visible command discovery is built from a different pipeline than runtime config assembly. `discoverCommandsSync()` gathers commands from:

- `.claude/commands` under the current project
- user Claude config commands
- ancestor repo-local `.opencode/command` and `.opencode/commands`
- global OpenCode command dirs
- builtin OMO commands
- plugin commands/skills surfaced through plugin discovery

Conflict resolution is then handled by `resolveCommandConflicts()`, and display ordering is handled by `prioritizeCommands()`.

**Default visible scope priority:**
`project > config > user > opencode-project > opencode > builtin > plugin`

**OCK bead-first visible scope priority for workflow-classified names:**
`opencode-project > project > config > user > opencode > builtin > plugin`

**Evidence:**

- `omo/src/tools/slashcommand/command-discovery.ts:82-142`
- `omo/src/tools/slashcommand/command-discovery.ts:232-320`
- `omo/src/shared/project-discovery-dirs.ts:92-101`
- `omo/src/shared/ock-bead-first-project.ts:32-54`

### 3) Visibility and execution precedence can diverge today

The codebase currently has **two authority layers**:

- **Runtime execution authority** from `applyCommandConfig()`
- **Visible slash discovery authority** from `discoverCommandsSync()` + `resolveCommandConflicts()` + `prioritizeCommands()`

These layers do **not** use the same source sets or the same precedence rules.

#### Concrete divergence cases

1. **Plugin commands**
   - Visible discovery ranks plugins lowest.
   - Runtime merge lets plugins override last.
   - Result: a command surfaced as project/builtin in lists can still be overridden by a plugin at execution time.

2. **User vs global OpenCode commands**
   - Visible discovery prefers `user` over `opencode`.
   - Runtime merge loads OpenCode global commands after user commands.
   - Result: visibility and execution can disagree.

3. **Skill-derived commands**
   - Runtime `config.command` includes many skill-derived commands.
   - Visible slash discovery does not mirror the full runtime skill merge path.
   - Auto-slash execution works around this by prepending discovered skills in `discoverAllCommands()` before reusing command discovery logic.
   - Result: slash execution, slash visibility, and runtime config are not one unified authority path.

**Evidence:**

- `omo/src/plugin-handlers/command-config-handler.ts:75-90`
- `omo/src/tools/slashcommand/command-discovery.ts:82-100`
- `omo/src/shared/plugin-command-discovery.ts:13-27`
- `omo/src/hooks/auto-slash-command/executor.ts:60-83`
- Prior research memory: observation `#128`

### 4) The codebase already classifies workflow roots, support commands, and compatibility commands

`command-discovery.ts` explicitly groups commands by name:

- **Primary workflow:** `create`, `start`, `plan`, `ship`, `pr`
- **Support:** `verify`, `status`, `resume`, `handoff`, `research`
- **Compatibility:** `lfg`, `compound`

`prioritizeCommands()` then sorts primary first, support second, other third, and compatibility last.

**Evidence:**

- `omo/src/tools/slashcommand/command-discovery.ts:25-80`

### 5) Repo-local `.opencode/command` docs match the chartered workflow classification

The root repo contains these relevant repo-local commands:

**Primary lifecycle roots**

- `.opencode/command/create.md`
- `.opencode/command/start.md`
- `.opencode/command/plan.md`
- `.opencode/command/ship.md`
- `.opencode/command/pr.md`

**Support**

- `.opencode/command/verify.md`
- `.opencode/command/status.md`
- `.opencode/command/resume.md`
- `.opencode/command/handoff.md`
- `.opencode/command/research.md`

**Compatibility / adapter surfaces**

- `.opencode/command/lfg.md`
- `.opencode/command/compound.md`

The docs themselves reinforce the intended role split:

- `/create` says the workflow is `/create -> /start <id> -> /ship <id>`.
- `/ship` says it is the main delivery step and requires verification/review gates.
- `/verify` is framed as checking implementation before shipping.
- `/lfg` explicitly chains plan + ship + review + compound.
- `/compound` frames itself as post-completion learning capture.

**Evidence:**

- `.opencode/command/create.md:9-20`
- `.opencode/command/ship.md:9-20`
- `.opencode/command/verify.md:9-16`
- `.opencode/command/lfg.md:9-18`
- `.opencode/command/compound.md:9-18`

### 6) OCK bead-first prioritization is detected by real project markers, not just config

`isOckBeadFirstProject()` checks for:

- presence of `.beads`
- presence of repo-local `.opencode/command` dirs
- presence of canonical workflow markers such as `create.md` plus at least 3 of `research.md`, `start.md`, `plan.md`, `ship.md`, `pr.md`

This means OCK bead-first prioritization is currently a **heuristic based on durable project structure**, not just a user setting.

**Evidence:**

- `omo/src/shared/ock-bead-first-project.ts:5-54`

### 7) Tests verify important discovery behavior, but they do not eliminate the authority split

Relevant tests confirm:

- ancestor `.opencode` command discovery stays within the git worktree boundary
- nested `.opencode` commands become slash-separated names
- slash execution can load commands from project/opencode sources using the provided directory

These tests increase confidence in command discovery behavior, but they do not collapse visibility and runtime execution into a single authority path.

**Evidence:**

- `omo/src/tools/slashcommand/opencode-project-command-discovery.test.ts:23-61`
- `omo/src/tools/slashcommand/execution-compatibility.test.ts:31-90`

### 8) Slash-command execution uses the discovery pipeline, not `config.command`

The slash-command path is now traced end-to-end.

**Chat-time path**

- `omo/src/plugin-interface.ts` wires `chat.message` to `createChatMessageHandler(...)`
- `omo/src/plugin/chat-message.ts` invokes `hooks.autoSlashCommand?.["chat.message"]?.(...)`
- `omo/src/hooks/auto-slash-command/hook.ts` parses slash input with `detectSlashCommand(...)`
- `omo/src/hooks/auto-slash-command/executor.ts` calls `executeSlashCommand(...)`
- `executeSlashCommand()` re-discovers commands through `discoverCommandsSync(...)`, re-applies `resolveCommandConflicts(...)` and `prioritizeCommands(...)`, then formats and injects replacement text into the chat prompt

**Command-execute fallback path**

- `omo/src/plugin-interface.ts` also wires `command.execute.before`
- `omo/src/plugin/command-execute-before.ts` invokes the auto-slash command hook again before execution
- `omo/src/hooks/auto-slash-command/hook.ts` reconstructs a slash-shaped command from `input.command` and `input.arguments`
- It still resolves via `executeSlashCommand(...)`, which uses discovery plus skill collection, not `config.command`

**Important implication:**

- Slash resolution is currently a **template/discovery authority path**.
- Runtime registration in `applyCommandConfig()` is a **separate command-config authority path**.
- I found no code in this repo proving that `executeSlashCommand()` consults `config.command`.

**Evidence:**

- `omo/src/plugin-interface.ts`
- `omo/src/plugin/chat-message.ts`
- `omo/src/plugin/command-execute-before.ts`
- `omo/src/hooks/auto-slash-command/hook.ts`
- `omo/src/hooks/auto-slash-command/executor.ts`

### 9) Current bare workflow authority in this checkout is the repo-local `.opencode/command` set

For the target workflow names, current active bare command definitions in this repo live under the root repo-local OpenCode command directory:

- `.opencode/command/create.md`
- `.opencode/command/start.md`
- `.opencode/command/plan.md`
- `.opencode/command/ship.md`
- `.opencode/command/pr.md`
- `.opencode/command/verify.md`
- `.opencode/command/status.md`
- `.opencode/command/resume.md`
- `.opencode/command/handoff.md`
- `.opencode/command/research.md`
- `.opencode/command/lfg.md`
- `.opencode/command/compound.md`

Template copies also exist under `ock/.opencode/command` and `ock/dist/template/.opencode/command`, but those are not the active repo-root command source for this checkout.

Among the target names, the only additional same-name builtin implementation I found is `handoff` in `omo/src/features/builtin-commands/commands.ts`. Repo-local `.opencode/command/handoff.md` still wins over builtin at runtime because repo-local OpenCode commands are merged after builtin commands in `applyCommandConfig()`.

**Evidence:**

- `.opencode/command/*.md`
- `omo/src/features/builtin-commands/commands.ts`
- `omo/src/plugin-handlers/command-config-handler.ts`

### 10) The highest-value precedence mismatch is user Claude vs global OpenCode, not the current repo-local winner

For workflow-classified names in an OCK bead-first repo, the effective precedence models are:

**Discovery/help:**
`opencode-project > project > config > user > opencode > builtin > plugin`

**Runtime registration:**
`builtin < user < opencode-global < system < project < opencode-project < plugin`

If the same bare workflow name exists in both user Claude commands and global OpenCode commands, discovery/help would prefer the user command while runtime would prefer the global OpenCode command. That is the clearest currently-proven structural drift between what a user sees and what runtime registration prefers.

Plugin commands and plugin skills are namespaced, so they do not currently create bare-name collisions for workflow commands even though plugin-sourced runtime entries are merged last.

**Evidence:**

- `omo/src/tools/slashcommand/command-discovery.ts`
- `omo/src/plugin-handlers/command-config-handler.ts`
- `omo/src/features/claude-code-plugin-loader/command-loader.ts`
- `omo/src/features/claude-code-plugin-loader/skill-loader.ts`
- `omo/src/shared/plugin-command-discovery.test.ts`

### 11) Collision coverage is still incomplete at runtime

I found good test coverage for discovery behavior, ancestor repo-local command lookup, worktree boundaries, plugin namespacing, and some slash execution compatibility. I did **not** find direct tests for these runtime collision cases:

- builtin `handoff` vs repo-local `.opencode/command/handoff.md`
- user Claude vs global OpenCode same-name workflow command
- project Claude vs repo-local OpenCode same-name workflow command
- same-name workflow command collisions across `applyCommandConfig()` and `discoverCommandsSync()` proving parity or intentional divergence

This means the authority split is well-established by code, but not yet protected by targeted regression tests where backbone-enforcement work is likely to matter most.

**Evidence:**

- `omo/src/plugin-handlers/command-config-handler.test.ts`
- `omo/src/tools/slashcommand/command-discovery.test.ts`
- `omo/src/tools/slashcommand/executor-resolution.test.ts`
- `omo/src/tools/slashcommand/execution-compatibility.test.ts`

---

## Recommendations

1. **Read this artifact as a bounded follow-on audit built on the completed Phase 1 package.** Its job is to clarify one command-authority seam for later work, not to recreate the full comparative-research program.
2. **Treat `applyCommandConfig()` as the runtime registration authority** when auditing what command wins in `config.command`.
3. **Treat `discoverCommandsSync()` plus auto-slash execution as the visible/template authority** when auditing what slash commands resolve to in chat-time execution.
4. **Do not assume the visible winner is the runtime winner.** Any backbone-enforcement work must either unify these paths or explicitly bridge them.
5. **Keep repo-local `.opencode` commands as the canonical bead-backed workflow surface** for `create/start/plan/ship/pr` in OCK bead-first repos.
6. **Treat `verify/status/resume/handoff/research` as subordinate support commands** rather than peer workflow roots.
7. **Treat `lfg` and `compound` as compatibility/automation adapters**, not primary lifecycle roots.
8. **Add targeted precedence tests** before command-surface enforcement work changes runtime ordering, especially for `handoff` and user-vs-global same-name collisions.

---

## Open Items

1. **Final core dispatcher trace:** This research traced slash execution and runtime command assembly, but I still did not prove the final downstream OpenCode core consumer that executes `config.command` after the plugin populates it.
2. **Help-surface completeness:** Slash discovery and auto-slash execution were inspected, but the full user-facing help/list surface should still be audited if runtime demotion needs UX guarantees beyond slash-command ordering.
3. **Skill-name collision audit outside target workflow names:** No current skill names matched the 12 workflow commands, but broader runtime skill-name collision auditing may still matter outside this narrowed command set.
4. **Project-state linkage:** If project steering needs this bead to be more visible, the correct home is `.opencode/memory/project/state.md`, not a broader rewrite of this bead into a Phase 1-style artifact.

---

## Bottom Line

The bead’s core question is answered with high confidence:

- **Runtime registration authority** currently lives in `applyCommandConfig()` and is last-write-wins.
- **Visible slash-command authority** currently lives in `discoverCommandsSync()` and auto-slash execution, which reuses discovery and workflow grouping rather than `config.command`.
- These are **not the same authority path**, so command visibility and runtime registration can diverge.
- In this checkout, the active bare workflow winners are the repo-local files under `.opencode/command`, with builtin collision only clearly present for `handoff`.
- The repo already encodes the intended OCK bead-backed classification: **primary roots** (`create/start/plan/ship/pr`), **support** (`verify/status/resume/handoff/research`), and **compatibility/adapters** (`lfg/compound`).

That makes `bd-k8z` a narrow follow-on research/support bead for later Phase 3 command/runtime enforcement work, explicitly based on the completed Phase 1 artifact set rather than detached from it. It should be read as command-authority evidence layered on top of that Phase 1 basis, not as a substitute for the broad Phase 1 package or the main project phase documents.
