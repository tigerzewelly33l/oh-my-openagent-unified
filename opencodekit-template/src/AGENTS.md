# src/ — OpenCodeKit CLI Implementation

## OVERVIEW

This subtree is the implementation of the `ock` CLI, separate from the distributed `.opencode/` template payload. Keep CLI behavior, command registration, license gates, TUI flows, and validation utilities here; do not mix them with template-runtime content.

## STRUCTURE

```text
src/
├── index.ts         # CAC entrypoint, command registration, default menu
├── commands/        # init, upgrade, agent, command, config, patch, completion
├── tui/             # interactive dashboard/UI flows
├── validation/      # governance and docs-drift checks
└── utils/           # CLI support helpers
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add or change a CLI command | `src/commands/` | Keep command behavior focused and user-facing |
| Register top-level CLI surface | `src/index.ts` | CAC command definitions live here |
| TUI behavior | `src/tui/` | Separate from plain shell-command flows |
| Docs/skill/command governance | `src/validation/` | Run validation scripts after changes |

## CONVENTIONS

- Root package validation is npm-script based: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.
- Treat `src/` as Node CLI code even if other docs mention Bun compatibility.
- Keep command handlers in `src/commands/`; `src/index.ts` should stay focused on registration and wiring.
- Preserve the split between CLI implementation and template payload under `.opencode/`.
- `init` and `upgrade` are license-gated and manage filesystem/template state; changes here need extra care around preservation and overwrite rules.

## ANTI-PATTERNS

- Do not edit `dist/` directly; build regenerates distributable output.
- Do not move template-authoring logic from `.opencode/` into `src/` just because the CLI touches it.
- Do not add new commands without updating validation/governance expectations.
- Do not assume test coverage is absent; this subtree uses Vitest with colocated `src/**/*.test.ts` files.
- Do not duplicate command registration logic in multiple files; keep the authoritative command surface in `src/index.ts`.

## VERIFICATION

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run validate:governance   # when changing commands, docs, or skills
```
