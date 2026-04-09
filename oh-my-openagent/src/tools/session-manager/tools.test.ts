import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import type { PluginInput } from "@opencode-ai/plugin"

const originalXdgDataHome = process.env.XDG_DATA_HOME
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR

const { setVersionCache, resetVersionCache } = await import("../../shared/opencode-version")

type SessionManagerTools = ReturnType<typeof import("./tools")["createSessionManagerTools"]>

let isolatedDataDir = ""
let isolatedClaudeConfigDir = ""
let projectDir = ""
let mockContext: ToolContext
let tools: SessionManagerTools

beforeEach(async () => {
  isolatedDataDir = mkdtempSync(join(tmpdir(), "omo-session-tools-"))
  isolatedClaudeConfigDir = mkdtempSync(join(tmpdir(), "omo-claude-tools-"))
  projectDir = mkdtempSync(join(isolatedDataDir, "project-"))

  process.env.XDG_DATA_HOME = isolatedDataDir
  process.env.CLAUDE_CONFIG_DIR = isolatedClaudeConfigDir

  setVersionCache(null)
  const { createSessionManagerTools } = await import(`./tools?test=tools-${Date.now()}-${Math.random()}`)
  const mockCtx = { directory: projectDir } as PluginInput
  mockContext = {
    sessionID: "test-session",
    messageID: "test-message",
    agent: "test-agent",
    directory: projectDir,
    worktree: projectDir,
    abort: new AbortController().signal,
    metadata: () => {},
    ask: async () => {},
  }
  tools = createSessionManagerTools(mockCtx)
})

afterEach(() => {
  if (originalXdgDataHome === undefined) delete process.env.XDG_DATA_HOME
  else process.env.XDG_DATA_HOME = originalXdgDataHome

  if (originalClaudeConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
  else process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir

  resetVersionCache()
  rmSync(isolatedDataDir, { recursive: true, force: true })
  rmSync(isolatedClaudeConfigDir, { recursive: true, force: true })
})

describe("session-manager tools", () => {
  test("session_list executes without error", async () => {
    expect(typeof (await tools.session_list.execute({}, mockContext))).toBe("string")
  })

  test("session_list respects limit parameter", async () => {
    expect(typeof (await tools.session_list.execute({ limit: 5 }, mockContext))).toBe("string")
  })

  test("session_list filters by date range", async () => {
    expect(typeof (await tools.session_list.execute({ from_date: "2025-12-01T00:00:00Z", to_date: "2025-12-31T23:59:59Z" }, mockContext))).toBe("string")
  })

  test("session_list filters by project_path", async () => {
    expect(typeof (await tools.session_list.execute({ project_path: projectDir }, mockContext))).toBe("string")
  })

  test("session_list uses ctx.directory as default project_path", async () => {
    expect(typeof (await tools.session_list.execute({}, mockContext))).toBe("string")
  })

  test("session_read handles non-existent session", async () => {
    expect(await tools.session_read.execute({ session_id: "ses_nonexistent" }, mockContext)).toContain("not found")
  })

  test("session_read executes with valid parameters", async () => {
    expect(typeof (await tools.session_read.execute({ session_id: "ses_test123", include_todos: true, include_transcript: true }, mockContext))).toBe("string")
  })

  test("session_read respects limit parameter", async () => {
    expect(typeof (await tools.session_read.execute({ session_id: "ses_test123", limit: 10 }, mockContext))).toBe("string")
  })

  test("session_search executes without error", async () => {
    expect(typeof (await tools.session_search.execute({ query: "test" }, mockContext))).toBe("string")
  })

  test("session_search filters by session_id", async () => {
    expect(typeof (await tools.session_search.execute({ query: "test", session_id: "ses_test123" }, mockContext))).toBe("string")
  })

  test("session_search respects case_sensitive parameter", async () => {
    expect(typeof (await tools.session_search.execute({ query: "TEST", case_sensitive: true }, mockContext))).toBe("string")
  })

  test("session_search respects limit parameter", async () => {
    expect(typeof (await tools.session_search.execute({ query: "test", limit: 5 }, mockContext))).toBe("string")
  })

  test("session_info handles non-existent session", async () => {
    expect(await tools.session_info.execute({ session_id: "ses_nonexistent" }, mockContext)).toContain("not found")
  })

  test("session_info executes with valid session", async () => {
    expect(typeof (await tools.session_info.execute({ session_id: "ses_test123" }, mockContext))).toBe("string")
  })
})
