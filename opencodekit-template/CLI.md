# `ock` CLI Reference

OpenCodeKit provides a Bun-based CLI for managing OpenCode template configuration.

## Install / Run

```bash
# Local development
bun install
bun run src/index.ts --help

# After build
npm run build
node dist/index.js --help
```

## Top-Level Commands

The current command surface from `src/index.ts`:

- `ock init`
- `ock agent [action]`
- `ock command [action]`
- `ock doctor`
- `ock status`
- `ock config [action]`
- `ock upgrade`
- `ock completion [shell]`
- `ock tui`

## Command Details

### `ock init`

Initialize OpenCodeKit in the current directory.

Options:

- `--force`
- `--beads`
- `--global`
- `--free`
- `--recommend`
- `-y, --yes`
- `--backup`
- `--prune`
- `--prune-all`

### `ock agent [action]`

Manage agent files.

Actions:

- `list`
- `create`
- `view`
- `remove`

### `ock command [action]`

Manage slash-command markdown files under `.opencode/command/`.

Actions:

- `list`
- `create`
- `show`
- `delete`

### `ock doctor`

Run project health checks.

### `ock status`

Show a project overview.

### `ock config [action]`

Manage `opencode.json` configuration (model/provider/MCP/permissions and validation helpers).

### `ock upgrade`

Update `.opencode/` template files to latest repository state.

Options:

- `--force`
- `--check`
- `--prune`
- `--prune-all`

### `ock completion [shell]`

Generate shell completion scripts for `bash`, `zsh`, or `fish`.

### `ock tui`

Launch the interactive terminal dashboard.

## Global Options

- `--verbose`
- `--quiet`
- `--version`
- `--help`

## Useful Development Scripts

```bash
npm run typecheck
npm run lint
npm run lint:fix
npm run test
npm run build
npm run compile
npm run compile:binary
```

## Notes

- This CLI targets Bun (`engines.bun >= 1.3.2`).
- Command behavior is implemented in `src/commands/`.
- Slash command content (inside OpenCode) lives in `.opencode/command/` and is separate from `ock` CLI commands.
