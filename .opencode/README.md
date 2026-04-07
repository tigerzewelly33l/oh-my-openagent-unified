# OpenCodeKit Template Configuration

This directory contains project-specific OpenCode configuration: agents, commands, skills, tools, plugins, and memory conventions.

## Layout

```text
.opencode/
├── AGENTS.md                # Global operating rules for agents
├── opencode.json            # OpenCode runtime configuration
├── dcp.jsonc                # Dynamic context pruning settings
├── agent/                   # Agent definitions (9)
├── command/                 # Slash commands (14)
├── skill/                   # Skill library used by agents/commands
├── tool/                    # Custom tools (memory, swarm, research, etc.)
├── plugin/                  # OpenCode plugins and plugin-local SDK code
├── memory/                  # Memory templates + project memory files
└── .env.example             # Environment variable template
```

## Quick Setup

```bash
cp .opencode/.env.example .opencode/.env
```

Add the keys you actually need for enabled services.

Optional but recommended for faster local/subagent code navigation:

```bash
pnpm add -g tilth
# or: npm install -g tilth
```

The runtime already enables Tilth MCP for the main agent. With a global `tilth` binary installed, subagents and shell workflows can use the CLI directly; otherwise they fall back to `npx -y tilth`.

## Agent and Command Workflow

- Spec-first flow: `/create` -> `/start <id>` -> `/ship <id>`
- Use `/plan <id>` optionally for deeper implementation planning
- Use `/status` and `/resume` for continuity

## Recommended Setup Flow

- `/init` — core setup entrypoint for `AGENTS.md` and `tech-stack.md`
- `/init-user` — optional personalization profile
- `/init-context` — creates or updates repo-local project memory (`project.md`, `roadmap.md`, `state.md`)

`/init` should be the practical starting surface. It finishes core setup, then offers continuation into `/init-context` instead of duplicating ownership of the project-memory files.

## Skills

Skills live in `.opencode/skill/` and are loaded on demand with `skill({ name: "..." })`.

- Core workflow examples: `beads`, `verification-before-completion`, `writing-plans`, `executing-plans`
- Debug/reliability examples: `systematic-debugging`, `root-cause-tracing`, `defense-in-depth`
- UI/design examples: `frontend-design`, `visual-analysis`, `accessibility-audit`

## Custom Tools

Tools in `.opencode/tool/` are loaded by OpenCode and available to agents.

- Memory: `memory-search`, `memory-get`, `memory-read`, `memory-update`, `memory-admin`, `memory-timeline`
- Observability/orchestration: `observation`, `swarm`, `action-queue`
- External research/docs: `context7`, `grepsearch`

## Plugins

Current plugin source files in `.opencode/plugin/`:

- `memory.ts` - memory DB maintenance hooks + toast notifications
- `sessions.ts` - session browsing/search/summarization tools
- `compaction.ts` - compaction-time context injection and recovery protocol
- `swarm-enforcer.ts` - `/create` -> `/start` -> `/ship` workflow enforcement
- `skill-mcp.ts` - bridge for skill-scoped MCP servers/tools
- `copilot-auth.ts` - GitHub Copilot auth/provider integration

See `.opencode/plugin/README.md` for plugin details.

## Guardrails

- Keep edits focused; avoid changing generated output under `dist/`.
- Never commit `.env` values or credentials.
- Prefer tool-based file operations over shell text manipulation in agent workflows.
- Main agent should prefer Tilth MCP tools when available; CLI Tilth is the companion path for subagents, shell usage, and `--map`.
- Use `br` commands to track multi-session work and keep bead state accurate.

## Verification Baseline

```bash
npm run typecheck
npm run lint
npm run test
```

For docs/config governance, run the validation scripts defined in `package.json`.
