# skill/ — Shared Skill Library

## OVERVIEW

This directory is the reusable skill corpus for the OpenCode template. It contains workflow skills, domain skills, reference-heavy skill packs, and a few generated/compiled skill projects. Keep this layer focused on reusable procedures and reference material, not on top-level command orchestration.

## STRUCTURE

```text
skill/
├── beads/                        # Beads workflow + references
├── swarm-coordination/           # multi-agent orchestration references
├── writing-plans/                # planning procedure skills
├── verification-before-completion/
├── react-best-practices/         # generated/compiled skill project
├── supabase-postgres-best-practices/ # generated/compiled skill project
└── many single-purpose domain skills
```

## WHEN TO ADD CHILD AGENTS

Add a deeper `AGENTS.md` only when a skill subtree is itself a mini-project, for example:
- generated skill packs with build/validate pipelines
- large reference corpora with special file naming rules
- subtrees with their own source/build artifacts in addition to markdown content

Most ordinary leaf skills should inherit from this file and from `.opencode/AGENTS.md`.

## CONVENTIONS

- Skills hold reusable procedures; commands define user workflows.
- Keep one coherent home per concept. Do not create duplicate skills with overlapping names and scope.
- Prefer adding references/examples inside an existing relevant skill before inventing a new sibling skill.
- Preserve directory-local structure when present: `references/`, `rules/`, `_template.md`, metadata files, or compiled `AGENTS.md` outputs.
- For generated skill projects such as `react-best-practices/`, treat source inputs as authoritative and generated `AGENTS.md` as derived output.

## ANTI-PATTERNS

- Do not dump command-specific behavior into a skill when it belongs in `.opencode/command/`.
- Do not create shallow wrapper skills that only restate another skill.
- Do not edit generated `AGENTS.md` outputs directly when the subtree has a documented build pipeline.
- Do not mix canonical procedures with scratch notes; references should be curated and stable.
- Do not assume all skill subtrees share the same maintenance model; some are plain markdown, others are generated corpora.

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Workflow/task-state procedures | `beads/`, `beads-bridge/`, `verification-before-completion/` | operational skills |
| Planning and execution method | `writing-plans/`, `executing-plans/`, `subagent-driven-development/` | reusable process skills |
| Large generated knowledge packs | `react-best-practices/`, `supabase-postgres-best-practices/` | check local README/AGENTS before editing |
| Reference-heavy orchestration docs | `swarm-coordination/references/`, `cloudflare/references/` | maintain structure carefully |

## VERIFICATION

- Run the package-level governance checks when changing many skills or skill docs:

```bash
npm run validate:skill-lint
npm run validate:governance
```
