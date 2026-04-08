# [0.19.4](https://github.com/opencodekit/opencodekit-template/compare/v0.19.3...v0.19.4) (2026-04-01)

### Improvements

- add `opencodex-fast` plugin configuration to `.opencode/opencode.json`
- add `.opencode/opencodex-fast.jsonc` with the plugin enabled
- bump `.opencode/package.json` dependency `@opencode-ai/plugin` from `1.3.9` to `1.3.13`

# [0.17.11](https://github.com/opencodekit/opencodekit-template/compare/v0.17.10...v0.17.11) (2026-02-21)

### Features

- Add Compound Engineering workflow (inspired by Every Inc's compound-engineering approach):
  - New `/compound` command — extract and persist learnings from completed work into institutional memory
  - New `/lfg` command — full autonomous chain (Plan → Ship → Review → Compound) in one command
  - New `/plan` Phase 0: Institutional Research — mandatory memory-search + git history mining before planning
  - Rewrite `requesting-code-review` skill — 5 parallel specialized review agents (security, performance, type-safety, conventions, simplicity), single unified tier, no exit ramps
  - Integrate review skill into `/ship` (Phase 6) and `/pr` (Phase 2B pre-merge gate)
  - Update AGENTS.md to surface Compound Engineering Loop as primary workflow

# [0.17.10](https://github.com/opencodekit/opencodekit-template/compare/v0.17.9...v0.17.10) (2026-02-21)

### Improvements

- update GitHub Copilot model context limits for accurate token limits:
  - claude-haiku-4.5: 200K context, 64K output
  - claude-opus-4.5: 200K context, 64K output
  - claude-opus-4.6: 200K context (from 128K), 64K output
  - claude-sonnet-4.5: 200K context, 64K output
  - claude-sonnet-4.6: 200K context (from 128K), 64K output (from 32K)
  - gpt-5.2: 400K context, 128K output
  - gpt-5.2-codex: 400K context, 128K output

# [0.15.16](https://github.com/opencodekit/opencodekit-template/compare/v0.15.15...v0.15.16) (2026-01-29)

### Features

- **tool naming**: rename `grep-search` tool to `grepsearch` for consistent camelCase convention
- **build agent**: add new Build agent for plan execution and swarm coordination
- **deep research skill**: add comprehensive deep-research skill with LSP exploration (9 operations), memory-first protocol, and confidence-scored findings
- **swarm coordination skill**: add new swarm-coordination skill for multi-agent task coordination with delegation packets, mailbox communication, and graceful shutdown patterns
- **oracle tool**: add oracle tool for getting second opinions from different AI models (gpt-5.2-codex, Gemini 3 Pro) on complex reasoning tasks
- **context7 tools**: add context7-query-docs and context7-resolve-library-id tools for library documentation lookup
- **swarm tools**: add swarm-delegate tool for generating delegation packets and swarm-helper tool for multi-agent coordination
- **swarm enforcer plugin**: add new plugin for enforcing swarm protocol and task coordination

### Improvements

- update all agent documentation for build, plan, scout agents with enhanced capabilities
- update command documentation for research, research-ui, implement commands
- enhance tool-priority skill with comprehensive LSP operations checklist
- improve source-code-research skill with source code fetching capabilities
- rebuild template bundling to include all new tools and skills
- add comprehensive build agent documentation for plan execution and worker orchestration

### Bug Fixes

- fix tool reference from hyphenated `grep-search` to camelCase `grepsearch` across all configurations (82 occurrences)

# [0.11.1](https://github.com/opencodekit/opencodekit-template/compare/v0.11.0...v0.11.1) (2026-01-04)

### Features

- integrate beads skill across all 29 commands using bd\_\* tools
- add automatic complexity detection and Epic→Task→Subtask decomposition to /create
- add --create-beads option to /plan for creating child beads from plan tasks
- update beads skill with comprehensive hierarchy documentation
- add hierarchical ID support (bd-a3f8 → bd-a3f8.1 → bd-a3f8.2.1)
- add parallel execution guidance for multi-agent coordination

### Improvements

- all 29 commands using bd\_\* tools now load beads skill for consistent session protocol
- proper dependency management enables parallel agent execution on subtasks

# [0.11.0](https://github.com/opencodekit/opencodekit-template/compare/v0.10.0...v0.11.0) (2026-01-04)

### Features

- upgrade 27 command files to comprehensive phase-driven instruction sets
- add priority matrix, SLA tracking, and auto-assignment to triage command
- add health score formula and trend analysis to status command
- add conflict resolution and stale handoff detection to resume command
- add focus modes and comparison mode to summarize command
- add full TDD workflow and anti-rationalization testing to skill-create command
- add audit metrics and compression/hardening techniques to skill-optimize command
- add end-to-end workflow with research sources to research-and-implement command
- add component inventory and design token analysis to research-ui command
- add 7 restoration modes and batch processing to restore-image command

### Improvements

- all commands now follow standardized phase structure with ASCII diagrams
- add verification gates and error handling to all workflow commands
- add integration guidance linking related commands
- average command size increased from ~50 lines to ~350 lines

### Code Quality

- net +9,541 lines across 27 command files (comprehensive instruction sets)

# [0.10.0](https://github.com/opencodekit/opencodekit-template/compare/v0.9.2...v0.10.0) (2026-01-03)

### Features

- add `injector.ts` plugin - AGENTS.md hierarchy walker that collects ALL AGENTS.md files from file directory to project root
- upgrade `enforcer.ts` to actual enforcement via `client.session.promptAsync()` (not just notifications)

### Improvements

- refactor all plugins to use shared `lib/notify.ts` module (~100 lines deduplication)
- refactor plugins to use `$` Bun shell API instead of `child_process.exec`
- refactor `truncator.ts` to use `tool.execute.after` hook for output monitoring
- refactor all agent prompts to remove duplication with global AGENTS.md rules
- add Context Engineering principles to global AGENTS.md (blind spots, noise-to-signal, finite window)
- add Intent Layer principles for AGENTS.md hierarchy structure
- add Interaction Modes (Sounding Board, Execution, Generic+Specific, Inject Uncertainty)
- merge Compactor thresholds into Session Management section
- remove redundant Active Plugins section from global AGENTS.md

### Code Quality

- net -233 lines across all changes (more concise, less duplication)

# [0.9.0](https://github.com/opencodekit/opencodekit-template/compare/v0.8.0...v0.9.0) (2026-01-02)

### Features

- add Figma skill with embedded MCP for design-to-code workflows
- add Playwright skill with embedded MCP for browser automation
- add skill-mcp plugin for managing skill-embedded MCP servers
- new tools: `skill_mcp`, `skill_mcp_status`, `skill_mcp_disconnect`

### Improvements

- remove redundant Figma MCP from opencode.json (now skill-embedded, on-demand)
- update agent prompts for better delegation and tool usage
- streamline command documentation

# [0.6.7](https://github.com/opencodekit/opencodekit-template/compare/v0.6.6...v0.6.7) (2025-12-29)

### Bug Fixes

- fix JSON parse error when config file contains comments (`//` or `/* */`)
- support JSONC format in OpenCode config files

# [0.6.6](https://github.com/opencodekit/opencodekit-template/compare/v0.6.5...v0.6.6) (2025-12-29)

### Bug Fixes

- fix jdtls LSP server crash by adding required JVM arguments
- add `-Declipse.application`, `-Declipse.product`, `--add-modules=ALL-SYSTEM` flags
- add `--add-opens` for java.base/java.util and java.base/java.lang
- create unique `-data` directory per jdtls instance to prevent conflicts

# [0.6.5](https://github.com/opencodekit/opencodekit-template/compare/v0.6.4...v0.6.5) (2025-12-29)

### Features

- auto-detect OpenCode's bundled jdtls for Java LSP support
- expand LSP servers from 11 to 27 languages (aligned with OpenCode docs)
- add support for: Deno, C#, F#, Ruby, PHP, Bash, Swift, Dart, Elixir, Gleam, Clojure, OCaml, Zig, Nix, Terraform, Typst, YAML

### Improvements

- smart detection of OpenCode's bundled jdtls at ~/.local/share/opencode/bin/jdtls/
- cross-platform support for OpenCode data directories (macOS, Linux, Windows)
- improved error messages with reference to OpenCode LSP documentation

# [0.6.4](https://github.com/opencodekit/opencodekit-template/compare/v0.6.3...v0.6.4) (2025-12-26)

### Chore

- update OpenCode plugin to v1.0.202
- update model configurations with improved context limits and interleaved thinking support
- switch proxypal provider npm package to @ai-sdk/openai-compatible

# [0.6.1](https://github.com/opencodekit/opencodekit-template/compare/v0.6.0...v0.6.1) (2025-12-23)

### Refactor

- rename .opencode/skills/ to .opencode/skill/ (official OpenCode convention)
- rename plugin from superpowers.ts to skill.ts (singular)
- remove redundant .opencode/superpowers/ directory
- rename code-reviewer.md to review.md (use review subagent, not code-reviewer)

### Fix

- update all skill references from superpowers: to use_skill()
- correct descriptions for accessibility-audit, design-system-audit, frontend-aesthetics, mockup-to-code, ui-ux-research, visual-analysis skills
- add UI/UX skills to AGENTS.md skill mapping
- update command files to use .opencode/skill/ paths
- simplify skills plugin to only support project/personal skill dirs

# [0.6.0](https://github.com/opencodekit/opencodekit-template/compare/v0.5.0...v0.6.0) (2025-12-22)

### Features

- add summarize_session tool to sessions plugin for AI-powered session summaries
- add /summarize command for quick session overviews without loading full context
- enable experimental LSP tool in opencode.json for enhanced code intelligence

### Bug Fixes

- remove obsolete pickle-thinker.jsonc configuration file

## [1.3.2](https://github.com/opencodekit/opencodekit-template/compare/v1.3.1...v1.3.2) (2025-12-13)

### Bug Fixes

- restore version to 0.5.1 ([1b8febd](https://github.com/opencodekit/opencodekit-template/commit/1b8febda12df03e5cc50f2029d81fcb045f3ac64))

## [1.3.1](https://github.com/opencodekit/opencodekit-template/compare/v1.3.0...v1.3.1) (2025-12-13)

### Bug Fixes

- disable semantic-release npm auto-publish for manual versioning ([b7e8680](https://github.com/opencodekit/opencodekit-template/commit/b7e86801f00cc0a4029637775774f9eb10426878))

# [1.3.0](https://github.com/opencodekit/opencodekit-template/compare/v1.2.19...v1.3.0) (2025-12-13)

### Bug Fixes

- change pruning_summary to minimal to avoid extended thinking conflicts ([dba2548](https://github.com/opencodekit/opencodekit-template/commit/dba2548213520a1105c2535ad4a483f5f39309db))
- correct version to 0.5.1 ([edf0de3](https://github.com/opencodekit/opencodekit-template/commit/edf0de36b60244cf559728ed30ac438325206aa8))
- exclude logs from npm package ([f86d96c](https://github.com/opencodekit/opencodekit-template/commit/f86d96cee8bd580958964c904abc03d35b250a5c))
- set pruning_summary to off to avoid extended thinking conflicts ([d97537d](https://github.com/opencodekit/opencodekit-template/commit/d97537de9b07e7d335e07ed2775ea6269b954396))
- update all commands, agents, and skills to use Beads instead of backlog ([353c71e](https://github.com/opencodekit/opencodekit-template/commit/353c71ee0a1602c4494a4e52715588ff02178fdc))
- update build and rush agents to use Beads instead of backlog ([0ed88d2](https://github.com/opencodekit/opencodekit-template/commit/0ed88d20f326de25cb0ff481cfee107633f055e9))
- update macos-13 to macos-15-intel for x64 builds ([f37c59e](https://github.com/opencodekit/opencodekit-template/commit/f37c59e20d4efd3c9a243392f9c56d5a1072fd2a)), closes [actions/runner-images#13046](https://github.com/actions/runner-images/issues/13046)

### Features

- add Beads best practices from Steve Yegge ([962f4fb](https://github.com/opencodekit/opencodekit-template/commit/962f4fb5e77aa471743f0cdd1e7513a53d5e0a5a))
- add config, upgrade, and completion commands ([03f859c](https://github.com/opencodekit/opencodekit-template/commit/03f859cd0fd6dd1433d829cfe50957c1024afa22))
- add ock status command for project overview ([ffab758](https://github.com/opencodekit/opencodekit-template/commit/ffab7580a4e98e637672f41d1e5a752ca99a9c84))
- add session management plugin with list_sessions and read_session tools ([d40bdf0](https://github.com/opencodekit/opencodekit-template/commit/d40bdf084a9bcdeb568541b1a4895dcba6c425ad))
- enhance config CLI with models.dev API integration and two-step model selection ([8b64483](https://github.com/opencodekit/opencodekit-template/commit/8b644837b5e745390693b77bc10b141bc8b5403e))
- polish CLI with clack prompts ([c5b5fe8](https://github.com/opencodekit/opencodekit-template/commit/c5b5fe80deacf29ef401a3dd1e99c5375eefe311))
- polished CLI with clack prompts UI ([9fc130c](https://github.com/opencodekit/opencodekit-template/commit/9fc130cdfa649042637b6685c3669d0b4d9b99d2))
- replace Backlog.md with Beads task management system ([c9d96a1](https://github.com/opencodekit/opencodekit-template/commit/c9d96a14d36b94190571a78c02bcbf696a7d3a7e))

## [1.3.3](https://github.com/opencodekit/opencodekit-template/compare/v1.3.2...v1.3.3) (2025-12-13)

### Bug Fixes

- set pruning_summary to off to avoid extended thinking conflicts ([d97537d](https://github.com/opencodekit/opencodekit-template/commit/d97537de9b07e7d335e07ed2775ea6269b954396))

## [1.3.2](https://github.com/opencodekit/opencodekit-template/compare/v1.3.1...v1.3.2) (2025-12-13)

### Bug Fixes

- exclude logs from npm package ([f86d96c](https://github.com/opencodekit/opencodekit-template/commit/f86d96cee8bd580958964c904abc03d35b250a5c))

## [1.3.1](https://github.com/opencodekit/opencodekit-template/compare/v1.3.0...v1.3.1) (2025-12-13)

### Bug Fixes

- change pruning_summary to minimal to avoid extended thinking conflicts ([dba2548](https://github.com/opencodekit/opencodekit-template/commit/dba2548213520a1105c2535ad4a483f5f39309db))

# [1.3.0](https://github.com/opencodekit/opencodekit-template/compare/v1.2.19...v1.3.0) (2025-12-13)

### Bug Fixes

- update all commands, agents, and skills to use Beads instead of backlog ([353c71e](https://github.com/opencodekit/opencodekit-template/commit/353c71ee0a1602c4494a4e52715588ff02178fdc))
- update build and rush agents to use Beads instead of backlog ([0ed88d2](https://github.com/opencodekit/opencodekit-template/commit/0ed88d20f326de25cb0ff481cfee107633f055e9))
- update macos-13 to macos-15-intel for x64 builds ([f37c59e](https://github.com/opencodekit/opencodekit-template/commit/f37c59e20d4efd3c9a243392f9c56d5a1072fd2a)), closes [actions/runner-images#13046](https://github.com/actions/runner-images/issues/13046)

### Features

- add Beads best practices from Steve Yegge ([962f4fb](https://github.com/opencodekit/opencodekit-template/commit/962f4fb5e77aa471743f0cdd1e7513a53d5e0a5a))
- add config, upgrade, and completion commands ([03f859c](https://github.com/opencodekit/opencodekit-template/commit/03f859cd0fd6dd1433d829cfe50957c1024afa22))
- add ock status command for project overview ([ffab758](https://github.com/opencodekit/opencodekit-template/commit/ffab7580a4e98e637672f41d1e5a752ca99a9c84))
- add session management plugin with list_sessions and read_session tools ([d40bdf0](https://github.com/opencodekit/opencodekit-template/commit/d40bdf084a9bcdeb568541b1a4895dcba6c425ad))
- enhance config CLI with models.dev API integration and two-step model selection ([8b64483](https://github.com/opencodekit/opencodekit-template/commit/8b644837b5e745390693b77bc10b141bc8b5403e))
- polish CLI with clack prompts ([c5b5fe8](https://github.com/opencodekit/opencodekit-template/commit/c5b5fe80deacf29ef401a3dd1e99c5375eefe311))
- polished CLI with clack prompts UI ([9fc130c](https://github.com/opencodekit/opencodekit-template/commit/9fc130cdfa649042637b6685c3669d0b4d9b99d2))
- replace Backlog.md with Beads task management system ([c9d96a1](https://github.com/opencodekit/opencodekit-template/commit/c9d96a14d36b94190571a78c02bcbf696a7d3a7e))

# 0.4.3 (2025-12-10)

### Bug Fixes

- **plugins**: fix superpowers.ts import path to use official @opencode-ai/plugin ([#plugin](https://github.com/opencodekit/opencodekit-template/issues/plugin))
- **plugins**: register notification.ts in opencode.json plugin array ([#plugin](https://github.com/opencodekit/opencodekit-template/issues/plugin))
- **plugins**: simplify notification.ts from 251 to 85 lines following official docs pattern ([#plugin](https://github.com/opencodekit/opencodekit-template/issues/plugin))
- **plugins**: remove custom PluginContext interface, use SDK Plugin type ([#plugin](https://github.com/opencodekit/opencodekit-template/issues/plugin))
- **docs**: remove fake plugins (context.ts, project-tree.ts) from README.md ([#docs](https://github.com/opencodekit/opencodekit-template/issues/docs))
- **docs**: replace backlog MCP references with Beads task tracking ([#docs](https://github.com/opencodekit/opencodekit-template/issues/docs))

### Features

- **formatter**: switch from Prettier to Biome for JS/TS/JSON files (100x faster) ([#config](https://github.com/opencodekit/opencodekit-template/issues/config))
- **formatter**: add OpenCode v1.0.141 native Biome LSP support documentation ([#config](https://github.com/opencodekit/opencodekit-template/issues/config))
- **config**: clean up tsconfig.json - remove unnecessary declaration, outDir, rootDir ([#config](https://github.com/opencodekit/opencodekit-template/issues/config))
- **docs**: update MCP services list (5 services + augment-context-engine) ([#docs](https://github.com/opencodekit/opencodekit-template/issues/docs))

# 1.0.0 (2025-11-20)

### Bug Fixes

- correct repository URL typo (opencodecai -> opencodekit) ([4916eab](https://github.com/opencodekit/opencodekit-template/commit/4916eab769e1671a6de0168786ae0b52bc5215ce))
- curl URL parameter positioning for Discord webhook ([785fcd9](https://github.com/opencodekit/opencodekit-template/commit/785fcd952f19d42003e3ccbbeb54a62a9e3320a9))
- Discord webhook - URL must be last argument in curl ([37b1804](https://github.com/opencodekit/opencodekit-template/commit/37b1804adfbee903f956c799126e457b04bd8d23))
- Discord webhook JSON formatting error ([d80ab82](https://github.com/opencodekit/opencodekit-template/commit/d80ab8289b6f4ffb31f99e64fd5b17944c85a47b))
- put Discord webhook URL on same line as closing brace ([b78cb2f](https://github.com/opencodekit/opencodekit-template/commit/b78cb2f5b26c8ca14630d04249a533281e102fda))
- remove skills auto-loading section from rush agent and format mcp-code-mode docs ([97a0545](https://github.com/opencodekit/opencodekit-template/commit/97a0545d7ed28bed8d3027fb024485d63261dfd3))
- remove trailing backslash before Discord webhook URL ([c6a8d71](https://github.com/opencodekit/opencodekit-template/commit/c6a8d7174c607bf0b7cfa8f7cc96cb97b2dd2ddd))
- update AGENTS.md and agent docs with correct @.opencode/skills/ paths and gkg tool priority ([c1e127b](https://github.com/opencodekit/opencodekit-template/commit/c1e127b8a96f97262515c5cd817381a236d68b6f))
- update CLI error messages and version handling ([06e175c](https://github.com/opencodekit/opencodekit-template/commit/06e175cb0c7aca3d2a6b17a89f473c6b58e6dcb6))
- update package name to scoped @heyhuynhgiabuu/opencodekit-cli and npmignore ([01c2c1c](https://github.com/opencodekit/opencodekit-template/commit/01c2c1c04f6620b6e9e56caad0fc3533ab3930be))

### Features

- add Agent Builder system for dynamic subagent creation ([e5e86ef](https://github.com/opencodekit/opencodekit-template/commit/e5e86ef227b140e6624968edf9df4f6123688afc))
- add automated release workflow with NPM 2FA support ([3c8ac49](https://github.com/opencodekit/opencodekit-template/commit/3c8ac49456c67d585a39e724a6503cc758cef10d))
- add comprehensive .env.example template with all required API keys ([eaee57d](https://github.com/opencodekit/opencodekit-template/commit/eaee57d33dd6adf4e7a6c8547d4e9a796f1e2f7e))
- Add comprehensive .gitignore with OpenCodeKit patterns ([3bfae23](https://github.com/opencodekit/opencodekit-template/commit/3bfae23a925ab17d90bbf6c80b66e472446ff309))
- add Discord webhook CI for push/PR notifications ([3508e51](https://github.com/opencodekit/opencodekit-template/commit/3508e51780232ad1c2a2503c452514c1801b4d19))
- add mcp-code-mode integration (disabled by default) ([58fc556](https://github.com/opencodekit/opencodekit-template/commit/58fc556762a3961e28b1d4eb2f4566aaea47c6d2))
- add session management and handoff system ([9f54b84](https://github.com/opencodekit/opencodekit-template/commit/9f54b84182666afc35069a03de360e5d650aa3e4))
- Complete OpenCodeKit template migration from Claude Code ([5750294](https://github.com/opencodekit/opencodekit-template/commit/57502943bb2e2f85030c915e11082768de75754b))
- implement ock CLI tool for OpenCodeKit project management ([fb5f163](https://github.com/opencodekit/opencodekit-template/commit/fb5f16369b4b0ea60f695c2da5aaf2716c745864))
