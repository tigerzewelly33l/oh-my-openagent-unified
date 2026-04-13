---
description: Verify implementation completeness, correctness, and coherence
argument-hint: "<bead-id> [--quick] [--full] [--fix] [--no-cache]"
agent: review
---

# Verify: $ARGUMENTS

Check implementation against PRD before shipping.

## Load Skills

```typescript
skill({ name: "beads" });
skill({ name: "verification-before-completion" });
```

## Parse Arguments

| Argument     | Default  | Description                                    |
| ------------ | -------- | ---------------------------------------------- |
| `<bead-id>`  | required | The bead to verify                             |
| `--quick`    | false    | Gates only, skip coherence check               |
| `--full`     | false    | Force full verification mode (non-incremental) |
| `--fix`      | false    | Auto-fix lint/format issues                    |
| `--no-cache` | false    | Bypass verification cache, force fresh run     |

## Determine Input Type

| Input Type | Detection                   | Action                              |
| ---------- | --------------------------- | ----------------------------------- |
| Bead ID    | Matches `br-xxx` or numeric | Check implementation vs PRD in bead |
| Path       | File/directory path         | Verify that specific path           |
| `all`      | Keyword                     | Verify all in-progress work         |

## Before You Verify

- **Be certain**: Only flag issues you can verify with tools
- **Don't invent problems**: If an edge case isn't in the PRD, don't flag it
- **Run the gates**: Build, test, lint, typecheck are non-negotiable
- **Use project conventions**: Check `package.json` scripts first

## Phase 0: Check Verification Cache

Before running any gates, check if a recent verification is still valid:

```bash
# Compute current state fingerprint (commit hash + diff + untracked file content)
CURRENT_STAMP=$(printf '%s\n%s\n%s' \
  "$(git rev-parse HEAD)" \
  "$(git diff HEAD -- '*.ts' '*.tsx' '*.js' '*.jsx')" \
  "$(git ls-files --others --exclude-standard -- '*.ts' '*.tsx' '*.js' '*.jsx' | xargs cat 2>/dev/null)" \
  | shasum -a 256 | cut -d' ' -f1)
LAST_STAMP=$(awk '/^[0-9a-f]{64} / && $3 == "PASS" { stamp=$1 } END { if (stamp) print stamp }' .beads/verify.log 2>/dev/null)
```

| Condition                                 | Action                                                 |
| ----------------------------------------- | ------------------------------------------------------ |
| `--no-cache` or `--full`                  | Skip cache check, run fresh                            |
| `CURRENT_STAMP == LAST_STAMP`             | Report **cached PASS**, skip to Phase 2 (completeness) |
| `CURRENT_STAMP != LAST_STAMP` or no cache | Run gates normally                                     |

Only hash-prefixed verification records count as cache stamps. OMO `/stop-continuation` entries like `session:<id> plan:<name> ... PASS|FAIL` remain valid shared completion evidence, but they must be ignored by the cache reader.

When cache hits, report:

```text
Verification: cached PASS (no changes since the latest stamp-shaped verify.log entry)
```

## Phase 1: Gather Context

```bash
br show $ARGUMENTS
```

Read `.beads/artifacts/$ARGUMENTS/` to check what artifacts exist.

Read the PRD and any other artifacts (plan.md, research.md, design.md).

**Verify guards:**

- [ ] Bead is `in_progress`
- [ ] `prd.md` exists
- [ ] You have read the full PRD

## Phase 2: Completeness

Extract all requirements/tasks from the PRD and verify each is implemented:

- For each requirement: find evidence in the codebase (file:line reference)
- Mark as: complete, partial, or missing
- Report completeness score (X/Y requirements met)

## Phase 3: Correctness

Follow the [Verification Protocol](../skill/verification-before-completion/references/VERIFICATION_PROTOCOL.md):

**Default: incremental mode** (changed files only, parallel gates).

| Mode        | When                                      | Behavior                         |
| ----------- | ----------------------------------------- | -------------------------------- |
| Incremental | Default, <20 changed files                | Lint changed files, test changed |
| Full        | `--full` flag, >20 changed files, or ship | Lint all, test all               |

**Execution order:**

1. **Parallel**: typecheck + lint (simultaneously)
2. **Sequential** (after parallel passes): test, then build (ship only)

Report results with mode column:

```text
| Gate      | Status | Mode        | Time   |
|-----------|--------|-------------|--------|
| Typecheck | PASS   | full        | 2.1s   |
| Lint      | PASS   | incremental | 0.3s   |
| Test      | PASS   | incremental | 1.2s   |
| Build     | SKIP   | —           | —      |
```

**After all gates pass**, record to verification cache:

```bash
echo "$CURRENT_STAMP $(date -u +%Y-%m-%dT%H:%M:%SZ) PASS" >> .beads/verify.log
```

If `--fix` flag provided, run the project's auto-fix command (e.g., `npm run lint:fix`, `ruff check --fix`, `cargo clippy --fix`).

## Phase 4: Coherence (skip with --quick)

Cross-reference artifacts for contradictions:

- PRD vs implementation (does code address all PRD requirements?)
- Plan vs implementation (did code follow the plan?)
- Research recommendations vs actual approach (if different, is it justified?)

Flag contradictions with specific file references.

## Phase 5: Report

```bash
br comments add $ARGUMENTS "Verification: [PASS|PARTIAL|FAIL] - [summary]"
```

Output:

1. **Result**: READY TO SHIP / NEEDS WORK / BLOCKED
2. **Completeness**: score and status
3. **Correctness**: gate results (with mode column)
4. **Coherence**: contradictions found (if not --quick)
5. **Blocking issues** to fix before shipping
6. **Next step**: `/ship $ARGUMENTS` if ready, or list fixes needed

Record significant findings with `observation()`.

## Related Commands

| Need              | Command            |
| ----------------- | ------------------ |
| Ship after verify | `/ship <id>`       |
| Review code       | `/review-codebase` |
| Check status      | `/status`          |
