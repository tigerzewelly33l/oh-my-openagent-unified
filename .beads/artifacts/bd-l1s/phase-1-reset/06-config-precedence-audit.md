# Configuration and Integration Precedence Audit

**Bead:** bd-l1s  
**Phase:** 1 (Reset)  
**Artifact:** 06-config-precedence-audit.md  
**Status:** Draft

---

## Audit Schema

| Field | Value |
|-------|-------|
| Question | Where does configuration precedence live, what merge behavior exists, and what compatibility layers exist between OCK and OMO config systems? |
| Current Behavior | See Config Sources, Merge/Precedence Behavior, and Compatibility Layers sections |
| Claimed Behavior | Project-memory claims about unified config (QUARANTINED) |
| Evidence | Source file analysis from plugin-config.ts, config schema files, init.ts, config.ts |
| Contradictions | See findings below |
| Authority Candidates | Split: OMO owns runtime config merge logic, OCK owns CLI scaffolding, no unified precedence |
| Unresolved Questions | See below |
| Confidence | High |
| Gate Impact | Non-Blocking |

---

## Config Sources

### OMO (oh-my-openagent/)

**Primary Config Locations:**

| Location | Type | Purpose |
|----------|------|---------|
| `~/.config/opencode/oh-my-opencode.jsonc` | User-level | Global defaults, user preferences |
| `.opencode/oh-my-opencode.jsonc` | Project-level | Project-specific overrides |
| `.beads/config.yaml` | Bead-level | Bead ledger configuration |

**Config Loading Evidence:**
- `src/plugin-config.ts:168-254` — `loadPluginConfig()` loads user config first, then project config
- Merge uses `mergeConfigs()` with deep merge for nested objects
- Zod schema validation via `OhMyOpenCodeConfigSchema.safeParse()`

**Schema System:**
- `src/config/schema/` — 27 Zod v4 schema files covering agents, hooks, MCPs, skills, etc.
- Field-level defaults via Zod `default()` helper
- Partial parsing fallback in `parseConfigPartially()` for backwards compatibility

**Evidence:**
```
plugin-config.ts:loadPluginConfig()
  ├─ getOpenCodeConfigDir() → ~/.config/opencode/
  ├─ detectPluginConfigFile() → finds .jsonc or .json
  ├─ loadConfigFromPath() → parseJsonc + safeParse
  ├─ migrateConfigFile() → legacy key transformation
  └─ mergeConfigs() → deepMerge + Set union for disabled_*
```

### OCK (opencodekit-template/)

**Primary Config Locations:**

| Location | Type | Purpose |
|----------|------|---------|
| `~/.config/opencode/opencode.json` | User-level | Global OCK settings |
| `opencode.json` or `.opencode/opencode.json` | Project-level | Project-specific settings |
| `.opencode/oh-my-opencode.jsonc` | Compatibility | OMO plugin config (if installed) |

**Config Loading Evidence:**
- `src/commands/config.ts:1-60` — Large config file with many schema options
- No multi-level merge like OMO; config is monolithic
- Server API-driven: reads providers/agents/models from OpenCode server

**Schema System:**
- Inline in `src/commands/config.ts:9-60` — Interface definitions for ServerProvider, ServerModel, ServerAgent
- No Zod; uses runtime type checking via OpenCode server

**Evidence:**
```
config.ts:OpenCodeConfig
  ├─ model, small_model, theme, share, autoupdate
  ├─ mcp: Record<string, MCPServer>
  ├─ permission, keybinds, provider, agent, formatter
  ├─ plugin, tools
  └─ tui, command (newer additions)
```

---

## Merge / Precedence Behavior

### OMO Multi-Level Merge

**Precedence Order (highest to lowest):**

1. Project-level `.opencode/oh-my-opencode.jsonc`
2. User-level `~/.config/opencode/oh-my-opencode.jsonc`
3. Zod schema defaults

**Merge Rules:**

| Field Type | Merge Behavior |
|-----------|----------------|
| `agents`, `categories`, `claude_code` | Deep merge (recursive) |
| `disabled_agents`, `disabled_mcps`, `disabled_hooks`, `disabled_skills`, `disabled_commands`, `disabled_tools` | Set union (concatenated + deduplicated) |
| All other fields | Override (base replaced by override) |

**Evidence:**
```typescript
// plugin-config.ts:113-166
mergeConfigs(base, override):
  - ...spread for top-level
  - agents: deepMerge(base.agents, override.agents)
  - categories: deepMerge(base.categories, override.categories)
  - disabled_* : [...new Set([...base.disabled_*, ...override.disabled_*])]
  - claude_code: deepMerge(base.claude_code, override.claude_code)
```

### OCK Config Behavior

**Precedence:** Single config file only; no multi-level merge

- Config is read directly from `opencode.json` or `.opencode/opencode.json`
- No merge with user config; project config is sole source
- Server-driven: reads from OpenCode server API at runtime

**Conflict:** OCK does not merge with OMO config; if both are present:
- OCK reads `opencode.json`
- OMO reads `oh-my-opencode.jsonc`
- No precedence rule exists between them

---

## Compatibility Layers

### 1. OMO Plugin Detection

**Mechanism:** `detectPluginConfigFile()` in `src/shared/opencode-config-dir.ts`

