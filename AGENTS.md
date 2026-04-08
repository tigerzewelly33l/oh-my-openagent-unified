# WORKSPACE KNOWLEDGE BASE

**Generated:** 2026-04-08  
**Scope:** `/work/ock-omo-system`

## OVERVIEW

This workspace root is a coordination container, not a single product runtime. It holds two separate TypeScript products with different toolchains, conventions, and AGENTS hierarchies: `oh-my-openagent/` and `opencodekit-template/`.

## STRUCTURE

```text
/work/ock-omo-system/
├── oh-my-openagent/       # Bun-based OpenCode plugin + CLI runtime
└── opencodekit-template/  # Node-based CLI + distributed .opencode template
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Plugin runtime, hooks, tools, agents | `oh-my-openagent/` | Treat as Bun-first product with deep local AGENTS coverage |
| Template CLI, init/upgrade flow | `opencodekit-template/src/` | Node/npm toolchain, `ock` command implementation |
| Template OpenCode payload | `opencodekit-template/.opencode/` | Commands, skills, plugins, memory, config |
| Cross-product architecture questions | both product roots | Do not assume one repo's conventions apply to the other |

## WORKSPACE RULES

- Pick the target product **before** editing files.
- Do not treat the workspace root as a runnable monorepo; there is no shared root package manifest.
- Do not apply Bun-only guidance from `oh-my-openagent/` to `opencodekit-template/`.
- Do not apply npm/Node validation guidance from `opencodekit-template/` to `oh-my-openagent/`.
- Prefer the nearest child `AGENTS.md` over this file whenever one exists.

## TOOLCHAIN SPLIT

| Product | Runtime | Primary commands |
|---------|---------|------------------|
| `oh-my-openagent/` | Bun | `bun run typecheck`, `bun test`, `bun run build` |
| `opencodekit-template/` | Node/npm scripts | `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` |

## ANTI-PATTERNS

- Do not make workspace-wide edits assuming both trees share one architecture.
- Do not add root-level instructions that duplicate stronger child AGENTS hierarchies.
- Do not run verification from the workspace root unless the command is explicitly root-scoped.
- Do not move files between the two product roots casually; each tree has its own packaging and runtime assumptions.

## NOTES

- `oh-my-openagent/` already has extensive nested AGENTS coverage; add child files there sparingly.
- `opencodekit-template/` has shallower child coverage; shared domains under `src/` and `.opencode/skill/` benefit most from local guidance.
