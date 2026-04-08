2026-04-08
- Extracted `opencodekit-template/src/commands/init.ts` into a thin orchestrator with focused helpers under `src/commands/init/` to keep future bridge work off the command surface.
- Safe seams for this plan were: path/global-config detection (`paths.ts`), template copy/exclusion rules (`files.ts`), model preset prompting (`models.ts`), reinit/preserve/orphan handling (`reinit.ts`), and runtime side effects like `.beads` init plus dependency installation (`runtime.ts`).
- Kept `init.ts` exporting `preserveUserFiles`, `finalizeInstalledFiles`, and `findOrphans` so the existing `init-upgrade` regression test continues validating the same public helper contract.
- Added a dedicated `emitCanonicalBridgeArtifactsScaffold()` seam in `runtime.ts` as a no-op extraction boundary so later bridge artifact emission can land without growing `init.ts` again.
- Follow-up cleanup: per-item patch summary output in `src/commands/init/reinit.ts` should use `p.log.info(...)` instead of raw `console.log(...)` to stay consistent with the command stack’s prompt-safe logging pattern.
- Extracted `opencodekit-template/src/commands/upgrade.ts` into focused upgrade helpers under `src/commands/upgrade/` so bridge ownership, preserve/prune rules, and bridge refresh decisions are isolated behind narrow seams without changing the `ock upgrade` command surface.
- Preserved the public regression-test contract by continuing to export `copyDirWithPreserve` and `findUpgradeOrphans` from `upgrade.ts` while moving their implementations into helper modules.
- Added `refreshBridgeArtifactsScaffold()` plus `getTemplateOwnedBridgeFiles()` as no-op bridge seams so future canonical runtime bridge files can become template-owned without reopening upgrade copy/prune logic.

2026-04-08
- The canonical OCK→OMO bootstrap contract now lives at `.opencode/oh-my-openagent.jsonc`; fresh init and upgrade both rewrite that root-level file via the extracted bridge seams instead of relying on preserved subdirectories.
- `emitCanonicalBridgeArtifactsScaffold()` and `refreshBridgeArtifactsScaffold()` now also canonicalize `.opencode/opencode.json` plugin registration to `oh-my-openagent`, replacing legacy `oh-my-opencode` entries without dual-writing both names for fresh installs.
- The required smoke path surfaced an existing non-interactive init gap: `ock init --yes` still prompted for the scaffold project name. Fixed by making `resolveProjectName()` short-circuit under `--yes`, which keeps command behavior intact for interactive runs while letting CI-style bootstrap validation complete.
- Added explicit OMO runtime contract tests in `oh-my-openagent/src/plugin-config.test.ts` proving project config loads from canonical `.opencode/oh-my-openagent.jsonc`, still loads from legacy `.opencode/oh-my-opencode.jsonc`, prefers the canonical basename when both files exist, and keeps `mcp_env_allowlist` sourced only from user config.

2026-04-08
- The canonical bridge config must exist as a real template file at `opencodekit-template/.opencode/oh-my-openagent.jsonc`, not only as a runtime-emitted synthetic artifact; otherwise `ock upgrade --prune-all` sees it as an orphan because orphan detection compares against template contents.
- Keeping init and upgrade bridge refresh logic sourced from the template-owned root file preserves the Task 3 contract for `--project-only` while making the canonical bridge file refreshable and prune-safe during forced upgrades.

2026-04-08
- Extended `opencodekit-template/src/commands/init-upgrade.test.ts` with direct OCK contract cases that prove project-only/global-overlap still leaves `.opencode/oh-my-openagent.jsonc` locally managed, and that upgrade orphan pruning removes obsolete bridge files without deleting the canonical bridge config.
- Dependency-install semantics for this slice can be tested deterministically without touching production code by prepending a temp fake `npm` binary to `PATH`; that keeps the assertions focused on `installEmbeddedDependencies()` return values rather than machine-specific package manager behavior.

2026-04-08
- Task 7 does not require an OCK-side runtime wrapper: OCK already proves the front door through `ock init`/`ock upgrade` emitting the canonical bridge artifacts, while OMO exclusively owns `run` semantics such as attach-versus-port validation, server/session lifecycle, SIGINT handling, completion polling, and JSON output.
- A minimal executable proof for the no-wrapper path is an OCK contract test that locks the CLI surface to bootstrap commands and explicitly asserts `run` is absent, giving downstream verification a mechanical check without cloning OMO runtime behavior into OCK.

2026-04-08
- The reviewer follow-up showed that importing the side-effectful CLI entrypoint just to inspect `cli.commands` is too weak and noisy for this boundary. A stronger OCK-side proof is to read `src/index.ts` as source and assert the complete allowed command registration set.
- The strengthened Task 7 test now fails on any command-surface drift toward runtime ownership, not only on a literal `run` addition: it locks the exact OCK bootstrap/management commands and separately rejects runtime-adjacent names like `run`, `resume`, `session`, `attach`, `serve`, and `server`.