- Detects both `.json` and `.jsonc` formats
- Handles legacy config migration (`.opencode/opencode.json` → `.opencode/oh-my-opencode.jsonc`)
- Creates backups before migration

**Evidence:**
```typescript
// plugin-config.ts:174-199
if (userDetected.legacyPath) {
  log("Canonical plugin config detected alongside legacy config...");
}
migrateLegacyConfigFile(userDetected.path)
```

### 2. Bead-First Project Detection

**Mechanism:** `isOckBeadFirstProject()` in `omo/src/shared/ock-bead-first-project.ts`

- Detects repos with `.beads/` directory
- Uses workflow command markers to identify OCK-style projects
- Suppresses competing OMO builtins in bead-first repos

**Evidence:**
- `omo/src/shared/workflow-command-priority.ts:1-25` — Command priority classification
- Suppressed commands in bead-first repos: `start-work`, `ralph-loop`, `ulw-loop`, `cancel-ralph`, `stop-continuation`

### 3. Config Migration System

**Mechanism:** `migrateConfigFile()` in `src/shared/migration/config-migration.ts`

- Idempotent via `_migrations` tracking
- Creates timestamped backups before atomic writes
- Handles legacy key transformations

**Evidence:**
```typescript
// plugin-config.ts:79
migrateConfigFile(configPath, rawConfig)
```

### 4. Skill MCP Config Discovery

**Mechanism:** `config-source-discovery.ts` in `src/features/opencode-skill-loader/`

- Discovers MCP configs from SKILL.md YAML
- Normalizes and merges with main config
- Uses `SkillsConfigNormalizer` for schema alignment

**Evidence:**
- `src/features/opencode-skill-loader/config-source-discovery.ts`
- `src/features/opencode-skill-loader/merger/skills-config-normalizer.ts`

---

## Runtime Wiring

### OMO Runtime Config Flow

```
OhMyOpenCodePlugin(ctx)
  ├─ loadPluginConfig(directory, ctx)
  │   ├─ user config: ~/.config/opencode/oh-my-opencode.jsonc
  │   ├─ project config: .opencode/oh-my-opencode.jsonc
  │   └─ mergeConfigs() → OhMyOpenCodeConfig
  ├─ createManagers(config)
  ├─ createTools(config)
  ├─ createHooks(config)
  └─ createPluginInterface(config)
```

**Affected Files:**
- `src/index.ts` — Plugin entry point
- `src/plugin-config.ts` — Config loading and merging
- `src/config/schema/` — Zod validation schemas
- `src/shared/opencode-config-dir.ts` — Config directory detection

### OCK Runtime Config Flow

```
ock CLI
  ├─ src/index.ts (CAC entry)
  ├─ src/commands/config.ts
  │   └─ OpenCode Server API (providers, models, agents)
  └─ .opencode/commands (markdown definitions)
```

**Affected Files:**
- `src/commands/config.ts` — 2341-line config handler
- `.opencode/command/` — Markdown command definitions
- `.opencode/agent/` — Agent definitions

---

## Findings

### Finding 1: No Unified Config Precedence

| Aspect | OMO | OCK |
|--------|-----|-----|
| Config file | `oh-my-opencode.jsonc` | `opencode.json` |
| Location | `.opencode/` | Root or `.opencode/` |
| Format | JSONC with comments | JSON |
| Schema | Zod v4 | Runtime (server API) |
| Multi-level | Yes (user + project) | No |

**Contradiction:** Project-memory claims suggest unified config, but no merge logic exists between OCK and OMO configs.

### Finding 2: Bead-First Detection is OMO-Side Only

- OMO detects bead-first repos and suppresses certain commands
- OCK has no equivalent detection mechanism
- If OMO is not running (e.g., pure OCK install), bead-first workflow may not be enforced

### Finding 3: Migration is One-Way (Legacy → Canonical)

- OMO migrates legacy config files to canonical names
- No reverse migration (canonical → legacy)
- If OMO is removed, config files remain in canonical format

### Finding 4: Disabled_* Union Can Hide Errors

- `disabled_agents` / `disabled_mcps` / etc. use Set union
- User + project disabled lists are concatenated
- No warning if project tries to enable a user-disabled item

---

## Unresolved Questions

| Question | Impact | Resolution Path |
|----------|--------|------------------|
| Should OCK and OMO configs share precedence rules? | Low | Define explicit merge order or reject co-existence |
| What happens when both configs exist in same project? | Medium | Document precedence or error out |
| Should bead-first detection be bidirectional? | Low | OCK could detect OMO presence, not just OMO detecting bead-first |

---

## Gate Impact

**Non-Blocking:** This audit identifies config precedence gaps but does not block Phase 2. The merge behavior is functional within each system's boundaries; the issue is lack of cross-system coordination, not runtime failures.

---

## References

- `oh-my-openagent/src/plugin-config.ts` — Config loading and merge
- `oh-my-openagent/src/config/schema/` — Zod schema files
- `oh-my-openagent/src/shared/opencode-config-dir.ts` — Config detection
- `opencodekit-template/src/commands/config.ts` — OCK config handling
- `omo/src/shared/workflow-command-priority.ts` — Command suppression logic