# Copilot Instructions for OpenCodeKit

> **Trust these instructions first.** Only search if info here is incomplete or wrong.

## What This Is

OpenCodeKit is a Node.js + TypeScript CLI and template for bootstrapping and managing OpenCode multi-agent projects.

- **Language**: TypeScript
- **Runtime**: Node.js >= 20.19.0
- **Package Manager**: npm-script workflow
- **Output**: CLI tool (`ock`) + bundled `.opencode/` template distribution

---

## Commands That Work

```bash
# Install dependencies
npm install

# Type check (run before any commit)
npm run typecheck

# Lint
npm run lint

# Test
npm run test

# Build CLI + template
npm run build

# Dev mode
npm run dev -- --help
```

Validation should cover typecheck, lint, test, build, and governance checks when docs or template content change.

---

## Project Layout

```
/
├── src/                    # CLI source (TypeScript)
│   ├── index.ts           # Entry point
│   ├── commands/          # CLI commands (init, activate, license, config, doctor, status, upgrade, patch)
│   └── utils/             # Shared utilities
├── .opencode/             # Template content (distributed to users)
│   ├── agent/*.md         # 9 agent definitions
│   ├── command/*.md       # 19 workflow commands
│   ├── skill/*/SKILL.md   # reusable skill library
│   ├── tool/*.ts          # template-local tools (`context7`, `grepsearch`)
│   ├── plugin/            # Template plugins (`memory.ts`, `copilot-auth.ts`, `stitch.ts`)
│   ├── memory/            # Memory system (SQLite + templates)
│   ├── opencode.json      # Main config
│   └── AGENTS.md          # Global rules
├── package.json           # CLI scripts, dependencies, version
├── tsconfig.json          # TypeScript config
└── tsdown.config.ts       # Build configuration
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
| `tsdown.config.ts`        | Build configuration            |

---

## Validation Before Commit

```bash
# 1. Type check (REQUIRED)
npm run typecheck

# 2. Lint (REQUIRED)
npm run lint

# 3. Tests (REQUIRED)
npm run test

# 4. Build succeeds (REQUIRED)
npm run build

# 5. Governance checks when docs/skills/commands changed
npm run validate:governance

# 6. Manual CLI smoke test when changing CLI behavior
npm run dev -- --help
```

---

## GitHub Workflows

| Workflow                   | Trigger      | Purpose          |
| -------------------------- | ------------ | ---------------- |
| `opencode.yml`             | Push to main | Publishes to npm |
| `discord-notification.yml` | Release      | Notifies Discord |

Local validation is still required before proposing completion; do not rely on CI alone.

---

## Common Gotchas

1. **Use npm scripts for verification** - this project validates with `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`
2. **Tests do exist** - Vitest lives in `src/**/*.test.ts`
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

- ❌ Don't assume Bun runtime or Bun-only commands in this repo
- ❌ Don't add Windows-specific code
- ❌ Don't commit `.env` files or secrets
- ❌ Don't modify `node_modules/` or `dist/`
- ❌ Don't skip `npm run typecheck`, `npm run lint`, and relevant tests before completion claims
- ❌ Don't use relative paths in tool code (use absolute)

---

## Quick Reference

```bash
# Full validation sequence
npm install && npm run typecheck && npm run lint && npm run test && npm run build

# Test CLI locally
npm run dev -- --help
npm run dev -- init my-test --yes

# Version bump
# Edit package.json version, then:
git add -A && git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z && git push origin main --tags
```
