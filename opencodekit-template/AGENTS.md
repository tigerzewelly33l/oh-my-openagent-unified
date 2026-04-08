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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **opencodekit-template** (586 symbols, 1448 relationships, 49 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/opencodekit-template/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/opencodekit-template/context` | Codebase overview, check index freshness |
| `gitnexus://repo/opencodekit-template/clusters` | All functional areas |
| `gitnexus://repo/opencodekit-template/processes` | All execution flows |
| `gitnexus://repo/opencodekit-template/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
