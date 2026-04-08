# Release v0.15.21 - Swarm System + GPT Reasoning + Resend Skill

## Overview

This release includes three major feature areas:

1. **Simplified Swarm System** - Task tool replaces internal mailbox
2. **GPT Reasoning Support** - Added to GitHub Copilot integration
3. **Resend Email Skill** - New skill for email platform integration

## Major Changes

### 1. Simplified Swarm System (Breaking Change)

**Removed Operations:**
The following `swarm-monitor` operations have been removed:

- `restore_todos` - No longer needed (Task tool handles results)
- `persist_todos` - No longer needed (no internal state to persist)
- `mail_send` - Replaced by Task tool results
- `mail_read` - Replaced by Task tool results
- `get_todos` - Use `status` operation instead

**New Swarm Flow:**

```typescript
// Before: Workers used mailbox
swarm_monitor({ operation: "mail_send", message: "DONE" });

// After: Task tool returns results directly
Task({
  subagent_type: "general",
  prompt: `Execute task...\nReturn: DONE: <summary>`,
});
```

**Valid Operations:**
| Tool | Operations |
|------|-----------|
| swarm-monitor | `progress_update`, `render_block`, `status`, `clear` |
| swarm-plan | `analyze`, `classify`, `check`, `allocate` |
| beads-sync | `push`, `pull`, `create_shared`, `update_shared` |

### 2. GPT Reasoning Support (GitHub Copilot)

Added GPT model reasoning via `reasoning.effort` parameter:

- GPT-5.2 and GPT-5.2-codex with reasoningEffort options
- Reasoning variants: low/medium/high for both Claude and GPT models
- Fixed Claude thinking block signature errors
- Updated SDK with zod/v4 for native reasoning support

### 3. Resend Email Skill

New comprehensive skill for Resend email platform:

- **send-email.md**: Single/batch sends, idempotency, retries, webhooks
- **receive-email.md**: Inbound domain setup, webhook processing, attachments
- **react-email.md**: Email templates with React components and Tailwind

## Files Changed

### Tools (7 files)

- `.opencode/tool/swarm-monitor.ts` - Removed 4 obsolete operations
- `.opencode/tool/swarm-plan.ts` - Added worker skill docs
- `.opencode/tool/swarm-delegate.ts` - Added skill recommendations
- `.opencode/tool/beads-sync.ts` - Cross-session task sync
- `.opencode/tool/oracle.ts` - Second opinion from AI models
- `.opencode/tool/grepsearch.ts` - GitHub code search
- `.opencode/tool/context7-*.ts` - Library documentation lookup

### Commands (5 files)

- `.opencode/command/implement.md` - Updated swarm flow
- `.opencode/command/handoff.md` - Removed persist_todos
- `.opencode/command/resume.md` - Removed restore_todos
- `.opencode/command/new-feature.md` - Removed mail_send
- `.opencode/command/research.md` - Simplified examples

### Skills (6 files)

- `.opencode/skill/beads/SKILL.md` - Added beads-bridge section
- `.opencode/skill/beads-bridge/SKILL.md` - Removed obsolete operations
- `.opencode/skill/swarm-coordination/SKILL.md` - Removed mailbox patterns
- `.opencode/skill/tool-priority/SKILL.md` - Fixed LSP syntax
- `.opencode/skill/resend/SKILL.md` - **NEW** Email platform skill
- `.opencode/skill/deep-research/SKILL.md` - **NEW** LSP-driven exploration

### Agent (1 file)

- `.opencode/agent/build.md` - Swarm leader for parallel execution

### Plugins (3 files)

- `.opencode/plugin/copilot-auth.ts` - GPT reasoning support
- `.opencode/plugin/sdk/copilot/*` - OpenAI-compatible SDK
- `.opencode/plugin/swarm-enforcer.ts` - Beads protocol enforcement

### Other (4 files)

- `AGENTS.md` - Renamed "SWARM PROTOCOL" to "BEADS PROTOCOL"
- `package.json` - Version bump to 0.15.21
- `src/commands/init.ts` - Updated init command
- Build artifacts updated

## Statistics

- **542 files changed**
- **639 insertions**
- **7,712 deletions**
- **Net reduction: 7,073 lines** (major simplification!)

## Migration Guide

### For Swarm Users

**Before (v0.15.20):**

```typescript
// Check for existing state
const existing = await swarm_monitor({
  operation: "get_todos",
  team_name: "my-swarm",
});

// Restore if needed
if (existing.todos.length > 0) {
  await swarm_monitor({ operation: "restore_todos", team_name: "my-swarm" });
}

// Workers sent messages
swarm_monitor({ operation: "mail_send", message: "DONE: task complete" });
```

**After (v0.15.21):**

```typescript
// Check status
const status = await swarm_monitor({ operation: "status", team_name: "my-swarm" });

// Workers return via Task results
Task({
  subagent_type: "general",
  prompt: `Execute task...\nReturn: DONE: <summary> or ERROR: <issue>`,
});
```

## Verification

```bash
# Verify no obsolete operations remain
grep -r "restore_todos\|persist_todos\|mail_send\|mail_read" .opencode/ || echo "✓ Clean"

# Typecheck and lint
npm run typecheck  # ✓ Passed
npm run lint       # ✓ 0 warnings, 0 errors
```

## Contributors

- Swarm system simplification
- GPT reasoning integration
- Resend email skill
- Copilot SDK improvements

---

**Full Changelog**: https://github.com/opencodekit/opencodekit-template/compare/v0.15.20...v0.15.21
