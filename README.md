# oh-my-openagent-unified

This repository is a unified workspace snapshot containing two product roots:

- `oh-my-openagent/` — the Bun-based OpenCode plugin/runtime and CLI
- `opencodekit-template/` — the Node/npm-based template CLI and distributed `.opencode` payload

## Where to start

- Runtime, hooks, tools, and agents: `oh-my-openagent/`
- Bootstrap/init/upgrade CLI and template payload: `opencodekit-template/`
- Architecture and planning artifacts: `MVP.md`, `.sisyphus/`, and `.beads/`

## Product-specific commands

### oh-my-openagent

```bash
cd oh-my-openagent
bun run typecheck
bun test
bun run build
```

### opencodekit-template

```bash
cd opencodekit-template
npm run typecheck
npm run lint
npm run test
npm run build
```

## Notes

- The workspace root is a coordination container, not a runnable monorepo.
- Prefer the nearest `AGENTS.md` inside each product subtree before making changes.
