# OpenCodeKit Template Configuration

This directory contains project-specific OpenCode configuration: agents, commands, skills, tools, plugins, and memory conventions.

## Layout

```text
.opencode/
├── AGENTS.md                # Global operating rules for agents
├── opencode.json            # OpenCode runtime configuration
├── dcp.jsonc                # Dynamic context pruning settings
├── agent/                   # Agent definitions (9)
├── command/                 # Slash commands (19)
├── skill/                   # Skill library used by agents/commands
├── tool/                    # Template-local tools (`context7`, `grepsearch`)
├── plugin/                  # OpenCode plugins and plugin-local SDK code
├── memory/                  # Memory templates + project memory files
└── .env.example             # Environment variable template
```

## Quick Setup

```bash
cp .opencode/.env.example .opencode/.env
```

Add the keys you actually need for enabled services.

## Agent and Command Workflow

- Spec-first flow: `/create` -> `/start <id>` -> `/ship <id>`
- Use `/plan <id>` optionally for deeper implementation planning
- Use `/status` and `/resume` for continuity

## Skills

Skills live in `.opencode/skill/` and are loaded on demand with `skill({ name: "..." })`.

- Core workflow examples: `beads`, `verification-before-completion`, `writing-plans`, `executing-plans`
- Debug/reliability examples: `systematic-debugging`, `root-cause-tracing`, `defense-in-depth`
- UI/design examples: `frontend-design`, `visual-analysis`, `accessibility-audit`

## Custom Tools

Tools in `.opencode/tool/` are loaded by OpenCode and available to agents.

- Template-local research/docs tools: `context7`, `grepsearch`
- Memory and observation tooling is provided by the template plugin layer (`.opencode/plugin/memory.ts`), while session browsing/search and skill-MCP runtime surfaces are provided by the OMO runtime layer rather than template-local `.opencode/tool/*.ts` files

## Plugins

Current plugin source files in `.opencode/plugin/`:

- `memory.ts` - memory DB maintenance hooks + toast notifications
- `copilot-auth.ts` - GitHub Copilot auth/provider integration
- `stitch.ts` - Google Stitch UI generation integration

Session browsing/search and skill-MCP execution are now owned by the OMO runtime rather than duplicate OCK template plugins. During the bridge window, preserved project content that still references the removed OCK runtime surfaces should be diagnosed via `ock status` / `ock doctor` instead of silently continuing to rely on template-local plugin files.

See `.opencode/plugin/README.md` for plugin details.

## Guardrails

- Keep edits focused; avoid changing generated output under `dist/`.
- Never commit `.env` values or credentials.
- Prefer tool-based file operations over shell text manipulation in agent workflows.
- Use `br` commands to track multi-session work and keep bead state accurate.

## Verification Baseline

```bash
npm run typecheck
npm run lint
npm run test
```

For docs/config governance, run the validation scripts defined in `package.json`.
