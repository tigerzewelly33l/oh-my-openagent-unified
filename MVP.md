# OCK + OMO Unified MVP

## Problem Statement

Today the workspace contains two strong but overlapping systems. `opencodekit-template` already owns the public `ock` CLI, project scaffolding, upgrade flow, validation scripts, and the distributed `.opencode/` payload. `oh-my-openagent` already owns the heavier runtime concerns: config loading, command and skill merging, session tools, MCP lifecycle, and background agent orchestration.

The clash is that OCK still ships runtime-shaped behavior in its template payload, while OMO already has richer versions of the same categories. If we let both keep growing across the same surfaces, the result is not “one product” but two partially overlapping runtimes with different toolchains and duplicated mental models.

This MVP exists to stop that drift. It defines one product surface, one orchestration owner, one task-ledger owner, one migration story, and one temporary bridge strategy for duplicated capabilities.

## Product Goal

The MVP turns OCK + OMO into **one product with one front door**.

- Users enter through **`ock`**.
- OCK remains responsible for **bootstrap, upgrade, distribution, governance, and user-facing packaging**.
- OMO remains responsible for **runtime orchestration, agent execution, tool loading, command/skill loading, MCP lifecycle, and session/runtime behavior**.
- `beads_rust` becomes the **Rust task substrate** for task records, dependency graphs, ready-work selection, and machine-readable task state, while **not** becoming a second scheduler.

The outcome we want is simple: a user feels like they are using one coherent system, while internally the responsibilities are clean enough that future work does not reintroduce duplicate runtime ownership.

## Decision Ledger

| Decision | Answer | Why it is frozen now |
|---|---|---|
| Product shape | One unified product | The user wants the two systems to work as one, not as a loose federation. |
| Public entry point | `ock` | OCK already owns the packaged CLI, init/upgrade flow, and distribution surface. |
| Runtime orchestration owner | OMO | OMO already owns background task orchestration, config registration, command/skill loading, and session/runtime surfaces. |
| Rust direction | `beads_rust` is the Rust task substrate | The user explicitly wants Rust in the task story, but current repo evidence supports task state/dependency ownership, not a Rust scheduler. |
| Duplication strategy | Compatibility bridge first | This reduces migration risk while still freezing a winning owner per capability. |
| Runtime naming | Canonical `oh-my-openagent`, legacy `oh-my-opencode` accepted during MVP | OMO already supports canonical + legacy naming compatibility and migration behavior. |
| Repo/toolchain strategy | No root monorepo/toolchain merge in MVP | The workspace explicitly remains two products today, with different toolchains and assumptions. |

## Non-Goals

- Merge the two repositories into one build pipeline during MVP.
- Replace OCK’s memory system before parity is proven.
- Rewrite every OCK slash command during MVP.
- Give Rust ownership of scheduling, background polling, cancellation, or parent-session notifications.
- Introduce a third runtime/plugin/config identity.
- Remove all compatibility shims immediately.

## Canonical Topology

```text
User
  |
  v
ock (Node/npm CLI, OCK)
  |- init / upgrade / validation / status / packaging
  |- installs and updates project payload
  v
Project Runtime Surface (.opencode/)
  |
  v
OMO Runtime (Bun)
  |- config loading
  |- command + skill loading/precedence
  |- agent orchestration
  |- session tools
  |- MCP lifecycle
  |- background task scheduling / retry / cancellation / notifications
  |
  +--> beads_rust / br (Rust)
         |- task records
         |- dependency graph
         |- ready-work selection
         |- JSON/JSONL + MCP task interfaces
         `- no scheduler / no daemon / no orchestration ownership
