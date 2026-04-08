# Memory and Context Ownership Audit

**Bead:** bd-l1s  
**Phase:** 1 (Reset)  
**Artifact:** 05-memory-context-audit.md  
**Status:** Active

---

## Audit Schema

| Field | Value |
|-------|-------|
| Question | Where does durable memory storage live vs runtime context injection, and what transformation/mutation risks exist? |
| Current Behavior | See Durable Memory Storage and Runtime Context Injection sections |
| Claimed Behavior | Project-memory claims about unified memory system (QUARANTINED) |
| Evidence | Source file analysis from context-injector/, memory.ts, opencode-skill-loader/ |
| Contradictions | See Transformation and Collection section |
| Authority Candidates | Split: OCK owns durable memory (SQLite/FTS5), OMO owns runtime context injection |
| Unresolved Questions | See below |
| Confidence | High |
| Gate Impact | Non-Blocking |

---

## Durable Memory Storage

### OCK (opencodekit-template/) — Durable Memory

**SQLite + FTS5 Memory System:**
- Location: `.opencode/memory/` directory
- Database: `.opencode/memory/memory.db` (SQLite with FTS5 for full-text search)
- 4-tier pipeline: messages → capture → distillations (TF-IDF) → observations (curator) → LTM injection

**Evidence:**
- `opencodekit-template/.opencode/plugin/memory.ts:1-28` — Unified Memory Plugin v2 architecture
- `opencodekit-template/.opencode/plugin/lib/memory-db.ts` — SQLite + FTS5 integration
- Tools: observation, memory-search, memory-get, memory-read, memory-update, memory-timeline, memory-admin

**Project Memory Files:**
- `.opencode/memory/project/user.md` — User preferences
- `.opencode/memory/project/tech-stack.md` — Framework, constraints
- `.opencode/memory/project/gotchas.md` — Footguns, warnings
- `.opencode/memory/project/project.md` — Architecture charter (QUARANTINED)
- `.opencode/memory/project/roadmap.md` — Phase/gate roadmap (QUARANTINED)
- `.opencode/memory/project/state.md` — Steering state (QUARANTINED)

**Evidence:**
- `opencodekit-template/AGENTS.md:247-270` — Memory System documentation
- `.opencode/memory/handoffs/` — Session handoffs directory

### OMO (oh-my-openagent/) — Durable Memory

**No Observed Durable Memory System:**
- No SQLite database for memory
- No FTS5 search
- No project-memory files

**Evidence:**
- `glob oh-my-openagent/**/memory*.ts` — only context-injector, no memory plugin
- `grep -r "memory.db" oh-my-openagent/` — no matches
- `ls oh-my-openagent/.opencode/memory/` — does not exist

---

## Runtime Context Injection

### OMO (oh-my-openagent/) — Runtime Context Injection

**Context Injector System:**
- `src/features/context-injector/` — Runtime context injection into LLM messages
- Priority-based: critical, high, normal, low
- Merge order: priority → registration order

**Evidence:**
- `src/features/context-injector/injector.ts:17-39` — injectPendingContext() function
- `src/features/context-injector/collector.ts:22-40` — ContextCollector.register()
- Hook: `experimental.chat.messages.transform` — injects pending context into chat messages

**AGENTS.md Injection:**
- Automatically injects project AGENTS.md into context
- Source file: `src/features/context-injector/injector.ts`

**Evidence:**
- `src/features/opencode-skill-loader/index.ts` — loads SKILL.md files from 4 scopes
- `src/features/context-injector/types.ts` — ContextPriority, ContextEntry interfaces

**Skill Context Loading:**
- 4-scope skill loading: project > opencode > user > global
- YAML frontmatter parsing from SKILL.md files

**Evidence:**
- `src/features/opencode-skill-loader/index.ts` — SkillLoader class
- `src/features/opencode-skill-loader/types.ts` — SkillScope, SkillManifest

### OCK (opencodekit-template/) — Runtime Context Injection

