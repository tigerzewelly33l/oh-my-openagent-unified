# OpenCode Plugins

Plugins in this directory extend OpenCode with project-specific behavior and tools.

## Current Plugin Files

```text
plugin/
├── memory.ts           # 4-tier automated memory system (capture → distill → curate → inject)
├── copilot-auth.ts     # GitHub Copilot provider/auth integration
├── stitch.ts           # Google Stitch UI generation (8 tools via @google/stitch-sdk)
└── lib/
    ├── memory-tools.ts       # 6 core memory tools (observation, search, get, read, update, timeline)
    ├── memory-admin-tools.ts # Admin tool (memory-admin: 9 operations)
    ├── memory-hooks.ts       # All hooks (event, idle, transforms, compaction)
    ├── memory-helpers.ts     # Constants, compaction utilities, formatting
    ├── memory-db.ts          # Barrel re-export for db/ modules
    ├── capture.ts            # message.part.updated → temporal_messages
    ├── distill.ts            # TF-IDF extraction, key sentence selection
    ├── curator.ts            # Pattern-based knowledge extraction
    ├── context.ts            # Token budget enforcement via messages.transform
    ├── inject.ts             # Relevance-scored LTM injection via system.transform
    ├── notify.ts             # Cross-platform notification helpers
    └── db/
        ├── types.ts          # All types + MEMORY_CONFIG
        ├── schema.ts         # SQL schema, migrations, DB singleton
        ├── observations.ts   # Observation CRUD + FTS5 search
        ├── pipeline.ts       # Temporal messages + distillations + relevance scoring
        └── maintenance.ts    # Memory files, FTS5, archiving, vacuum
```

## Plugin Responsibilities

- `memory.ts`
  - 4-tier automated knowledge system: temporal_messages → distillations → observations → memory_files
  - Captures messages automatically via `message.part.updated` events
  - Distills sessions on idle (TF-IDF, key sentence extraction)
  - Curates observations from distillations via pattern matching
  - Injects relevant knowledge into system prompt (BM25 _ recency _ confidence scoring)
  - Manages context window via messages.transform (token budget enforcement)
  - Merges compaction logic (beads, handoffs, project memory, knowledge)
  - Provides 7 tools: observation, memory-search, memory-get, memory-read, memory-update, memory-timeline, memory-admin

- OMO runtime ownership
  - Session browsing/search now belongs to OMO runtime tools (`session_list`, `session_read`, `session_search`, `session_info`) with temporary legacy invocation compatibility owned on the OMO side.
  - Skill MCP execution now belongs to OMO `skill_mcp`, including temporary legacy `skill_name=` compatibility where unambiguous.
  - `skill_mcp_status` and `skill_mcp_disconnect` are deprecated / unsupported in canonical OMO runtime guidance.
  - If preserved project content still references the removed OCK runtime surfaces, `ock status` / `ock doctor` should warn explicitly during the bridge window.

- `copilot-auth.ts`
  - Handles GitHub Copilot OAuth/device flow
  - Adds model/provider request shaping for compatible reasoning behavior

- `stitch.ts`
  - Google Stitch UI generation via `@google/stitch-sdk`
  - 8 tools: create_project, get_project, list_projects, list_screens, get_screen, generate_screen, edit_screens, generate_variants
  - Direct HTTP to `stitch.googleapis.com/mcp` (no MCP subprocess)
  - Auth: STITCH_API_KEY or STITCH_ACCESS_TOKEN env var

## Notes

- OpenCode auto-discovers every `.ts` file in `plugin/` as a plugin — keep helper modules in `lib/`
- Keep plugin documentation aligned with actual files in this directory
- Prefer shared helpers in `lib/` over duplicated utilities across plugins

## References

- OpenCode plugin docs: https://opencode.ai/docs/plugins/
- OpenCode custom tools docs: https://opencode.ai/docs/custom-tools/
