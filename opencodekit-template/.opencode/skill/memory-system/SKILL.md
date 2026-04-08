---
name: memory-system
description: Use when persisting learnings, loading previous context, or searching past decisions - covers memory file structure, tools, and when to update each file
version: 1.1.0
tags: [context, workflow]
dependencies: []
---

# Memory System Best Practices

> **Replaces** losing context between sessions — persistent knowledge that survives session boundaries

## When to Use

- Starting work and needing prior decisions, bugfixes, or patterns
- Recording non-obvious decisions/learnings for future sessions
- Creating handoffs so the next session can continue quickly

## When NOT to Use

- Ephemeral debugging notes that won't matter after the current task
- Storing generated artifacts/log dumps as long-term memory

## Core Principle

**Progressive disclosure**: search compactly, fetch fully only when relevant, then record high-signal observations.

## Session Workflow

1. **Ground (search first)**
   - Run `memory-search` with task keywords before implementation.
   - Check recent handoffs when resuming interrupted work.
2. **Calibrate (progressive disclosure)**
   - Use search results as index.
   - Fetch full entries only for relevant IDs (`memory-get`).
   - Pull timeline context only when sequencing matters (`memory-timeline`).
3. **Record (high-signal only)**
   - Create `observation` for decisions, bugfixes, patterns, warnings, or durable learnings.
   - Include searchable concepts and concrete file references.
4. **Handoff (if session boundary)**
   - Write a concise status note with completed work, blockers, and next steps using `memory-update` under `handoffs/`.

## What Goes Where

| Store | Put Here | Avoid Here |
| --- | --- | --- |
| `observation` (SQLite) | Events: decisions, bugfixes, reusable patterns, warnings | Temporary notes, speculative ideas without evidence |
| `memory-update` files | Durable docs: handoffs, research, project notes | Every minor runtime detail from a single debug run |
| Auto pipeline | Captured messages + distillations (automatic) | Manual copying of full transcripts |

## Observation Quality Bar

Use this checklist before creating an observation:

- Is it likely useful in a future session?
- Is it non-obvious (not already in code/comments)?
- Can I summarize it in one clear title + short narrative?
- Did I include strong search terms in `concepts` and relevant files?

If most answers are "no", skip creating the observation.

## Anti-Patterns

| Anti-Pattern | Why It Fails | Instead |
| --- | --- | --- |
| Storing transient debugging info as permanent observations | Pollutes search results with low-value noise | Keep transient info in session context; record only durable findings |
| Creating observations for every small finding (signal-to-noise) | Important items get buried and retrieval quality drops | Batch minor notes; publish one distilled observation per meaningful outcome |
| Not searching memory before creating duplicate observations | Produces conflicting/duplicated records | Run `memory-search` first; update/supersede existing records when appropriate |
| Using `memory-update` for data that should be an observation | Durable events become hard to discover and rank | Use `observation` for events; reserve `memory-update` for document-style files |

## Verification

After creating an observation: `memory-search` with relevant keywords should find it.

## Practical Defaults

- Prefer specific queries over broad ones (`"auth race condition init"` > `"auth"`).
- For ongoing work, append to one handoff file per task/day instead of many tiny files.
- Keep observation titles concrete and action-oriented.

## See Also

- `context-management`
- `session-management`
