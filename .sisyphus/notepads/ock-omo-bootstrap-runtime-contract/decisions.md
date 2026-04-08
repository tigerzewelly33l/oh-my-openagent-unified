2026-04-08
- Chose `.opencode/oh-my-openagent.jsonc` as the single canonical bridge artifact for fresh OCK installs because OMO already prefers JSONC over JSON when detecting plugin config basenames, and no parser constraint in the current loader required falling back to plain JSON.
- Kept plugin registration canonicalization in `.opencode/opencode.json` as bridge-controlled output rather than shipping a second template-only source of truth, so both init and upgrade can deterministically converge fresh installs onto `oh-my-openagent` without dual-writing legacy names.

2026-04-08
- Made `.opencode/oh-my-openagent.jsonc` a template-owned root artifact instead of a code-only emitted file so upgrade ownership/prune logic can keep the canonical bridge config refreshable while still deleting obsolete bridge-owned files during `--prune-all`.

2026-04-08
- Chose the no-wrapper outcome for Task 7. The slice acceptance is already satisfied by OCK-owned bootstrap/upgrade contract tests plus direct OMO runtime execution, and adding `ock run` here would either duplicate OMO `run` semantics or create a fragile proxy surface that this bridge slice explicitly avoids.
- Recorded the decision in `opencodekit-template/src/index.test.ts` instead of `src/index.ts` so Task 8 can verify the contract mechanically while the shipped OCK CLI surface stays unchanged.

2026-04-08
- Tightened the no-wrapper proof to a source-level CLI contract instead of a runtime import check. This keeps verification focused on the shipped OCK command registration declared in `src/index.ts` while avoiding entrypoint side effects from `void parseCli(cli)` during tests.