**LTM Injection (Long-Term Memory):**
- System hook: `system.transform` → relevance-scored knowledge injection
- Context window management via `messages.transform`

**Evidence:**
- `opencodekit-template/.opencode/plugin/memory.ts:10` — "LTM Injection — system.transform → relevance-scored knowledge"
- `opencodekit-template/.opencode/plugin/lib/inject.ts` — LTM relevance scoring + injection
- `opencodekit-template/.opencode/plugin/lib/context.ts` — Context window management

**Session Idle Triggers:**
- Distillation: session.idle → TF-IDF compression
- Curator: session.idle → pattern-matched observations

**Evidence:**
- `opencodekit-template/.opencode/plugin/memory.ts:8-9` — distillation and curator triggers
- `opencodekit-template/.opencode/plugin/lib/distill.ts` — Heuristic distillation engine
- `opencodekit-template/.opencode/plugin/lib/curator.ts` — Pattern-based knowledge extraction

---

## Transformation and Collection

| Aspect | OCK | OMO | Collision Risk |
|--------|-----|-----|----------------|
| **Storage** | SQLite + FTS5 (durable) | None (runtime only) | Low — different paradigms |
| **Injection** | LTM (system.transform) | ContextInjector (chat.messages.transform) | Medium — both inject context |
| **Collection** | session.idle → TF-IDF + curator | context-injector priority system | Low — different triggers |
| **Scope Loading** | Project > opencode > user > global | Project > opencode > user > global | None — identical |
| **Project Memory** | .opencode/memory/project/ | None | Low — OCK-only |

**Transformation Risks:**
- **Dual Injection Paths**: OCK has system.transform + messages.transform; OMO has experimental.chat.messages.transform — potential context duplication
- **Query Authority**: Both systems claim to inject relevant context, but no coordination exists
- **Memory Overlap**: OCK stores in SQLite, OMO stores nothing durable — separation is clean

**Evidence:**
- `opencodekit-template/.opencode/plugin/memory.ts:10` — LTM via system.transform
- `oh-my-openagent/src/features/context-injector/injector.ts:75-80` — experimental.chat.messages.transform hook

---

## Authority Candidates

### Clearly OCK
- SQLite + FTS5 memory storage (`.opencode/memory/memory.db`)
- Durable project memory files (`.opencode/memory/project/*.md`)
- Memory tools: observation, memory-search, memory-get, memory-read, memory-update, memory-timeline, memory-admin
- LTM injection (system.transform)
- Distillation and curation (session.idle triggers)

### Clearly OMO
- Runtime context injection via ContextCollector
- AGENTS.md injection into LLM context
- Skill loading from 4 scopes
- Priority-based context ordering (critical/high/normal/low)

### Genuinely Split
- Context injection authority — both systems inject into LLM context but at different hook points
- Skill loading — both use 4-scope system but OMO uses it for runtime context, OCK for durable memory

### Still Ambiguous
- Should OMO adopt SQLite-based memory?
- Can OMO's ContextCollector integrate with OCK's LTM injection?
- Is there value in unified context pipeline?

---

## Unresolved Questions

1. **Memory Storage** — Should OMO adopt SQLite memory or keep runtime-only context?
2. **Injection Coordination** — Can context-injector and LTM injection coexist without conflict?
3. **Skill Loading** — Should OMO expose OCK-style memory tools to agents?
4. **Scope Merging** — Should project-memory files be auto-injected by OMO?

---

## Gate Impact

**Non-Blocking** — Memory authority is split but non-conflicting. OCK owns durable memory (SQLite/FTS5), OMO owns runtime context injection (priority-based). No blocking contradictions exist. The question of whether to unify these systems should be resolved in Phase 2 architecture work.

---

## Next Steps

This audit feeds into the contradiction synthesis (08):
- Durable memory: clearly OCK-owned
- Runtime context injection: clearly OMO-owned
- No blocking conflicts — different paradigms with coordination opportunities