# Release v0.15.18 - Kimi K2.5 PARL Swarm Integration

## 🚀 Major Feature: Kimi K2.5 PARL Swarm Patterns

This release introduces **Kimi K2.5 PARL (Parallel-Agent Reinforcement Learning)** patterns for intelligent multi-agent orchestration, enabling optimal parallel execution with anti-serial-collapse detection and beautiful TUI progress visualization.

## ✨ New Features

### 1. **swarm-plan Tool** - Task Classification & Orchestration

- **Operations**: `analyze`, `classify`, `check`, `allocate`
- **Auto-detects** task types: `search`, `batch`, `writing`, `sequential`, `mixed`
- **Anti-serial-collapse detection** - Prevents forced sequential execution
- **Dynamic agent allocation** - Conservative start, scale based on bottlenecks
- **Phase-based execution** - Defines explore → generate → reflect → synthesize phases

```typescript
const analysis = await swarm_plan({
  operation: "analyze",
  task: "Research all API endpoints",
  files: "src/api/*.ts",
});
// Returns: type, recommended_agents, phases, coupling, confidence
```

### 2. **swarm-monitor Tool** - Real-time Progress Tracking

- **Operations**: `progress_update`, `progress_render`, `render_block`, `mail_send`, `mail_read`, `status`, `clear`
- **Beautiful TUI blocks** with markdown tables, emojis, and progress bars
- **Per-worker progress tracking** with file associations
- **Phase aggregation** with average progress calculation
- **Mailbox coordination** for inter-worker communication

```typescript
// Update progress
await swarm_monitor({
  operation: "progress_update",
  team_name: "api-research",
  worker_id: "worker-1",
  phase: "explore",
  progress: 75,
  status: "working",
  file: "src/api/users.ts",
});

// Render beautiful TUI
const ui = await swarm_monitor({
  operation: "render_block",
  team_name: "api-research",
});
```

### 3. **swarm-delegate Tool** - Delegation Packets

- Creates consistent delegation envelopes for workers
- Defines MUST DO / MUST NOT DO constraints
- Specifies acceptance checks and required tools
- Appends to `.beads/artifacts/<id>/delegation.md`

### 4. **Updated swarm-coordination Skill** (v2.0.0)

- Complete rewrite with Kimi K2.5 PARL patterns
- 6-step launch flow (added Step 0: Task Analysis)
- Real-time TUI monitoring with `render_block`
- Progress tracking every 25% completion
- Updated worker protocol with `swarm-monitor`

## 🔄 Updated Commands

### `/implement` Command

- Added **Step 0: Task Analysis** with `swarm-plan`
- Updated monitoring to use `swarm-monitor render_block`
- Worker protocol includes progress reporting
- Cleanup with `swarm-monitor clear`

### `/research` Command

- Added task classification with `swarm-plan`
- Swarm mode for complex multi-domain research
- Parallel research workers with progress tracking

### `/new-feature` Command

- **Phase 8** completely rewritten with PARL swarm execution
- Dynamic agent allocation based on task classification
- Beautiful TUI monitoring for parallel task execution

### **Build Agent** (`.opencode/agents/build.md`)

- Dynamic task classification from user input
- Anti-serial-collapse detection
- Real-time progress monitoring
- Updated for `swarm-plan` and `swarm-monitor` tools

## 📁 Structural Changes

Reorganized `.opencode/` directory structure:

- `agent/` → `agents/`
- `command/` → `commands/`
- `plugin/` → `plugins/`
- `skill/` → `skills/`
- `tool/` → `tools/`

## 🎯 PARL Workflow

```
User Request
    ↓
0. ANALYZE: swarm-plan({ operation: "analyze" })
   → Classify task, detect serial collapse
    ↓
1. CHECK: swarm-plan({ operation: "check" })
   → Validate allocation, adjust if needed
    ↓
2. DELEGATE: swarm_delegate({ ... })
   → Create packets for each worker
    ↓
3. SPAWN: Task({ subagent_type: "general" })
   → Launch workers in parallel
    ↓
4. MONITOR: swarm_monitor({ operation: "render_block" })
   → Real-time TUI progress
    ↓
5. SYNC: Handle messages, resolve blockers
    ↓
6. VERIFY: Run test suite
    ↓
7. CLOSE: bd close <bead> --reason "..."
```

## 📊 Example Classifications

| User Request                                 | Type         | Agents | Phases                       |
| -------------------------------------------- | ------------ | ------ | ---------------------------- |
| "Research all API endpoints"                 | `search`     | 3-5    | explore → synthesize         |
| "Update all components to new design system" | `batch`      | 4-8    | explore → generate → reflect |
| "Debug why login is failing"                 | `sequential` | 1      | analyze → implement → verify |
| "Write docs for auth flow"                   | `writing`    | 2-3    | explore → generate → reflect |

## 🛠️ Technical Details

### New Files

- `.opencode/tools/swarm-plan.ts` - Task analysis and orchestration
- `.opencode/tools/swarm-monitor.ts` - Progress tracking and TUI
- `.opencode/tools/swarm-delegate.ts` - Delegation packets

### Updated Files

- `.opencode/agents/build.md` - PARL swarm workflow
- `.opencode/commands/implement.md` - Swarm mode execution
- `.opencode/commands/research.md` - Parallel research
- `.opencode/commands/new-feature.md` - Swarm task execution
- `.opencode/skills/swarm-coordination/SKILL.md` - v2.0.0 with PARL

### Verification

- ✅ TypeScript type checking passes
- ✅ Linting passes (0 warnings, 0 errors)
- ✅ All tools tested and working

## 📝 Migration Notes

**For users upgrading from v0.15.17:**

- The old `swarm-helper` tool has been replaced by `swarm-monitor`
- Update any custom scripts using `swarm_helper()` to use `swarm_monitor()`
- The new tools provide better TUI visualization and progress tracking

## 🔗 References

- [Kimi K2.5 Technical Report](https://www.kimi.com/blog/kimi-k2-5.html)
- [PARL Research Paper](https://arxiv.org/abs/2106.07551)
- [OpenCode Custom Tools Docs](https://opencode.ai/docs/custom-tools/)

## 🙏 Contributors

Thanks to the Kimi K2.5 team for the PARL research that inspired this implementation!

---

**Full Changelog**: https://github.com/opencodekit/opencodekit-template/compare/v0.15.17...v0.15.18
