---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
version: 1.0.0
tags: [workflow, code-quality]
dependencies: []
---

# Verification Before Completion

## When to Use

- Before claiming tests/lint/build pass or a bug is fixed
- Before committing, opening PRs, or stating completion in a status update

## When NOT to Use

- While still actively coding without a completion claim
- When you cannot run verification commands yet (e.g., missing dependencies) — resolve first

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying

```

## Verification Checklist

- [ ] Identify the exact command that proves the claim
- [ ] Run the full command (fresh)
- [ ] Read the full output and exit code
- [ ] Confirm the output matches the claim
- [ ] Only then state the completion claim with evidence

## Common Failures

| Claim                 | Requires                        | Not Sufficient                 |
| --------------------- | ------------------------------- | ------------------------------ |
| Tests pass            | Test command output: 0 failures | Previous run, "should pass"    |
| Linter clean          | Linter output: 0 errors         | Partial check, extrapolation   |
| Build succeeds        | Build command: exit 0           | Linter passing, logs look good |
| Bug fixed             | Test original symptom: passes   | Code changed, assumed fixed    |
| Regression test works | Red-green cycle verified        | Test passes once               |
| Agent completed       | VCS diff shows changes          | Agent reports "success"        |
| Requirements met      | Line-by-line checklist          | Tests passing                  |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse                                  | Reality                |
| --------------------------------------- | ---------------------- |
| "Should work now"                       | RUN the verification   |
| "I'm confident"                         | Confidence ≠ evidence  |
| "Just this once"                        | No exceptions          |
| "Linter passed"                         | Linter ≠ compiler      |
| "Agent said success"                    | Verify independently   |
| "I'm tired"                             | Exhaustion ≠ excuse    |
| "Partial check is enough"               | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter     |

## Key Patterns

**Tests:**

```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**

```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**

```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**

```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**

```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## Smart Verification

The Iron Law demands evidence, but evidence should be gathered efficiently.

### Incremental by Default

Unless shipping or `--full` is passed, verify only what changed:

- **Lint**: `oxlint <changed-files>` instead of linting the entire codebase
- **Test**: `vitest run --changed` instead of running all tests
- **Typecheck**: always full (type errors propagate across files)

See the [Verification Protocol](./references/VERIFICATION_PROTOCOL.md) for exact commands.

### Parallel Execution

Run independent gates simultaneously to reduce wall-clock time:

```
Parallel: typecheck + lint → both must pass
Sequential: test → build (ship only)
```

Total time = max(typecheck, lint) + test, not typecheck + lint + test.

### Verification Cache

If you just verified and nothing changed, don't re-verify:

1. After gates pass, record a stamp in `.beads/verify.log`
2. Before running gates, compare current state to the latest stamp-shaped verification entry
3. Ignore OMO completion entries like `session:<id> plan:<name> ... PASS|FAIL` when checking cache reuse
4. If match → report cached PASS, skip redundant work
5. Cache is always bypassed for `--full` and ship/release

This matters when other commands need verification (e.g., closing beads, `/ship`). If you verified 30 seconds ago and made no changes, the cache lets you skip.

## Enforcement Gates

Prompt-level rules get ignored under pressure. These gates are **hard blocks** — they must be checked at the tool/action level, not just remembered.

### Gate 1: Completion Claims Require verify.log

Before ANY completion claim (bead close, PR creation, `/ship`, task completion):

1. Check `.beads/verify.log` exists and contains a recent stamp-shaped verification `PASS` entry
2. If verify.log is missing or stale (older than last file change) → **BLOCK** — run verification first
3. Do not treat OMO `session:<id> plan:<name> ... PASS|FAIL` entries as cache stamps or as proof that verification gates already passed

```text
✅ verify.log exists, with a recent stamp-shaped PASS entry within the last edit window → proceed
❌ verify.log missing → STOP: "Run verification first"
❌ only OMO session entries exist → STOP: "Run verification to write a cache stamp"
❌ verify.log stale (files changed since last PASS) → STOP: "Re-run verification"
```

### Gate 2: Agent Delegation Requires Post-Verification

After ANY `task()` subagent returns with "success", follow the **Worker Distrust Protocol** from AGENTS.md — read changed files, run verification, check acceptance criteria. Do not trust agent self-reports.

### Enforcement Principle

> **Prompt rules fail under pressure. Gates fail safe.**
>
> When a constraint matters enough to be an iron law, enforce it at the action level:
> check a file, verify a condition, reject if unmet. Don't rely on the agent
> "remembering" to follow the rule.

## Why This Matters

From 24 failure memories:

- your human partner said "I don't believe you" - trust broken
- Undefined functions shipped - would crash
- Missing requirements shipped - incomplete features
- Time wasted on false completion → redirect → rework
- Violates: "Honesty is a core value. If you lie, you'll be replaced."

## When To Apply

**ALWAYS before:**

- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Moving to next task
- Delegating to agents

**Rule applies to:**

- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.
