import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { createTasksTodowriteDisablerHook } = await import("./index");

function createOckBeadFirstRepoFixture(): string {
	const projectDir = mkdtempSync(
		join(tmpdir(), "omo-todo-disabler-index-ock-"),
	);
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

describe("tasks-todowrite-disabler", () => {
	describe("when experimental.task_system is enabled", () => {
		test("should block TodoWrite tool", async () => {
			// given
			const hook = createTasksTodowriteDisablerHook({
				experimental: { task_system: true },
			});
			const input = {
				tool: "TodoWrite",
				sessionID: "test-session",
				callID: "call-1",
			};
			const output = {
				args: {},
			};

			// when / then
			await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
				"TodoRead/TodoWrite are DISABLED",
			);
		});

		test("should block TodoRead tool", async () => {
			// given
			const hook = createTasksTodowriteDisablerHook({
				experimental: { task_system: true },
			});
			const input = {
				tool: "TodoRead",
				sessionID: "test-session",
				callID: "call-1",
			};
			const output = {
				args: {},
			};

			// when / then
			await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
				"TodoRead/TodoWrite are DISABLED",
			);
		});

		test("should not block other tools", async () => {
			// given
			const hook = createTasksTodowriteDisablerHook({
				experimental: { task_system: true },
			});
			const input = {
				tool: "Read",
				sessionID: "test-session",
				callID: "call-1",
			};
			const output = {
				args: {},
			};

			// when / then
			await expect(
				hook["tool.execute.before"](input, output),
			).resolves.toBeUndefined();
		});

		test("should not block TodoWrite in OCK bead-first projects", async () => {
			// given
			const projectDir = createOckBeadFirstRepoFixture();
			const hook = createTasksTodowriteDisablerHook({
				experimental: { task_system: true },
				directory: projectDir,
			});
			const input = {
				tool: "TodoWrite",
				sessionID: "test-session",
				callID: "call-1",
			};
			const output = {
				args: {},
			};

			try {
				// when / then
				await expect(
					hook["tool.execute.before"](input, output),
				).resolves.toBeUndefined();
			} finally {
				rmSync(projectDir, { recursive: true, force: true });
			}
		});
	});

	describe("when experimental.task_system is disabled", () => {
		test("should not block TodoWrite when flag is false", async () => {
			// given
			const hook = createTasksTodowriteDisablerHook({
				experimental: { task_system: false },
			});
			const input = {
				tool: "TodoWrite",
				sessionID: "test-session",
				callID: "call-1",
			};
			const output = {
				args: {},
			};

			// when / then
			await expect(
				hook["tool.execute.before"](input, output),
			).resolves.toBeUndefined();
		});

		test("should not block TodoWrite when experimental is undefined because task_system defaults to disabled", async () => {
			// given
			const hook = createTasksTodowriteDisablerHook({});
			const input = {
				tool: "TodoWrite",
				sessionID: "test-session",
				callID: "call-1",
			};
			const output = {
				args: {},
			};

			// when / then
			await expect(
				hook["tool.execute.before"](input, output),
			).resolves.toBeUndefined();
		});

		test("should not block TodoRead when flag is false", async () => {
			// given
			const hook = createTasksTodowriteDisablerHook({
				experimental: { task_system: false },
			});
			const input = {
				tool: "TodoRead",
				sessionID: "test-session",
				callID: "call-1",
			};
			const output = {
				args: {},
			};

			// when / then
			await expect(
				hook["tool.execute.before"](input, output),
			).resolves.toBeUndefined();
		});
	});

	describe("error message content", () => {
		test("should include replacement message with task tools info", async () => {
			// given
			const hook = createTasksTodowriteDisablerHook({
				experimental: { task_system: true },
			});
			const input = {
				tool: "TodoWrite",
				sessionID: "test-session",
				callID: "call-1",
			};
			const output = {
				args: {},
			};

			// when / then
			await expect(hook["tool.execute.before"](input, output)).rejects.toThrow(
				/TaskCreate|TaskUpdate|TaskList|TaskGet/,
			);
		});
	});
});
