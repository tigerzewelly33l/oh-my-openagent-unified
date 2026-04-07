# OpenCode Plugins

Plugins in this directory extend OpenCode with project-specific behavior and tools.

## Current Plugin Files

```text
plugin/
├── memory.ts           # 4-tier automated memory system (capture → distill → curate → inject)
├── sessions.ts         # Session search tools (find/read)
├── copilot-auth.ts     # GitHub Copilot provider/auth integration
├── stitch.ts           # Google Stitch UI generation (8 tools via @google/stitch-sdk)
├── skill-mcp.ts        # Skill-scoped MCP bridge (skill_mcp tools)
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

- `sessions.ts`
  - Provides tools: `find_sessions`, `read_session`
  - Direct SQLite access to OpenCode's session DB
  - Multi-word AND search with relevance ranking
  - 180-day time-bounded search
  - Agentic `nextStep` guidance in results

- `skill-mcp.ts`
  - Loads MCP configs from skills
  - Exposes `skill_mcp`, `skill_mcp_status`, `skill_mcp_disconnect`
  - Supports tool filtering with `includeTools`

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
