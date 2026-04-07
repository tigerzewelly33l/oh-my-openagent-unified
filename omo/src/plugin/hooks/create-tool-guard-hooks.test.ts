import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OhMyOpenCodeConfig } from "../../config";
import * as hooks from "../../hooks";
import type { ModelCacheState } from "../../plugin-state";
import type { PluginContext } from "../types";

function createOckBeadFirstRepoFixture(): string {
	const projectDir = mkdtempSync(join(tmpdir(), "omo-tool-guard-ock-"));
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

const mockContext = {
	directory: "/tmp",
} as PluginContext;

const mockModelCacheState = {
	anthropicContext1MEnabled: false,
	modelContextLimitsCache: new Map(),
} satisfies ModelCacheState;

describe("createToolGuardHooks", () => {
	let capturedOptions: { skipClaudeUserRules?: boolean } | undefined;

	beforeEach(() => {
		capturedOptions = undefined;
		spyOn(hooks, "createRulesInjectorHook").mockImplementation(
			(
				_ctx: unknown,
				_state: unknown,
				options?: { skipClaudeUserRules?: boolean },
			) => {
				capturedOptions = options;
				return { name: "rules-injector" } as never;
			},
		);
	});

	it("skips Claude user rules when claude_code.hooks is false", () => {
		// given
		const pluginConfig = {
			claude_code: {
				hooks: false,
			},
		} as OhMyOpenCodeConfig;
		const { createToolGuardHooks } = require("./create-tool-guard-hooks");

		// when
		createToolGuardHooks({
			ctx: mockContext,
			pluginConfig,
			modelCacheState: mockModelCacheState,
			isHookEnabled: (hookName: string) => hookName === "rules-injector",
			safeHookEnabled: true,
		});

		// then
		expect(capturedOptions).toEqual({ skipClaudeUserRules: true });
	});

	it("does not create tasksTodowriteDisabler in OCK bead-first repos", () => {
		// given
		const projectDir = createOckBeadFirstRepoFixture();
		const pluginConfig = {
			experimental: {
				task_system: true,
			},
		} as OhMyOpenCodeConfig;
		const { createToolGuardHooks } = require("./create-tool-guard-hooks");

		try {
			// when
			const result = createToolGuardHooks({
				ctx: { directory: projectDir } as PluginContext,
				pluginConfig,
				modelCacheState: mockModelCacheState,
				isHookEnabled: (hookName: string) =>
					hookName === "tasks-todowrite-disabler",
				safeHookEnabled: true,
			});

			// then
			expect(result.tasksTodowriteDisabler).toBeNull();
		} finally {
			rmSync(projectDir, { recursive: true, force: true });
		}
	});

	it("still creates tasksTodowriteDisabler in non-OCK repos when task_system is enabled", () => {
		// given
		const pluginConfig = {
			experimental: {
				task_system: true,
			},
		} as OhMyOpenCodeConfig;
		const { createToolGuardHooks } = require("./create-tool-guard-hooks");

		// when
		const result = createToolGuardHooks({
			ctx: mockContext,
			pluginConfig,
			modelCacheState: mockModelCacheState,
			isHookEnabled: (hookName: string) =>
				hookName === "tasks-todowrite-disabler",
			safeHookEnabled: true,
		});

		// then
		expect(result.tasksTodowriteDisabler).not.toBeNull();
	});
});
