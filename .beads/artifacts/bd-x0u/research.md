# Research: bd-x0u - OMO bead/process adapter

## Questions Asked

1. What is the correct durable implementation target for the OMO bead/process adapter work?
2. How is the bead-first workflow supposed to interact with OmO in this environment?
3. Which local files are the strongest current evidence for process and skill behavior?
4. Which previously explored targets should be treated as non-durable and rejected?

## Key Findings

### Durable Local OmO Source

- Path: `/root/.config/opencode/omo`
- Repository state: real git checkout (`git rev-parse --is-inside-work-tree` returned `true`)
- Current branch: `dev`
- Package identity: `oh-my-opencode` version `3.15.3`
- Main package entry: `dist/index.js`
- Confirmed source seams: `src/index.ts`, `src/plugin-config.ts`
- Confirmed repo guidance: `AGENTS.md`

### Runtime Wiring

The active OpenCode runtime config at `/root/.config/opencode/opencode.json` loads the plugin from the exact local file path:

- `plugin` includes `file:///root/.config/opencode/omo`

This is the strongest runtime proof that the editable local repo, not an installed package copy, is the intended execution target for customization work.

### Local OmO Repo Shape

The local OmO source tree is a full implementation repo, not just a generated config folder or installed package dump.

Observed evidence:

- `package.json` identifies the package as `oh-my-opencode`
- `src/` exists and includes `src/index.ts` and `src/plugin-config.ts`
- `dist/` exists as built output
- `README.md` exists with installation and compatibility guidance
- `AGENTS.md` exists and documents where the important implementation seams live
- Repo-local OpenCode assets exist under `.opencode/command/` and `.opencode/skills/`

### OCK Bead-First Contract Still Lives at the Root

The local OmO repo is the implementation target, but durable workflow state is still bead-first and root-owned:

1. `/create` creates the bead and PRD
2. `/research` records findings under `/.beads/artifacts/<bead-id>/`
3. `/start` claims the bead and prepares the branch or workspace
4. `/plan` writes implementation planning artifacts
5. `/ship` performs implementation, verification, and review
6. `/pr` packages the branch for review

For `bd-x0u`, that means `/.beads` remains the durable ledger while `/root/.config/opencode/omo` is the code target.

### Rejected Non-Durable Targets

The earlier exploration established two targets that should not remain authoritative for this bead:

1. `/root/.bun/install/global/node_modules/opencodekit`
   - Useful only as historical exploration context
   - Not the durable source repo for the customization work we want
2. `/root/.cache/opencode/packages/**`
   - Cache-owned package copies
   - Fragile and overwrite-prone
   - Incorrect as a long-term customization target

The bead should explicitly treat those paths as rejected implementation targets.

## Recommendations

1. Keep `bd-x0u` scoped to `/root/.config/opencode/omo` plus bead artifacts under `/.beads/artifacts/bd-x0u/`
2. Use `/root/.config/opencode/opencode.json` only as runtime evidence that the plugin is loaded from `file:///root/.config/opencode/omo`
3. Start detailed implementation tracing from `AGENTS.md`, `src/index.ts`, and `src/plugin-config.ts`
4. Preserve the root bead-first contract as the acceptance surface and avoid moving durable workflow state into OmO-local storage
5. Treat Bun-installed and cache paths as historical dead ends, not current targets

## Open Items

1. Detailed read of `src/index.ts` to identify exact process-composition seams
2. Detailed read of `src/plugin-config.ts` to identify config and compatibility seams relevant to OCK mode
3. Determination of whether repo-local `.opencode` assets inside the OmO repo need direct tailoring for the bead-first loop
4. Identification of the narrowest code path that needs to change for OCK alignment

## Next Steps

1. Generate or update planning artifacts so all affected files point to `/root/.config/opencode/omo`
2. Trace the local plugin entry and config-loading path from `src/index.ts` and `src/plugin-config.ts`
3. Decide the smallest implementation boundary that makes OmO fit OCK without changing the OCK contract itself
4. Keep bead artifacts explicit so future work cannot drift back to Bun-installed or cache-only copies
