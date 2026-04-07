# OpenCodeKit

CLI tool for bootstrapping and managing OpenCode multi-agent projects.

## Tech Stack

- **Runtime**: Node.js >= 20.19.0
- **Language**: TypeScript (ESNext, strict mode, bundler moduleResolution)
- **Build**: tsdown + rsync for template bundling
- **Lint**: oxlint
- **Key deps**: cac (CLI), @clack/prompts (UI), zod (validation), beads_rust (br)

## File Structure

```
src/              # CLI source (index.ts entry, commands/, utils/)
dist/             # Built output + .opencode template bundle
.opencode/        # OpenCode config, agents, skills, commands, tools
.beads/           # Task tracking (beads_rust)
```

## Commands

**Build**: `npm run build` (bundles + copies .opencode template)
**Dev**: `tsx src/index.ts` or `npm run dev`
**Test**: `vitest` (single: `vitest src/file.test.ts`)
**Lint**: `npm run lint` (fix: `npm run lint:fix`)
**Typecheck**: `npm run typecheck`

### OpenCode Command Surface (Minimal)

This kit keeps a small, opinionated command set. Keep workflows as commands and move reusable procedures into skills.

**Compound Engineering Loop (primary workflow):**

> Plan → Ship → Review → Compound → repeat. Each cycle makes the next cycle faster.
> Use `/lfg` to run the full chain autonomously.

**Core commands:**

- `/lfg` — Full chain: plan → ship → review → compound (one command)
- `/compound` — Extract and persist learnings after completing work
- `/ship`
- `/plan`
- `/start`
- `/resume`
- `/handoff`
- `/status`
- `/pr`
- `/review-codebase`
- `/research`

**Design track (optional):**

- `/design`
- `/ui-review`
- `/ui-slop-check`

## OpenCode Configuration Best Practices

This project is an OpenCode kit. Keep configuration guidance tight, accurate, and user-facing.

### Config Locations & Precedence

- **Global config**: `~/.config/opencode/opencode.json`
- **Project config**: `opencode.json` in repo root (or `.opencode/opencode.json` when using template layouts)
- **Custom path**: set `OPENCODE_CONFIG`
- **Merge rule**: project config overrides global config for conflicting keys

### Directory Layout (Global vs Project)

- Global: `~/.config/opencode/` (AGENTS.md, agent/, command/, tool/, plugin/)
- Project: `.opencode/` (same structure as global)

### Substitutions in Config

- Environment variables: `{env:VAR_NAME}`
- File contents: `{file:path/to/file}`

### When Editing OpenCode Config

- Prefer minimal, focused changes (avoid unrelated refactors)
- Document new agent behaviors in `.opencode/agent/*.md`
- For new tools/commands, add matching docs in AGENTS.md
- Keep permissions locked down (deny secrets, ask on destructive commands)

### Reference Docs (keep these current)

- Rules: https://opencode.ai/docs/rules/
- Config: https://opencode.ai/docs/config/
- Agents: https://opencode.ai/docs/agents/
- Tools: https://opencode.ai/docs/tools/
- Permissions: https://opencode.ai/docs/permissions/
- LSP: https://opencode.ai/docs/lsp/
- MCP Servers: https://opencode.ai/docs/mcp-servers/

## Code Example

```typescript
// CLI command pattern (see src/commands/*.ts)
cli.command("init", "Initialize OpenCodeKit").option("--force", "Reinitialize").action(initCommand);
```

## Testing

- Tests live in: `src/**/*.test.ts` (colocated)
- Run single: `vitest src/commands/init.test.ts`
- Verify: `npm run typecheck && npm run lint`

## Boundaries

- **Always**: Run lint before commit, validate with zod schemas
- **Ask first**: Schema changes, new dependencies, .opencode/ structure changes
- **Never**: Commit secrets, force push main, modify dist/ directly

## Beads Integration

```bash
br ready              # Find unblocked work
br update <id> --status in_progress  # Claim
br close <id> --reason="..."         # Complete
br sync --flush-only  # Export changes to JSONL (then git commit/push)
```

## Gotchas

- Build copies .opencode/ to dist/template/ - don't edit dist/ directly
- oxlint enforces linting - run `npm run lint:fix` before commit
- Node.js >= 20.19.0 required (`engines.node` in package.json)

## Memory System

4-tier automated knowledge pipeline backed by SQLite + FTS5 (porter stemming).

**Pipeline:** messages → capture → distillations (TF-IDF) → observations (curator) → LTM injection (system.transform)

### Memory Tools

```bash
# Search observations (FTS5)
memory-search({ query: "auth" })

# Get full observation details
memory-get({ ids: "42,45" })

# Create observation
observation({ type: "decision", title: "Use JWT", narrative: "..." })

# Update memory file
memory-update({ file: "research/findings", content: "..." })

# Read memory file
memory-read({ file: "research/findings" })

# Admin operations
memory-admin({ operation: "status" })
memory-admin({ operation: "capture-stats" })
memory-admin({ operation: "distill-now" })
memory-admin({ operation: "curate-now" })
```

### Directory Structure

```
.opencode/memory/
├── project/           # Tacit knowledge (auto-injected)
│   ├── user.md        # User preferences
│   ├── tech-stack.md  # Framework, constraints
│   └── gotchas.md     # Footguns, warnings
├── research/          # Research notes
├── handoffs/          # Session handoffs
└── _templates/        # Document templates
```

<!-- opensrc:start -->

## Source Code Reference

Source code for dependencies is available in `opensrc/` for deeper understanding of implementation details.

See `opensrc/sources.json` for the list of available packages and their versions.

Use this source code when you need to understand how a package works internally, not just its types/interface.

### Fetching Additional Source Code

To fetch source code for a package or repository you need to understand, run:

```bash
npx opensrc <package>           # npm package (e.g., npx opensrc zod)
npx opensrc pypi:<package>      # Python package (e.g., npx opensrc pypi:requests)
npx opensrc crates:<package>    # Rust crate (e.g., npx opensrc crates:serde)
npx opensrc <owner>/<repo>      # GitHub repo (e.g., npx opensrc vercel/ai)
```

<!-- opensrc:end -->