```

### Topology Principles

- **One front door:** the user starts from `ock`.
- **One scheduler:** OMO is the only orchestration owner.
- **One task ledger:** `beads_rust` owns task state and dependency semantics.
- **One upgrade path:** OCK must be able to lay down and evolve the unified project shape safely.

## Capability Ownership Matrix

| Capability | Current OCK role | Current OMO role | MVP owner | Bridge in MVP | Post-MVP fate |
|---|---|---|---|---|---|
| Project init / bootstrap | Owns `ock init` and project scaffolding | No primary role | **OCK** | `ock init` installs OMO-compatible runtime config and bridge-managed project files | Stays in OCK |
| Project upgrade / template evolution | Owns `ock upgrade` and template refresh semantics | No primary role | **OCK** | `ock upgrade` updates bridge-managed files while preserving user-owned areas | Stays in OCK |
| Validation / governance checks | Owns template validation and governance scripts | No primary role | **OCK** | OCK continues to own docs/skill/command validation and template integrity | Stays in OCK |
| Doctor/status diagnostics | Owns CLI-visible project health/status surface | No primary role | **OCK** | OCK reports unified product health and installed runtime state | Stays in OCK |
| Workflow slash-command content and defaults | Authors/distributes command content in template payload | Executes those commands through runtime semantics | **OCK** | Commands remain authored/distributed by OCK, but must target OMO runtime semantics | Mostly stays in OCK |
| Command loading and precedence | Ships project command files | Owns runtime command merge pipeline | **OMO** | OCK-authored commands are loaded through OMO’s command merge pipeline | Stays in OMO |
| Skill loading and precedence | Ships project skill files | Owns runtime skill discovery and precedence | **OMO** | OCK-authored skills are loaded through OMO’s skill loader and scope rules | Stays in OMO |
| Config merge / runtime registration | Generates or updates project runtime config | Owns runtime config interpretation and migration | **OMO** | Unified project config is interpreted by OMO, including legacy-name migration | Stays in OMO |
| Background orchestration | May trigger workflows that need execution | Owns background manager and orchestration lifecycle | **OMO** | Any OCK workflow that launches work must route through OMO task orchestration | Stays in OMO |
| Session browsing / reading / search tools | Ships older session-plugin-shaped assumptions in some project content | Owns authoritative `session_*` runtime tools | **OMO** | OCK content must target OMO `session_*` tools or temporary aliases | OCK runtime session plugin removed |
| Skill-scoped MCP runtime lifecycle | Ships skill metadata and an older skill-MCP plugin surface | Owns authoritative skill-MCP runtime lifecycle | **OMO** | Keep OCK skill-local metadata formats, but OMO owns client lifecycle and tool exposure | OCK runtime skill-MCP plugin removed |
| Memory system | Owns current project memory runtime/content model | Has adjacent runtime capabilities but not proven parity | **OCK (deferred runtime consolidation)** | No forced ownership transfer in MVP; document explicit deferment until parity is proven | Revisit after parity design |
| Rust task lifecycle substrate | Exposes `br` / beads_rust task workflows via project/tooling conventions | Consumes task state for orchestration decisions | **beads_rust** | OMO reads or integrates with task state via `br` JSON or beads MCP; no duplicate task DB should become primary | Stays in Rust |
| Task execution scheduling, polling, cancellation, notifications | No primary orchestration owner | Owns runtime scheduling and lifecycle control | **OMO** | `beads_rust` may select work; OMO still launches and supervises agent work | Stays in OMO |
| Task worker implementation substrate where Rust is introduced | May choose to ship supporting project/tooling affordances later | Retains orchestration control even if invoking Rust workers | **Deferred under OMO control** | Rust workers, if added, remain invoked by OMO rather than becoming a second control plane | Revisit after MVP |

## Bridge Matrix

| Duplicate / overlapping surface | Winning owner | Temporary bridge behavior | Precedence rule | Removal trigger |
|---|---|---|---|---|
| OCK session plugin surface vs OMO session tools | **OMO** | OCK-authored commands/skills may keep compatibility wrappers or alias references while migrating to `session_list`, `session_read`, `session_search`, and `session_info` | OMO runtime tools are authoritative | Remove when distributed OCK content no longer depends on the old session plugin surface and unified smoke tests pass without it |
| OCK skill-MCP plugin vs OMO skill-MCP runtime | **OMO** | Preserve skill-local metadata formats (`mcp.json` / YAML frontmatter) but let OMO own client lifecycle, connection management, and tool exposure | OMO runtime behavior wins; OCK only authors metadata/content | Remove when all skill-scoped MCP scenarios pass through OMO with no OCK plugin runtime dependency |
| OCK runtime-shaped slash commands vs OMO runtime semantics | **OMO for runtime, OCK for content** | Commands stay distributed by OCK but must call OMO agents/tools/categories rather than invent alternate runtime logic | Runtime semantics follow OMO; authored command text follows OCK | Remove bridge notes once all OCK command templates validate directly against OMO runtime assumptions |
| Legacy `oh-my-opencode` naming vs canonical `oh-my-openagent` | **Canonical `oh-my-openagent`** | Accept legacy config/package naming during MVP and auto-migrate when possible | Canonical naming is preferred in docs and generated config | Remove active migration language when `ock upgrade` rewrites generated configs/examples to canonical naming and legacy support is only an alias path |
| OCK memory runtime vs OMO runtime capabilities | **OCK for MVP** | Explicitly defer ownership transfer; do not silently split memory ownership | Existing OCK memory behavior remains authoritative until parity work exists | Remove deferment once a dedicated parity-and-migration design is approved |

### Bridge Rule

Every bridge is temporary by design. A bridge is allowed only when:

1. the winning owner is already named,
2. the bridge makes migration safer without creating new permanent ambiguity, and
3. there is an explicit removal trigger.

## Runtime / Toolchain Matrix

| Layer | Runtime / toolchain | Owner | Responsibility | Explicit non-responsibility |
|---|---|---|---|---|
| Public CLI and installer | Node.js / npm scripts | **OCK** | `ock` entry point, init, upgrade, status, validation, packaging | Not the runtime orchestrator |
| Distributed project payload | Node-built template content | **OCK** | Ship commands, skills, docs, bridge-managed project files | Not the authority for runtime behavior once loaded |
| Runtime orchestration engine | Bun | **OMO** | Agents, tools, command/skill loading, MCP registration, session tools, background task lifecycle | Not the primary task ledger |
| Session / orchestration control plane | Bun | **OMO** | One scheduler: spawn, poll, retry, cancel, notify, enforce concurrency | Not task-state storage |
| Task ledger / dependency graph / ready queue | Rust (`beads_rust`) | **beads_rust** | Task records, dependencies, `br ready`, JSON/JSONL sync, agent-readable task state | Not scheduling, polling, or daemonized orchestration |
| Future Rust-backed task workers | Rust under OMO invocation | **Deferred** | Optional performance-oriented worker implementations later | Must not become a second scheduler |

### Rust Boundary

For MVP, **Rust task lifecycle** means:

- task records,
- status transitions,
- dependency graph semantics,
- ready-work selection,
- machine-readable task interfaces,
- durable local task state.

For MVP, Rust task lifecycle does **not** mean:

- background scheduling,
- parent/child agent orchestration,
- polling for completion,
- cancellation semantics,
- runtime tool/command loading,
- session notification routing.

Those remain OMO responsibilities. This is how the MVP keeps Rust in the architecture **without creating two schedulers**.

## Naming and Config Contract

### Product Naming

- **User-facing product name:** OCK / `ock`
- **Canonical runtime plugin identity:** `oh-my-openagent`
- **Legacy runtime identity still accepted during MVP:** `oh-my-opencode`

### Naming Rules

1. Generated docs and new examples should prefer **`oh-my-openagent`** for runtime/plugin config naming.
2. Existing legacy `oh-my-opencode` config names must continue to load during MVP.
3. No third runtime/plugin/config basename may be introduced.
4. The user story remains simple: **OCK installs and configures the OMO runtime**.

### Config Contract

- OMO remains the authoritative interpreter of runtime config.
- User-level runtime config is the base layer.
- Project-level runtime config overrides it.
- Legacy config names are accepted and migrated where possible.
- OCK-generated projects should place bridge-managed runtime config in upgradeable locations such as `.opencode/oh-my-openagent.json` or `.jsonc`.

## Command and Skill Compatibility Contract

### Authoring vs Runtime

- **OCK owns authored command and skill content** that ships with the template.
- **OMO owns how commands and skills are discovered, merged, remapped, and executed at runtime**.

### Compatibility Rules

1. OCK commands must target OMO runtime semantics.
2. OCK must not introduce a second command-loading runtime in the template.
3. OCK skill-local MCP metadata remains valid, but runtime client/process ownership belongs to OMO.
4. OCK command definitions that name agents must rely on OMO’s agent remapping and registered-agent model.
5. Session-related OCK content should migrate toward OMO `session_*` tools rather than assume direct SQLite session plugins forever.

### Precedence Contract

At runtime, command and skill precedence follows OMO’s merge behavior, with project-level content winning over broader/global layers. In practical terms:

- builtins establish the baseline,
- user/global content is additive,
- project content overrides broader content,
- plugin-provided components can still extend the final surface,
- command agent fields are remapped to registered OMO agent display names.

### Allowed vs Forbidden Authoring Patterns

**Allowed OCK command pattern**

- A command authored by OCK may invoke OMO-owned agents, categories, `session_*` tools, `skill_mcp`, and other OMO runtime surfaces.
- A command authored by OCK may assume project-level command/skill content overrides broader/global content according to OMO precedence rules.

**Forbidden OCK command pattern**

- A command may not assume direct access to deprecated SQLite session plugins when an OMO `session_*` tool exists.
- A command may not create a second command-loading runtime or bypass OMO agent remapping by assuming raw legacy agent names are the runtime contract.
- A command may not define bridge behavior that only works if preserved/skipped authoring directories are refreshed magically.

### Canonical OMO ↔ `beads_rust` Interaction Model

For MVP, the default integration path between OMO and `beads_rust` is:

1. **Read path:** OMO reads task state via `br --json` output first.
2. **Optional adapter path:** a beads MCP adapter may be added later, but it is secondary to the CLI/JSON contract in MVP.
3. **Write path:** if OMO updates task state, it does so by invoking explicit `br` commands such as status transitions, never by mutating `.beads` JSONL or SQLite files directly.
4. **Conflict rule:** `beads_rust` remains the task-state source of truth; OMO may consume and request changes, but it does not become an independent task database.

### Memory Boundary for MVP

Memory remains intentionally conservative in MVP:

- OCK-owned memory files and tools remain the current memory contract.
- OMO may consume that memory as project/runtime input where needed, but it does not become the authoritative memory storage owner in MVP.
- New unified runtime work must not silently split memory ownership between OCK and OMO.
- Any memory consolidation requires a dedicated follow-up design after parity is proven.

### Critical Placement Rule

OCK init can skip `agent/`, `command/`, `skill/`, and `tool/` when global config already covers those directories. OCK upgrade also preserves several user-owned or hybrid directories.

Because of that, **bridge-critical runtime behavior must not live only inside skippable or permanently preserved authoring directories**. If the unified product depends on a bridge file being updated reliably, that bridge should live in an upgradeable location such as:

- `.opencode/plugin/`
- `.opencode/oh-my-openagent.json(c)`
- other explicitly generated, replaceable runtime-owned files

That rule prevents upgrade drift and avoids relying on directories that init may skip or upgrade may preserve.

## Migration Paths

### 1. Fresh unified project from `ock`

`ock init` becomes the standard way to create the unified shape.

- It installs the OCK-authored project payload.
- It writes OMO-compatible runtime config.
- It lays down bridge-managed runtime files only in locations that can be updated later.
- If task tracking is enabled, it also initializes the `beads_rust`/`br` task substrate.

If global config already covers `agent/`, `command/`, `skill/`, or `tool/`, the project must still remain functional because runtime-critical bridge behavior is not allowed to depend solely on those directories.

### 2. Existing OCK-generated project

`ock upgrade` becomes the migration mechanism for current OCK installs.

- User-owned areas like project memory and context remain preserved.
- Hybrid directories such as `command/`, `skill/`, and `tool/` are preserved or updated conservatively.
- Bridge-managed runtime files in upgradeable locations are refreshed aggressively.
- Custom project content remains intact.

This means the MVP must design bridge files so that OCK can actually update them in-place during upgrade.

### 3. Existing OMO-configured project

Existing OMO users are not forced to replatform immediately.

- Legacy `oh-my-opencode` config names continue to load.
- Canonical `oh-my-openagent` naming is preferred for new generation and migration.
- OCK becomes the preferred front door for bootstrap and upgrade over time.
- The MVP does **not** require a repo merge or a forced toolchain merge to adopt the unified product direction.

### 4. Existing `beads_rust` usage

Projects already using `br` continue to use it as the task ledger.

- OMO reads or integrates with `br` task state.
- OMO does not replace `br` with a second task-state authority.
- `br` remains explicit and local-first for task updates and sync.
- OMO continues to own actual orchestration of agent work.

## Acceptance Suite

This section defines the future smoke tests that prove the architecture was implemented correctly. These are **post-implementation checks**, not claims that the current repos already satisfy the target behavior.

### 1. Fresh unified init smoke test

**Goal:** prove that `ock` creates the unified project shape.

**Commands / steps**

```bash
ock init --beads -y
test -d .opencode
test -f .opencode/oh-my-openagent.jsonc || test -f .opencode/oh-my-openagent.json
test -d .opencode/plugin
test -d .beads
ock status
```

**Config keys / artifacts to verify**

- `.opencode/oh-my-openagent.json` or `.opencode/oh-my-openagent.jsonc`
- `.opencode/plugin/`
- `.beads/` when task support is enabled

**Expected assertions**

- `ock` is still the entry point.
- The project contains OMO runtime config.
- Bridge-managed runtime files are present in upgradeable locations.
- Beads task storage is initialized when task support is enabled.

**Exit condition:** all filesystem checks exit `0` and `ock status` exits `0` without reporting missing unified-runtime prerequisites.

### 2. Upgrade-preserve smoke test

**Goal:** prove that `ock upgrade` updates bridge-managed files without clobbering user-owned content.

**Commands / steps**

```bash
printf 'custom-memory-marker\n' >> .opencode/memory/project/user.md
printf 'custom-command-marker\n' >> .opencode/command/custom.md
ock upgrade --force
```

**Config keys / artifacts to verify**

- `.opencode/memory/project/user.md`
- `.opencode/command/custom.md`
- bridge-managed runtime files under `.opencode/plugin/`
- project runtime config file under `.opencode/oh-my-openagent.json*`

**Expected assertions**

- `.opencode/memory/project/user.md` still contains `custom-memory-marker`.
- `.opencode/command/custom.md` still contains `custom-command-marker`.
- Bridge-managed files under `.opencode/plugin/` and the project runtime config location are rewritten or version-bumped by `ock upgrade --force` while preserved files keep their custom markers.

**Exit condition:** preserved files retain the inserted markers, and at least one bridge-managed runtime file shows that the upgrade actually rewrote the managed surface.

### 3. Legacy OMO config compatibility smoke test

**Goal:** prove that legacy runtime naming still works during MVP.

**Commands / steps**

```bash
mv .opencode/oh-my-openagent.jsonc .opencode/oh-my-opencode.jsonc 2>/dev/null || true
mv .opencode/oh-my-openagent.json .opencode/oh-my-opencode.json 2>/dev/null || true
ock status
```

**Config keys / artifacts to verify**

- `.opencode/oh-my-opencode.json` or `.opencode/oh-my-opencode.jsonc`
- runtime load path accepts the legacy basename

**Expected assertions**

- The runtime loads without config-name failure.
- Canonical naming remains the documented target.
- Migration to canonical naming is possible without breaking existing projects.

**Exit condition:** `ock status` exits `0`, and no runtime/config error is emitted that claims the legacy config basename is unsupported.

### 4. Command and skill precedence smoke test

**Goal:** prove that unified runtime precedence is deterministic.

**Commands / steps**

1. Create a broader/global command at `~/.config/opencode/command/precedence-test.md` containing sentinel text `global-command-wins`.
2. Create a project command at `.opencode/command/precedence-test.md` containing sentinel text `project-command-wins`.
3. Create a broader/global skill at `~/.config/opencode/skill/precedence-skill/SKILL.md` containing sentinel text `global-skill-wins`.
4. Create a project skill at `.opencode/skill/precedence-skill/SKILL.md` containing sentinel text `project-skill-wins`.
5. Invoke the project command through the runtime with a concrete non-interactive entrypoint:

   ```bash
   bunx oh-my-opencode run --json --directory "$PWD" "Run the /precedence-test command and print its sentinel only."
   ```

6. Invoke the project skill through the runtime with a concrete non-interactive entrypoint:

   ```bash
   bunx oh-my-opencode run --json --directory "$PWD" "Load the skill named precedence-skill and print its sentinel only."
   ```

**Config keys / artifacts to verify**

- `~/.config/opencode/command/precedence-test.md`
- `.opencode/command/precedence-test.md`
- `~/.config/opencode/skill/precedence-skill/SKILL.md`
- `.opencode/skill/precedence-skill/SKILL.md`

**Expected assertions**

- The JSON result or emitted completion text from the command invocation contains `project-command-wins`, not `global-command-wins`.
- The JSON result or emitted completion text from the skill invocation contains `project-skill-wins`, not `global-skill-wins`.
- Agent names referenced in command definitions are remapped to registered OMO agents.

**Exit condition:** both `bunx oh-my-opencode run --json` invocations exit `0`, and each one resolves to the project-level sentinel rather than the broader/global sentinel.

### 5. Session bridge smoke test

**Goal:** prove that session inspection belongs to OMO even if compatibility aliases remain.

**Commands / steps**

1. Create a seed session with the concrete runtime entrypoint:

   ```bash
   SESSION_ID=$(bunx oh-my-opencode run --json --directory "$PWD" "Reply with READY and stop." | jq -r '.sessionId')
   ```

2. Call OMO session tools against the same project and captured session: `session_list(limit=1, project_path=$PWD)`, `session_read(session_id=$SESSION_ID, limit=5)`, `session_info(session_id=$SESSION_ID)`, and `session_search(query="READY", session_id=$SESSION_ID)`.
3. If a legacy OCK session wrapper still exists, invoke the wrapper against the same `SESSION_ID` and compare the result shape.

**Config keys / artifacts to verify**

- One captured `SESSION_ID` from `bunx oh-my-opencode run --json`
- OMO `session_*` tool outputs for the same session

**Expected assertions**

- OMO `session_*` tools are the authoritative session surface.
- Any legacy wrapper returns equivalent data or clearly routes to OMO behavior.
- No second session-storage authority is introduced.

**Exit condition:** the seed run exits `0`, produces a non-empty `SESSION_ID`, all OMO `session_*` calls succeed for that same session, and any wrapper path either matches or transparently delegates to the same authoritative session data.

### 6. Skill-MCP bridge smoke test

**Goal:** prove that skill-local MCP metadata remains valid while runtime execution belongs to OMO.

**Commands / steps**

1. Create a fixture skill at `.opencode/skill/test-mcp/SKILL.md`.
2. Create a deterministic local MCP fixture server at `.opencode/skill/test-mcp/server.js` that exposes one tool named `ping` and returns `{ "pong": true }`.
3. Declare MCP metadata in `.opencode/skill/test-mcp/mcp.json` using this exact shape:

   ```json
   {
     "test-ping": {
       "command": "node",
       "args": [".opencode/skill/test-mcp/server.js"]
     }
   }
   ```

4. Start the runtime and load the skill through a concrete prompt:

   ```bash
   bunx oh-my-opencode run --json --directory "$PWD" "Load the skill named test-mcp, list its MCP tools, call the ping tool, and print the result."
   ```

5. Invoke OMO `skill_mcp` against the declared `test-ping` server and the `ping` tool, either directly in a tool-capable session or indirectly through the command above.

**Config keys / artifacts to verify**

- `.opencode/skill/test-mcp/SKILL.md`
- `.opencode/skill/test-mcp/server.js`
- `.opencode/skill/test-mcp/mcp.json`
- known expected tool name `ping`

**Expected assertions**

- Skill-local metadata format remains accepted.
- OMO owns MCP process/client lifecycle.
- No OCK-only runtime plugin is required for the MCP tool to appear.

**Exit condition:** the runtime call exits `0`, the `ping` tool becomes visible through the OMO `skill_mcp` path, and invoking it returns the expected `{ "pong": true }` result without requiring an OCK-only runtime plugin.

### 7. Rust / beads task lifecycle smoke test

**Goal:** prove that Rust owns task state while OMO owns orchestration.

**Commands / steps**

```bash
br init
TASK_A_ID=$(br create "Task A" --type task --priority 1 --json | jq -r '.id')
TASK_B_ID=$(br create "Task B" --type task --priority 1 --json | jq -r '.id')
br dep add "$TASK_B_ID" "$TASK_A_ID"
br ready --json
```

Then, from the unified runtime:

1. Read the ready task set through `br ready --json` as the canonical MVP transport.
2. Optionally verify the same task state through a beads MCP adapter if one exists.
3. Launch agent work through OMO orchestration.
4. Verify completion/cancellation/polling behavior through OMO background-task surfaces, not through `br`.

**Config keys / artifacts to verify**

- `.beads/` task state exists
- `TASK_A_ID` and `TASK_B_ID` are captured from CLI JSON output
- `br ready --json` is readable by OMO-side orchestration logic
- OMO background-task surface records spawned work independently of the task ledger

**Expected assertions**

- `br` is the source of truth for task records and dependency readiness.
- OMO is the source of truth for launched background work and orchestration lifecycle.
- `br` does not become a daemon or scheduler.
- OMO does not create a second primary task ledger.

**Exit condition:** `br ready --json` reflects dependency-aware task readiness, while launched work is visible and controllable through OMO orchestration surfaces rather than through `br` itself.

## Post-MVP Removal Triggers

- Remove the temporary session bridge when distributed OCK content no longer depends on legacy session plugin behavior and all unified session smoke tests pass against OMO-only tooling.
- Remove the temporary skill-MCP bridge when skill-local metadata loads entirely through OMO runtime without any OCK runtime plugin dependency.
- Remove migration-heavy legacy naming guidance when generated configs, upgrade flows, and docs are canonicalized around `oh-my-openagent`, with legacy naming retained only as a compatibility alias.
- Remove any bridge-managed runtime files from OCK payload once the unified project can bootstrap and upgrade cleanly with OMO-native runtime ownership and no duplicated runtime logic.
- Revisit memory ownership only after a dedicated parity plan exists; until then, do not silently split or transfer ownership.

## Summary

The MVP is not “merge everything.” It is a cleaner separation:

- **OCK** becomes the product shell and upgrade/distribution system.
- **OMO** becomes the only orchestration runtime.
- **beads_rust** becomes the Rust task substrate for task state and dependency semantics.

That gives the combined project one user story, one front door, one scheduler, and one task ledger, while still respecting the strengths and current realities of all three components.
