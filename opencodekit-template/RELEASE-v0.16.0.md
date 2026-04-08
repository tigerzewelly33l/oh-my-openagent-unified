# Release v0.16.0

**Release Date:** 2026-02-01

## Highlights

This release introduces **contextual skill loading** for agents and consolidates commands from 40+ to a focused core set. Agents now dynamically load only the skills they need based on task context, reducing cognitive overhead and improving performance.

---

## Agent Improvements

### Contextual Skill Loading

Agents no longer load all skills upfront. Instead, they analyze the task and load relevant skills on-demand:

**Plan Agent (Core):**

- `beads` - Task tracking
- `brainstorming` - Refine ideas before implementation

**Plan Agent (Conditional):**
| Context | Skills Loaded |
|---------|---------------|
| Feature/Epic | `prd`, `writing-plans` |
| Multi-phase (3+) | `swarm-coordination` |
| Research task | `deep-research` |
| Refactor/Migration | `writing-plans` |

**Build Agent (Core):**

- `beads` - Task tracking
- `verification-before-completion` - Never skip verification

**Build Agent (Conditional):**
| Context | Skills Loaded |
|---------|---------------|
| Has prd.md | `prd-task` |
| 3+ parallel tasks | `swarm-coordination`, `beads-bridge` |
| Bug fix | `systematic-debugging`, `root-cause-tracing` |
| Test work | `test-driven-development`, `testing-anti-patterns` |
| Frontend/UI | `frontend-design`, `react-best-practices` |

---

## Command Consolidation

Reduced from 40+ commands to a focused core workflow:

### Core Commands (Kept)

| Command    | Purpose                                  |
| ---------- | ---------------------------------------- |
| `/create`  | Create new bead/task                     |
| `/start`   | Begin work on a task                     |
| `/plan`    | Enter planning mode                      |
| `/design`  | Design phase                             |
| `/resume`  | Resume previous work                     |
| `/handoff` | Hand off to another session              |
| `/ship`    | **NEW** - Deploy with verification gates |
| `/verify`  | **NEW** - Run verification checks        |

### Removed Commands

- `/accessibility-check`, `/agent-browser`, `/analyze-mockup`, `/analyze-project`
- `/brainstorm`, `/cloudflare`, `/commit`, `/complete-next-task`
- `/design-audit`, `/edit-image`, `/finish`, `/fix-ci`, `/fix-types`, `/fix-ui`, `/fix`
- `/frontend-design`, `/generate-diagram`, `/generate-icon`, `/generate-image`
- `/generate-pattern`, `/generate-storyboard`, `/implement`, `/import-plan`
- `/index-knowledge`, `/integration-test`, `/issue`, `/new-feature`, `/opensrc`
- `/quick-build`, `/ralph`, `/research-and-implement`, `/research-ui`
- `/restore-image`, `/revert-feature`, `/skill-create`, `/skill-optimize`
- `/summarize`, `/triage`

---

## New Tools

| Tool                          | Purpose                                                  |
| ----------------------------- | -------------------------------------------------------- |
| `swarm-plan`                  | Analyze task complexity for parallel execution decisions |
| `swarm-delegate`              | Create delegation packets for worker agents              |
| `swarm-monitor`               | Progress tracking and visualization for parallel swarms  |
| `beads-sync`                  | Bridge between Beads git-backed tasks and OpenCode todos |
| `grepsearch`                  | Search real-world code examples from GitHub via grep.app |
| `context7-resolve-library-id` | Resolve library names to Context7 IDs                    |
| `context7-query-docs`         | Query library documentation from Context7                |

---

## New Skills

| Skill                | Purpose                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `swarm-coordination` | Full parallel agent orchestration with Kimi K2.5 PARL patterns    |
| `beads-bridge`       | Cross-session task coordination using Beads Village               |
| `deep-research`      | LSP + memory-first protocol for thorough code analysis            |
| `resend`             | Email platform integration (send, receive, React Email templates) |

---

## Research & Documentation

Added comprehensive research analysis:

- **CCPM Analysis** (`.opencode/memory/research/ccpm-analysis.md`)
  - PRD → Epic → Task → Issue pipeline
  - Parallel agent execution via git worktrees
  - "Context firewalls" philosophy
  - GitHub-native integration patterns

- **OpenSpec Analysis** (`.opencode/memory/research/openspec-analysis.md`)
  - Artifact-based workflow patterns
  - Schema-driven configuration
  - Context + rules injection

---

## Breaking Changes

None. Removed commands were rarely used and their functionality is covered by core commands or skills.

---

## Migration Guide

No migration required. If you were using removed commands:

| Old Command   | New Approach                       |
| ------------- | ---------------------------------- |
| `/brainstorm` | Load `brainstorming` skill         |
| `/fix`        | Use `/start` with bug description  |
| `/implement`  | Use `/start`                       |
| `/research-*` | Delegate to `@scout` or `@explore` |
| `/generate-*` | Delegate to `@painter`             |

---

## Installation

```bash
# Update global installation
npm install -g opencodekit@0.16.0

# Or update in project
ock update
```
