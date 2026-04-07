import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { REPLACEMENT_MESSAGE } from "./constants";
import { createTasksTodowriteDisablerHook } from "./hook";

function createOckBeadFirstRepoFixture(): string {
	const projectDir = mkdtempSync(join(tmpdir(), "omo-todo-disabler-ock-"));
	const commandsDir = join(projectDir, ".opencode", "command");

	mkdirSync(join(projectDir, ".beads"), { recursive: true });
	mkdirSync(commandsDir, { recursive: true });

	for (const commandName of [
		"create.md",
		"research.md",
		"start.md",
		"plan.md",
	]) {
		writeFileSync(join(commandsDir, commandName), `# ${commandName}\n`);
	}

	return projectDir;
}

describe("createTasksTodowriteDisablerHook", () => {
	describe("#given experimental.task_system is omitted", () => {
		test("#when TodoWrite runs #then it is allowed by default", async () => {
			// given
			const hook = createTasksTodowriteDisablerHook({});

			// when
			const result = hook["tool.execute.before"](
				{ tool: "TodoWrite", sessionID: "ses_123", callID: "call_123" },
				{ args: {} },
			);

			// then
			await expect(result).resolves.toBeUndefined();
		});
	});

	describe("#given experimental.task_system is enabled", () => {
		test("#when TodoWrite runs #then it is blocked", async () => {
			// given
			const hook = createTasksTodowriteDisablerHook({
				experimental: { task_system: true },
			});

			// when
			const result = hook["tool.execute.before"](
				{ tool: "TodoWrite", sessionID: "ses_123", callID: "call_123" },
				{ args: {} },
			);

			// then
			await expect(result).rejects.toThrow(REPLACEMENT_MESSAGE);
		});

		test("#when directory is an OCK bead-first project #then TodoWrite is allowed", async () => {
			// given
			const projectDir = createOckBeadFirstRepoFixture();
			const hook = createTasksTodowriteDisablerHook({
				experimental: { task_system: true },
				directory: projectDir,
			});

			try {
				// when
				const result = hook["tool.execute.before"](
					{ tool: "TodoWrite", sessionID: "ses_123", callID: "call_123" },
					{ args: {} },
				);

				// then
				await expect(result).resolves.toBeUndefined();
			} finally {
				rmSync(projectDir, { recursive: true, force: true });
			}
		});
	});
});
