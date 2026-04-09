import { appendFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { readBoulderState } from "../features/boulder-state"
import { log } from "../shared"

export const BEADS_DIR = ".beads"
export const BEADS_ARTIFACTS_DIR = join(BEADS_DIR, "artifacts")
export const BEADS_VERIFY_LOG = join(BEADS_DIR, "verify.log")

export function writeBeadCheckpoint(directory: string, sessionID: string): boolean {
  try {
    const state = readBoulderState(directory)
    if (!state) {
      return true
    }

    const artifactsDir = join(directory, BEADS_ARTIFACTS_DIR)
    if (!existsSync(artifactsDir)) {
      mkdirSync(artifactsDir, { recursive: true })
    }

    const checkpointData = {
      session_id: sessionID,
      cleared_at: new Date().toISOString(),
      active_plan: state.active_plan ?? null,
      plan_name: state.plan_name ?? null,
      session_ids: state.session_ids ?? [],
      task_sessions: state.task_sessions ?? {},
      worktree_path: state.worktree_path ?? null,
    }

    const checkpointPath = join(artifactsDir, `checkpoint-${sessionID}.json`)
    writeFileSync(checkpointPath, JSON.stringify(checkpointData, null, 2), "utf-8")
    log("[bead-checkpoint] Written checkpoint before boulder state clear", {
      sessionID,
      checkpointPath,
    })
    return true
  } catch (error) {
    log("[bead-checkpoint] Failed to write checkpoint", {
      sessionID,
      error: String(error),
    })
    return false
  }
}

export function appendVerifyLog(
  directory: string,
  sessionID: string,
  status: "PASS" | "FAIL",
  planName: string,
): void {
  try {
    const beadsDir = join(directory, BEADS_DIR)
    if (!existsSync(beadsDir)) {
      mkdirSync(beadsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString()
    const entry = `session:${sessionID} plan:${planName} ${timestamp} ${status}\n`
    const logPath = join(directory, BEADS_VERIFY_LOG)

    appendFileSync(logPath, entry, "utf-8")
    log("[verify-log] Appended to verify.log", {
      sessionID,
      planName,
      status,
    })
  } catch (error) {
    log("[verify-log] Failed to write to verify.log", {
      sessionID,
      error: String(error),
    })
  }
}
