# Copilot Instructions for OpenCodeKit

> **Trust these instructions first.** Only search if info here is incomplete or wrong.

## What This Is

OpenCodeKit is a multi-agent AI development framework template. It provides agents, skills, commands, and tools for AI-assisted coding with OpenCode.

- **Language**: TypeScript (Bun runtime)
- **Package Manager**: Bun (not npm)
- **Size**: ~100 files, ~10k lines
- **Output**: CLI tool (`ock`) + template distribution

---

## Commands That Work

```bash
# Install dependencies (ALWAYS run first)
bun install

# Type check (run before any commit)
bun run typecheck

# Build CLI + template
bun run build

# Dev mode
bun run dev

# Compile binary
bun run compile
```

**⚠️ No test suite exists.** Validation is via `bun run typecheck` only.

---

## Project Layout

```
/
├── src/                    # CLI source (TypeScript)
│   ├── index.ts           # Entry point
│   ├── commands/          # CLI commands (init, setup, agent, skill)
│   └── utils/             # Shared utilities
├── .opencode/             # Template content (distributed to users)
│   ├── agent/*.md         # 10 agent definitions
│   ├── command/*.md       # 14 workflow commands
│   ├── skill/*/SKILL.md   # 50+ skill definitions
│   ├── tool/*.ts          # Custom tools (memory, observation, etc)
│   ├── plugin/            # Plugins (memory-db, sessions, etc)
│   ├── memory/            # Memory system (SQLite + templates)
│   ├── opencode.json      # Main config
│   └── AGENTS.md          # Global rules
├── package.json           # Bun project config
├── tsconfig.json          # TypeScript config
└── build.ts               # Build script
```

---

## Key Files

| File                      | Purpose                        |
| ------------------------- | ------------------------------ |
| `src/index.ts`            | CLI entry point                |
| `src/commands/init.ts`    | `ock init` command             |
| `.opencode/opencode.json` | OpenCode configuration         |
| `.opencode/AGENTS.md`     | Global agent rules             |
| `package.json`            | Scripts, dependencies, version |
| `build.ts`                | Custom build script            |

---

## Validation Before Commit

```bash
# 1. Type check (REQUIRED)
bun run typecheck

# 2. Build succeeds (REQUIRED)
bun run build

# 3. Manual test if changing CLI
bun run dev -- init test-project
```

---

## GitHub Workflows

| Workflow                   | Trigger      | Purpose          |
| -------------------------- | ------------ | ---------------- |
| `opencode.yml`             | Push to main | Publishes to npm |
| `discord-notification.yml` | Release      | Notifies Discord |

**CI does NOT run tests** - only publishes. You must validate locally.

---

## Common Gotchas

1. **Use `bun`, not `npm`** - This project uses Bun runtime
2. **No tests exist** - Validate with `bun run typecheck` only
3. **Build copies `.opencode/`** - Changes to template files need rebuild
4. **Version in `package.json`** - Bump before release
5. **SQLite memory** - `.opencode/memory.db*` files are gitignored
6. **Plugin node_modules** - `.opencode/plugin/node_modules/` is gitignored

---

## File Patterns

- **Agent definitions**: `.opencode/agent/*.md` (Markdown with YAML frontmatter)
- **Commands**: `.opencode/command/*.md` (Markdown with YAML frontmatter)
- **Skills**: `.opencode/skill/*/SKILL.md` (One folder per skill)
- **Tools**: `.opencode/tool/*.ts` (TypeScript)
- **Plugins**: `.opencode/plugin/*.ts` (TypeScript)

---

## Don't Do These

- ❌ Don't use `npm` commands (use `bun`)
- ❌ Don't add Windows-specific code
- ❌ Don't commit `.env` files or secrets
- ❌ Don't modify `node_modules/` or `dist/`
- ❌ Don't skip `bun run typecheck` before commits
- ❌ Don't use relative paths in tool code (use absolute)

---

## Quick Reference

```bash
# Full validation sequence
bun install && bun run typecheck && bun run build

# Test CLI locally
bun run dev -- --help
bun run dev -- init my-test

# Version bump
# Edit package.json version, then:
git add -A && git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z && git push origin main --tags
```
