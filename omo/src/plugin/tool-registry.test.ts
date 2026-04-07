import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { tool } from "@opencode-ai/plugin";
import * as slashcommand from "../tools/slashcommand";
import { createToolRegistry, trimToolsToCap } from "./tool-registry";
import type { ToolsRecord } from "./types";

const fakeTool = tool({
	description: "test tool",
	args: {},
	async execute(): Promise<string> {
		return "ok";
	},
});

const tempDirectories = new Set<string>();

function trackTempDirectory(directory: string): string {
	tempDirectories.add(directory);
	return directory;
}

function createOckBeadFirstRepoFixture(): string {
	const projectDir = trackTempDirectory(
		mkdtempSync(join(tmpdir(), "omo-tool-registry-ock-")),
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

afterEach(() => {
	for (const directory of tempDirectories) {
		rmSync(directory, { recursive: true, force: true });
	}
	tempDirectories.clear();
});

const mockToolContext = {
	sessionID: "test-session",
	messageID: "msg-1",
	agent: "test-agent",
	directory: "/test",
	worktree: "/test",
	abort: new AbortController().signal,
	metadata: () => {},
	ask: async () => {},
};

describe("#given tool trimming prioritization", () => {
	test("#when max_tools trims a hashline edit registration named edit #then edit is removed before higher-priority tools", () => {
		const filteredTools = {
			bash: fakeTool,
			edit: fakeTool,
			read: fakeTool,
		} satisfies ToolsRecord;

		trimToolsToCap(filteredTools, 2);

		expect(filteredTools).not.toHaveProperty("edit");
		expect(filteredTools).toHaveProperty("bash");
		expect(filteredTools).toHaveProperty("read");
	});
});

describe("#given task_system configuration", () => {
	test("#when task_system is omitted #then task tools are not registered by default", () => {
		const result = createToolRegistry({
			ctx: { directory: "/tmp" } as Parameters<
				typeof createToolRegistry
			>[0]["ctx"],
			pluginConfig: {},
			managers: {
				backgroundManager: {},
				tmuxSessionManager: {},
				skillMcpManager: {},
			} as Parameters<typeof createToolRegistry>[0]["managers"],
			skillContext: {
				mergedSkills: [],
				availableSkills: [],
				browserProvider: "playwright",
				disabledSkills: new Set(),
			},
			availableCategories: [],
		});

		expect(result.taskSystemEnabled).toBe(false);
		expect(result.filteredTools).not.toHaveProperty("task_create");
		expect(result.filteredTools).not.toHaveProperty("task_get");
		expect(result.filteredTools).not.toHaveProperty("task_list");
		expect(result.filteredTools).not.toHaveProperty("task_update");
	});

	test("#when task_system is enabled #then task tools are registered", () => {
		const result = createToolRegistry({
			ctx: { directory: "/tmp" } as Parameters<
				typeof createToolRegistry
			>[0]["ctx"],
			pluginConfig: {
				experimental: { task_system: true },
			},
			managers: {
				backgroundManager: {},
				tmuxSessionManager: {},
				skillMcpManager: {},
			} as Parameters<typeof createToolRegistry>[0]["managers"],
			skillContext: {
				mergedSkills: [],
				availableSkills: [],
				browserProvider: "playwright",
				disabledSkills: new Set(),
			},
			availableCategories: [],
		});

		expect(result.taskSystemEnabled).toBe(true);
		expect(result.filteredTools).toHaveProperty("task_create");
		expect(result.filteredTools).toHaveProperty("task_get");
		expect(result.filteredTools).toHaveProperty("task_list");
		expect(result.filteredTools).toHaveProperty("task_update");
	});

	test("#when task_system is enabled in an OCK repo #then task tools are not registered", () => {
		const result = createToolRegistry({
			ctx: {
				directory: createOckBeadFirstRepoFixture(),
			} as Parameters<typeof createToolRegistry>[0]["ctx"],
			pluginConfig: {
				experimental: { task_system: true },
			},
			managers: {
				backgroundManager: {},
				tmuxSessionManager: {},
				skillMcpManager: {},
			} as Parameters<typeof createToolRegistry>[0]["managers"],
			skillContext: {
				mergedSkills: [],
				availableSkills: [],
				browserProvider: "playwright",
				disabledSkills: new Set(),
			},
			availableCategories: [],
		});

		expect(result.taskSystemEnabled).toBe(false);
		expect(result.filteredTools).not.toHaveProperty("task_create");
		expect(result.filteredTools).not.toHaveProperty("task_get");
		expect(result.filteredTools).not.toHaveProperty("task_list");
		expect(result.filteredTools).not.toHaveProperty("task_update");
	});
});

describe("#given tmux integration is disabled", () => {
	test("#when system tmux is available #then interactive_bash remains registered", () => {
		const result = createToolRegistry({
			ctx: { directory: "/tmp" } as Parameters<
				typeof createToolRegistry
			>[0]["ctx"],
			pluginConfig: {
				tmux: {
					enabled: false,
					layout: "main-vertical",
					main_pane_size: 60,
					main_pane_min_width: 120,
					agent_pane_min_width: 40,
					isolation: "inline",
				},
			},
			managers: {
				backgroundManager: {},
				tmuxSessionManager: {},
				skillMcpManager: {},
			} as Parameters<typeof createToolRegistry>[0]["managers"],
			skillContext: {
				mergedSkills: [],
				availableSkills: [],
				browserProvider: "playwright",
				disabledSkills: new Set(),
			},
			availableCategories: [],
			interactiveBashEnabled: true,
		});

		expect(result.filteredTools).toHaveProperty("interactive_bash");
	});

	test("#when system tmux is unavailable #then interactive_bash is not registered", () => {
		const result = createToolRegistry({
			ctx: { directory: "/tmp" } as Parameters<
				typeof createToolRegistry
			>[0]["ctx"],
			pluginConfig: {
				tmux: {
					enabled: false,
					layout: "main-vertical",
					main_pane_size: 60,
					main_pane_min_width: 120,
					agent_pane_min_width: 40,
					isolation: "inline",
				},
			},
			managers: {
				backgroundManager: {},
				tmuxSessionManager: {},
				skillMcpManager: {},
			} as Parameters<typeof createToolRegistry>[0]["managers"],
			skillContext: {
				mergedSkills: [],
				availableSkills: [],
				browserProvider: "playwright",
				disabledSkills: new Set(),
			},
			availableCategories: [],
			interactiveBashEnabled: false,
		});

		expect(result.filteredTools).not.toHaveProperty("interactive_bash");
	});
});

describe("#given skill tool command discovery parity", () => {
	test("#when claude plugin commands are disabled #then skill execute does not rediscover plugin-only commands", async () => {
		const discoverCommandsSyncSpy = spyOn(
			slashcommand,
			"discoverCommandsSync",
		).mockImplementation(
			(_directory?: string, options?: slashcommand.CommandDiscoveryOptions) => {
				if (options?.pluginsEnabled === false) {
					return [];
				}

				return [
					{
						name: "plugin-only",
						metadata: {
							name: "plugin-only",
							description: "Plugin-only command",
						},
						content: "Plugin-only command body",
						scope: "plugin",
					},
				];
			},
		);

		try {
			const result = createToolRegistry({
				ctx: { directory: "/tmp" } as Parameters<
					typeof createToolRegistry
				>[0]["ctx"],
				pluginConfig: {
					claude_code: {
						plugins: false,
						plugins_override: { alpha: false },
					},
				},
				managers: {
					backgroundManager: {},
					tmuxSessionManager: {},
					skillMcpManager: {},
				} as Parameters<typeof createToolRegistry>[0]["managers"],
				skillContext: {
					mergedSkills: [],
					availableSkills: [],
					browserProvider: "playwright",
					disabledSkills: new Set(),
				},
				availableCategories: [],
			});

			await expect(
				result.filteredTools.skill.execute(
					{ name: "plugin-only" },
					mockToolContext,
				),
			).rejects.toThrow(/not found/i);
		} finally {
			discoverCommandsSyncSpy.mockRestore();
		}
	});
});
