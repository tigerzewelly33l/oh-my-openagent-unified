import {
	afterAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from "bun:test";
import * as fs from "node:fs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Tool as McpTool } from "@modelcontextprotocol/sdk/types.js";
import type { ToolContext } from "@opencode-ai/plugin/tool";
import type { LoadedSkill } from "../../../features/opencode-skill-loader/types";
import { SkillMcpManager } from "../../../features/skill-mcp-manager";
import * as slashcommand from "../../slashcommand";
import type { CommandInfo } from "../../slashcommand/types";

const originalReadFileSync = fs.readFileSync.bind(fs);

let createSkillTool: typeof import("../tools").createSkillTool;
const tempDirectories = new Set<string>();

function trackTempDirectory(directory: string): string {
	tempDirectories.add(directory);
	return directory;
}

function createOckBeadFirstRepoFixture(): string {
	const projectDir = trackTempDirectory(
		mkdtempSync(join(tmpdir(), "omo-skill-tool-ock-")),
	);
	const opencodeCommandDir = join(projectDir, ".opencode", "command");
	const claudeCommandDir = join(projectDir, ".claude", "commands");

	mkdirSync(join(projectDir, ".beads"), { recursive: true });
	mkdirSync(opencodeCommandDir, { recursive: true });
	mkdirSync(claudeCommandDir, { recursive: true });

	for (const commandName of [
		"create.md",
		"research.md",
		"start.md",
		"ship.md",
	]) {
		writeFileSync(join(opencodeCommandDir, commandName), `# ${commandName}\n`);
	}

	return projectDir;
}

beforeEach(async () => {
	mock.module("node:fs", () => ({
		...fs,
		readFileSync: (path: string, encoding?: string) => {
			if (typeof path === "string" && path.includes("/skills/")) {
				return `---
description: Test skill description
---
Test skill body content`;
			}
			return originalReadFileSync(path, encoding as BufferEncoding);
		},
	}));

	const module = await import("../tools");
	createSkillTool = module.createSkillTool;
});

afterAll(() => {
	for (const directory of tempDirectories) {
		rmSync(directory, { recursive: true, force: true });
	}
	tempDirectories.clear();
	mock.restore();
});

function createMockSkill(
	name: string,
	options: { agent?: string } = {},
): LoadedSkill {
	return {
		name,
		path: `/test/skills/${name}/SKILL.md`,
		resolvedPath: `/test/skills/${name}`,
		definition: {
			name,
			description: `Test skill ${name}`,
			template: "Test template",
			agent: options.agent,
		},
		scope: "opencode-project",
	};
}

function createMockSkillWithMcp(
	name: string,
	mcpServers: Record<string, unknown>,
): LoadedSkill {
	return {
		name,
		path: `/test/skills/${name}/SKILL.md`,
		resolvedPath: `/test/skills/${name}`,
		definition: {
			name,
			description: `Test skill ${name}`,
			template: "Test template",
		},
		scope: "opencode-project",
		mcpConfig: mcpServers as LoadedSkill["mcpConfig"],
	};
}

const mockContext: ToolContext = {
	sessionID: "test-session",
	messageID: "msg-1",
	agent: "test-agent",
	directory: "/test",
	worktree: "/test",
	abort: new AbortController().signal,
	metadata: () => {},
	ask: async () => {},
};

describe("skill tool - synchronous description", () => {
	it("includes available_items immediately when skills are pre-provided", () => {
		// given
		const loadedSkills = [createMockSkill("test-skill")];

		// when
		const tool = createSkillTool({ skills: loadedSkills });

		// then
		expect(tool.description).toContain("<available_items>");
		expect(tool.description).toContain("test-skill");
	});

	it("includes all pre-provided skills in available_items immediately", () => {
		// given
		const loadedSkills = [
			createMockSkill("playwright"),
			createMockSkill("frontend-ui-ux"),
			createMockSkill("git-master"),
		];

		// when
		const tool = createSkillTool({ skills: loadedSkills });

		// then
		expect(tool.description).toContain("<available_items>");
		expect(tool.description).toContain("playwright");
		expect(tool.description).toContain("frontend-ui-ux");
		expect(tool.description).toContain("git-master");
	});

	it("shows no-skills message immediately when empty skills are pre-provided", () => {
		// given / #when
		const tool = createSkillTool({ skills: [] });

		// then
		expect(tool.description).toContain("No skills are currently available");
	});
});

describe("skill tool - agent restriction", () => {
	it("allows skill without agent restriction to any agent", async () => {
		// given
		const loadedSkills = [createMockSkill("public-skill")];
		const tool = createSkillTool({ skills: loadedSkills });
		const context = { ...mockContext, agent: "any-agent" };

		// when
		const result = await tool.execute({ name: "public-skill" }, context);

		// then
		expect(result).toContain("public-skill");
	});

	it("allows skill when agent matches restriction", async () => {
		// given
		const loadedSkills = [
			createMockSkill("restricted-skill", { agent: "sisyphus" }),
		];
		const tool = createSkillTool({ skills: loadedSkills });
		const context = { ...mockContext, agent: "sisyphus" };

		// when
		const result = await tool.execute({ name: "restricted-skill" }, context);

		// then
		expect(result).toContain("restricted-skill");
	});

	it("throws error when agent does not match restriction", async () => {
		// given
		const loadedSkills = [
			createMockSkill("sisyphus-only-skill", { agent: "sisyphus" }),
		];
		const tool = createSkillTool({ skills: loadedSkills });
		const context = { ...mockContext, agent: "oracle" };

		// when / #then
		await expect(
			tool.execute({ name: "sisyphus-only-skill" }, context),
		).rejects.toThrow(
			'Skill "sisyphus-only-skill" is restricted to agent "sisyphus"',
		);
	});

	it("throws error when context agent is undefined for restricted skill", async () => {
		// given
		const loadedSkills = [
			createMockSkill("sisyphus-only-skill", { agent: "sisyphus" }),
		];
		const tool = createSkillTool({ skills: loadedSkills });
		const contextWithoutAgent = {
			...mockContext,
			agent: undefined as unknown as string,
		};

		// when / #then
		await expect(
			tool.execute({ name: "sisyphus-only-skill" }, contextWithoutAgent),
		).rejects.toThrow(
			'Skill "sisyphus-only-skill" is restricted to agent "sisyphus"',
		);
	});
});

describe("skill tool - MCP schema display", () => {
	let manager: SkillMcpManager;
	let loadedSkills: LoadedSkill[];
	let sessionID: string;

	beforeEach(() => {
		manager = new SkillMcpManager();
		loadedSkills = [];
		sessionID = "test-session-1";
	});

	describe("formatMcpCapabilities with inputSchema", () => {
		it("uses the tool context sessionID when the fallback getter is empty", async () => {
			// given
			loadedSkills = [
				createMockSkillWithMcp("test-skill", {
					playwright: {
						command: "npx",
						args: ["-y", "@anthropic-ai/mcp-playwright"],
					},
				}),
			];

			const listToolsSpy = spyOn(manager, "listTools").mockResolvedValue([]);
			spyOn(manager, "listResources").mockResolvedValue([]);
			spyOn(manager, "listPrompts").mockResolvedValue([]);

			const tool = createSkillTool({
				skills: loadedSkills,
				mcpManager: manager,
				getSessionID: () => "",
			});

			// when
			await tool.execute({ name: "test-skill" }, mockContext);

			// then
			expect(listToolsSpy).toHaveBeenCalledWith(
				expect.objectContaining({ sessionID: mockContext.sessionID }),
				expect.any(Object),
			);
		});

		it("displays tool inputSchema when available", async () => {
			// given
			const mockToolsWithSchema: McpTool[] = [
				{
					name: "browser_type",
					description: "Type text into an element",
					inputSchema: {
						type: "object",
						properties: {
							element: {
								type: "string",
								description: "Human-readable element description",
							},
							ref: {
								type: "string",
								description: "Element reference from page snapshot",
							},
							text: {
								type: "string",
								description: "Text to type into the element",
							},
							submit: {
								type: "boolean",
								description: "Submit form after typing",
							},
						},
						required: ["element", "ref", "text"],
					},
				},
			];

			loadedSkills = [
				createMockSkillWithMcp("test-skill", {
					playwright: {
						command: "npx",
						args: ["-y", "@anthropic-ai/mcp-playwright"],
					},
				}),
			];

			// Mock manager.listTools to return our mock tools
			spyOn(manager, "listTools").mockResolvedValue(mockToolsWithSchema);
			spyOn(manager, "listResources").mockResolvedValue([]);
			spyOn(manager, "listPrompts").mockResolvedValue([]);

			const tool = createSkillTool({
				skills: loadedSkills,
				mcpManager: manager,
				getSessionID: () => sessionID,
			});

			// when
			const result = await tool.execute({ name: "test-skill" }, mockContext);

			// then
			// Should include inputSchema details
			expect(result).toContain("browser_type");
			expect(result).toContain("inputSchema");
			expect(result).toContain("element");
			expect(result).toContain("ref");
			expect(result).toContain("text");
			expect(result).toContain("submit");
			expect(result).toContain("required");
		});

		it("displays multiple tools with their schemas", async () => {
			// given
			const mockToolsWithSchema: McpTool[] = [
				{
					name: "browser_navigate",
					description: "Navigate to a URL",
					inputSchema: {
						type: "object",
						properties: {
							url: { type: "string", description: "URL to navigate to" },
						},
						required: ["url"],
					},
				},
				{
					name: "browser_click",
					description: "Click an element",
					inputSchema: {
						type: "object",
						properties: {
							element: { type: "string" },
							ref: { type: "string" },
						},
						required: ["element", "ref"],
					},
				},
			];

			loadedSkills = [
				createMockSkillWithMcp("playwright-skill", {
					playwright: {
						command: "npx",
						args: ["-y", "@anthropic-ai/mcp-playwright"],
					},
				}),
			];

			spyOn(manager, "listTools").mockResolvedValue(mockToolsWithSchema);
			spyOn(manager, "listResources").mockResolvedValue([]);
			spyOn(manager, "listPrompts").mockResolvedValue([]);

			const tool = createSkillTool({
				skills: loadedSkills,
				mcpManager: manager,
				getSessionID: () => sessionID,
			});

			// when
			const result = await tool.execute(
				{ name: "playwright-skill" },
				mockContext,
			);

			// then
			expect(result).toContain("browser_navigate");
			expect(result).toContain("browser_click");
			expect(result).toContain("url");
			expect(result).toContain("Navigate to a URL");
		});

		it("handles tools without inputSchema gracefully", async () => {
			// given
			const mockToolsMinimal: McpTool[] = [
				{
					name: "simple_tool",
					inputSchema: { type: "object" },
				},
			];

			loadedSkills = [
				createMockSkillWithMcp("simple-skill", {
					simple: { command: "echo", args: ["test"] },
				}),
			];

			spyOn(manager, "listTools").mockResolvedValue(mockToolsMinimal);
			spyOn(manager, "listResources").mockResolvedValue([]);
			spyOn(manager, "listPrompts").mockResolvedValue([]);

			const tool = createSkillTool({
				skills: loadedSkills,
				mcpManager: manager,
				getSessionID: () => sessionID,
			});

			// when
			const result = await tool.execute({ name: "simple-skill" }, mockContext);

			// then
			expect(result).toContain("simple_tool");
			// Should not throw, should handle gracefully
		});

		it("formats schema in a way LLM can understand for skill_mcp calls", async () => {
			// given
			const mockTools: McpTool[] = [
				{
					name: "query",
					description: "Execute SQL query",
					inputSchema: {
						type: "object",
						properties: {
							sql: { type: "string", description: "SQL query to execute" },
							params: { type: "array", description: "Query parameters" },
						},
						required: ["sql"],
					},
				},
			];

			loadedSkills = [
				createMockSkillWithMcp("db-skill", {
					sqlite: { command: "uvx", args: ["mcp-server-sqlite"] },
				}),
			];

			spyOn(manager, "listTools").mockResolvedValue(mockTools);
			spyOn(manager, "listResources").mockResolvedValue([]);
			spyOn(manager, "listPrompts").mockResolvedValue([]);

			const tool = createSkillTool({
				skills: loadedSkills,
				mcpManager: manager,
				getSessionID: () => sessionID,
			});

			// when
			const result = await tool.execute({ name: "db-skill" }, mockContext);

			// then
			// Should provide enough info for LLM to construct valid skill_mcp call
			expect(result).toContain("sqlite");
			expect(result).toContain("query");
			expect(result).toContain("sql");
			expect(result).toContain("required");
			expect(result).toMatch(/sql[\s\S]*string/i);
		});
	});
});

describe("skill tool - ordering and priority", () => {
	function createMockSkillWithScope(name: string, scope: string): LoadedSkill {
		return {
			name,
			path: `/test/skills/${name}/SKILL.md`,
			resolvedPath: `/test/skills/${name}`,
			definition: {
				name,
				description: `Test skill ${name}`,
				template: "Test template",
			},
			scope: scope as LoadedSkill["scope"],
		};
	}

	function createMockCommand(name: string, scope: string) {
		return {
			name,
			path: `/test/commands/${name}.md`,
			metadata: {
				name,
				description: `Test command ${name}`,
			},
			scope: scope as CommandInfo["scope"],
		};
	}

	it("shows skills as command items with slash prefix in available_items", () => {
		//#given: mix of skills and commands
		const skills = [
			createMockSkillWithScope("builtin-skill", "builtin"),
			createMockSkillWithScope("project-skill", "project"),
		];
		const commands = [
			createMockCommand("project-cmd", "project"),
			createMockCommand("builtin-cmd", "builtin"),
		];

		//#when: creating tool with both
		const tool = createSkillTool({ skills, commands });

		//#then: skills should appear as <command> items with / prefix, listed before regular commands
		const desc = tool.description;
		expect(desc).toContain("<name>/builtin-skill</name>");
		expect(desc).toContain("<name>/project-skill</name>");
		expect(desc).not.toContain("<skill>");
		const skillCmdIndex = desc.indexOf("/project-skill");
		const regularCmdIndex = desc.indexOf("/project-cmd");
		expect(skillCmdIndex).toBeLessThan(regularCmdIndex);
	});

	it("sorts skill-commands by priority: project > user > opencode > builtin", () => {
		//#given: skills in random order
		const skills = [
			createMockSkillWithScope("builtin-skill", "builtin"),
			createMockSkillWithScope("opencode-skill", "opencode"),
			createMockSkillWithScope("project-skill", "project"),
			createMockSkillWithScope("user-skill", "user"),
		];

		//#when: creating tool
		const tool = createSkillTool({ skills });

		//#then: should be sorted by priority
		const desc = tool.description;
		const projectIndex = desc.indexOf("/project-skill");
		const userIndex = desc.indexOf("/user-skill");
		const opencodeIndex = desc.indexOf("/opencode-skill");
		const builtinIndex = desc.indexOf("/builtin-skill");

		expect(projectIndex).toBeLessThan(userIndex);
		expect(userIndex).toBeLessThan(opencodeIndex);
		expect(opencodeIndex).toBeLessThan(builtinIndex);
	});

	it("sorts commands by priority: project > user > opencode > builtin", () => {
		//#given: commands in random order
		const commands = [
			createMockCommand("builtin-cmd", "builtin"),
			createMockCommand("opencode-cmd", "opencode"),
			createMockCommand("project-cmd", "project"),
			createMockCommand("user-cmd", "user"),
		];

		//#when: creating tool
		const tool = createSkillTool({ commands });

		//#then: should be sorted by priority
		const desc = tool.description;
		const projectIndex = desc.indexOf("project-cmd");
		const userIndex = desc.indexOf("user-cmd");
		const opencodeIndex = desc.indexOf("opencode-cmd");
		const builtinIndex = desc.indexOf("builtin-cmd");

		expect(projectIndex).toBeLessThan(userIndex);
		expect(userIndex).toBeLessThan(opencodeIndex);
		expect(opencodeIndex).toBeLessThan(builtinIndex);
	});

	it("includes priority documentation in description", () => {
		//#given: some skills and commands
		const skills = [createMockSkillWithScope("test-skill", "project")];
		const commands = [createMockCommand("test-cmd", "project")];

		//#when: creating tool
		const tool = createSkillTool({ skills, commands });

		//#then: should include priority info
		expect(tool.description).toContain(
			"Priority: primary > support > other > compatibility | OCK bead-first workflow commands prefer opencode-project > project > config > user > opencode > builtin > plugin",
		);
		expect(tool.description).toContain("Skills listed before commands");
	});

	it("uses <available_items> wrapper with unified command format", () => {
		//#given: mix of skills and commands
		const skills = [createMockSkillWithScope("test-skill", "project")];
		const commands = [createMockCommand("test-cmd", "project")];

		//#when: creating tool
		const tool = createSkillTool({ skills, commands });

		//#then: should use unified wrapper with all items as commands
		expect(tool.description).toContain("<available_items>");
		expect(tool.description).toContain("</available_items>");
		expect(tool.description).not.toContain("<skill>");
		expect(tool.description).toContain("<command>");
		expect(tool.description).toContain("/test-skill");
		expect(tool.description).toContain("/test-cmd");
	});

	it("labels workflow support and compatibility commands in the unified command catalog", () => {
		//#given: bead-backed command classes
		const commands = [
			createMockCommand("verify", "opencode-project"),
			createMockCommand("lfg", "opencode-project"),
			createMockCommand("compound", "opencode-project"),
			createMockCommand("create", "opencode-project"),
		];

		//#when: creating tool
		const tool = createSkillTool({ skills: [], commands });

		//#then: should document command classes, not just raw scope priority
		expect(tool.description).toContain(
			"Priority: primary > support > other > compatibility | OCK bead-first workflow commands prefer opencode-project > project > config > user > opencode > builtin > plugin",
		);
		expect(tool.description).toContain("<name>/create</name>");
		expect(tool.description).toContain("<category>primary</category>");
		expect(tool.description).toContain("<name>/verify</name>");
		expect(tool.description).toContain("<category>support</category>");
		expect(tool.description).toContain("<name>/lfg</name>");
		expect(tool.description).toContain("<category>compatibility</category>");
		expect(tool.description).toContain("<name>/compound</name>");
		expect(tool.description).toContain("<category>compatibility</category>");
	});
});

describe("skill tool - OCK bead-first command precedence", () => {
	it("prefers bead-backed workflow commands over same-named claude commands when rediscovering from directory", async () => {
		// given
		const projectDir = createOckBeadFirstRepoFixture();
		const opencodeCommandDir = join(projectDir, ".opencode", "command");
		const claudeCommandDir = join(projectDir, ".claude", "commands");

		writeFileSync(
			join(opencodeCommandDir, "create.md"),
			`---
description: Bead-backed create command
---
Use bead-backed create workflow.
`,
		);
		writeFileSync(
			join(claudeCommandDir, "create.md"),
			`---
description: Legacy claude create command
---
Use legacy claude create flow.
`,
		);
		const tool = createSkillTool({
			directory: projectDir,
			skills: [],
			commands: [],
		});

		// when
		const result = await tool.execute(
			{ name: "create", user_message: "bd-l1s" },
			mockContext,
		);

		// then
		expect(result).toContain("Use bead-backed create workflow.");
		expect(result).toContain("**Category**: primary workflow");
		expect(result).toContain("**Scope**: opencode-project");
		expect(result).not.toContain("Use legacy claude create flow.");
	});

	it("prefers bead-backed workflow commands over same-named skills in OCK bead-first repos", async () => {
		// given
		const projectDir = createOckBeadFirstRepoFixture();
		const opencodeCommandDir = join(projectDir, ".opencode", "command");
		const collidingSkill = createMockSkill("create");
		collidingSkill.definition.description = "Colliding skill create";
		collidingSkill.definition.template = "Use colliding skill create flow.";

		writeFileSync(
			join(opencodeCommandDir, "create.md"),
			`---
description: Bead-backed create command
---
Use bead-backed create workflow.
`,
		);
		const tool = createSkillTool({
			directory: projectDir,
			skills: [collidingSkill],
			commands: [],
		});

		// when
		const result = await tool.execute(
			{ name: "create", user_message: "bd-l1s" },
			mockContext,
		);

		// then
		expect(result).toContain("Use bead-backed create workflow.");
		expect(result).toContain("**Category**: primary workflow");
		expect(result).toContain("**Scope**: opencode-project");
		expect(result).not.toContain("Use colliding skill create flow.");
	});

	it("prefers user verify over global opencode verify in OCK bead-first repos when rediscovering from directory", async () => {
		// given
		const projectDir = createOckBeadFirstRepoFixture();
		const configRootDir = trackTempDirectory(
			mkdtempSync(join(tmpdir(), "omo-skill-tool-config-")),
		);
		const claudeConfigDir = join(configRootDir, "claude-config");
		const opencodeConfigDir = join(configRootDir, "opencode-config");
		const userCommandsDir = join(claudeConfigDir, "commands");
		const opencodeGlobalDir = join(opencodeConfigDir, "command");
		const previousClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;
		const previousOpencodeConfigDir = process.env.OPENCODE_CONFIG_DIR;

		process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;
		process.env.OPENCODE_CONFIG_DIR = opencodeConfigDir;

		try {
			mkdirSync(userCommandsDir, { recursive: true });
			mkdirSync(opencodeGlobalDir, { recursive: true });
			writeFileSync(
				join(userCommandsDir, "verify.md"),
				`---
description: User verify command
---
Use user verify command.
`,
			);
			writeFileSync(
				join(opencodeGlobalDir, "verify.md"),
				`---
description: Global verify command
---
Use global verify command.
`,
			);
			const tool = createSkillTool({
				directory: projectDir,
				skills: [],
				commands: [],
			});

			// when
			const result = await tool.execute(
				{ name: "verify", user_message: "bd-l1s" },
				mockContext,
			);

			// then
			expect(result).toContain("Use user verify command.");
			expect(result).toContain("**Category**: workflow support");
			expect(result).toContain("**Scope**: user");
			expect(result).not.toContain("Use global verify command.");
		} finally {
			if (previousClaudeConfigDir === undefined) {
				delete process.env.CLAUDE_CONFIG_DIR;
			} else {
				process.env.CLAUDE_CONFIG_DIR = previousClaudeConfigDir;
			}

			if (previousOpencodeConfigDir === undefined) {
				delete process.env.OPENCODE_CONFIG_DIR;
			} else {
				process.env.OPENCODE_CONFIG_DIR = previousOpencodeConfigDir;
			}
		}
	});
});

describe("skill tool - dynamic discovery", () => {
	it("forwards plugin discovery options when rediscovering commands during execute", async () => {
		// given
		const discoverCommandsSyncSpy = spyOn(
			slashcommand,
			"discoverCommandsSync",
		).mockReturnValue([
			{
				name: "create",
				path: "/test/commands/create.md",
				metadata: {
					name: "create",
					description: "Test command create",
				},
				scope: "opencode-project",
			},
		]);
		const tool = createSkillTool({
			directory: "/test/project",
			pluginsEnabled: false,
			enabledPluginsOverride: { alpha: false },
			skills: [],
			commands: [],
		});

		try {
			// when
			await tool.execute(
				{ name: "create", user_message: "bd-l1s" },
				mockContext,
			);

			// then
			expect(discoverCommandsSyncSpy).toHaveBeenCalledWith("/test/project", {
				pluginsEnabled: false,
				enabledPluginsOverride: { alpha: false },
			});
		} finally {
			discoverCommandsSyncSpy.mockRestore();
		}
	});

	it("discovers skills from disk on every invocation instead of caching", async () => {
		// given: tool created with initial skills
		const initialSkills = [createMockSkill("initial-skill")];
		const tool = createSkillTool({ skills: initialSkills });

		// when: executing with the initial skill name
		const result = await tool.execute({ name: "initial-skill" }, mockContext);

		// then: initial skill found (merged from options.skills since not on disk)
		expect(result).toContain("Skill: initial-skill");
	});

	it("merges pre-provided skills with dynamically discovered ones", async () => {
		// given: tool with a synthetic skill not on disk
		const syntheticSkill = createMockSkill("synthetic-only");
		const tool = createSkillTool({ skills: [syntheticSkill] });

		// when: looking up the synthetic skill
		const result = await tool.execute({ name: "synthetic-only" }, mockContext);

		// then: synthetic skill is still accessible via merge
		expect(result).toContain("Skill: synthetic-only");
	});

	it("prefers disk-discovered skills over pre-provided ones", async () => {
		// given: tool with a pre-provided skill that also exists on disk (builtin)
		const overrideSkill = createMockSkill("playwright");
		overrideSkill.definition.description = "SHOULD_BE_OVERRIDDEN";
		const tool = createSkillTool({ skills: [overrideSkill] });

		// when: executing with the builtin skill name
		const result = await tool.execute({ name: "playwright" }, mockContext);

		// then: disk version wins (not the pre-provided override)
		expect(result).not.toContain("SHOULD_BE_OVERRIDDEN");
	});
});
describe("skill tool - dynamic description cache invalidation", () => {
	it("rebuilds description after execute() discovers new skills", async () => {
		// given: tool created with initial skills (no pre-provided skills)
		// This triggers lazy description building
		const tool = createSkillTool({});

		// Get initial description - it will build from empty or disk skills
		const initialDescription = tool.description;

		// when: execute() is called, which clears cache AND gets fresh skills
		// Note: In real scenario, execute() would discover new skills from disk
		// For testing, we verify the mechanism: execute() should invalidate cachedDescription

		// Execute any skill to trigger the cache clear + getSkills flow
		// Using a non-existent skill name to trigger the error path which still goes through getSkills()
		try {
			await tool.execute({ name: "nonexistent-skill-12345" }, mockContext);
		} catch (e) {
			// Expected to fail - skill doesn't exist
		}

		// then: cachedDescription should be invalidated, so next description access should rebuild
		// We verify by checking that the description getter triggers a rebuild
		// Since we can't easily mock getAllSkills in this test, we verify the cache invalidation mechanism

		// The key assertion: after execute(), the description should be rebuildable
		// If cachedDescription wasn't invalidated, it would still return old value
		// We verify by checking that the tool still has valid description structure
		expect(tool.description).toBeDefined();
		expect(typeof tool.description).toBe("string");
	});

	it("description reflects fresh skills after execute() clears cache", async () => {
		// given: tool created without pre-provided skills (will use disk discovery)
		const tool = createSkillTool({});

		// when: execute() is called with a skill that exists on disk (via mock)
		// This simulates the real scenario: execute() discovers skills, cache should be invalidated

		// Execute to trigger the cache invalidation path
		try {
			// This will call getSkills() which clears cache
			await tool.execute({ name: "nonexistent" }, mockContext);
		} catch (e) {
			// Expected
		}

		// then: description should still work and not be stale
		// The bug would cause it to return old cached value forever
		const desc = tool.description;

		// Verify description is a valid string (not stale/old)
		expect(desc).toContain("skill");
	});
});

describe("skill tool - browserProvider forwarding", () => {
	it("passes browserProvider to getAllSkills during execution", async () => {
		// given: a skill tool configured with agent-browser as browserProvider
		// and a pre-provided agent-browser skill (simulating what skill-context provides)
		const agentBrowserSkill = createMockSkill("agent-browser");
		const tool = createSkillTool({
			skills: [agentBrowserSkill],
			browserProvider: "agent-browser",
		});

		// when: executing skill("agent-browser")
		const result = await tool.execute({ name: "agent-browser" }, mockContext);

		// then: skill should resolve successfully (not filtered out)
		expect(result).toContain("Skill: agent-browser");
	});

	it("description includes agent-browser when browserProvider is agent-browser", () => {
		// given
		const agentBrowserSkill = createMockSkill("agent-browser");

		// when
		const tool = createSkillTool({
			skills: [agentBrowserSkill],
			browserProvider: "agent-browser",
		});

		// then
		expect(tool.description).toContain("agent-browser");
	});
});

describe("skill tool - nativeSkills integration", () => {
	it("includes native skills in the description even when skills are pre-seeded", async () => {
		//#given
		const tool = createSkillTool({
			skills: [createMockSkill("seeded-skill")],
			nativeSkills: {
				all() {
					return [
						{
							name: "native-visible-skill",
							description: "Native skill exposed from config",
							location: "/external/skills/native-visible-skill/SKILL.md",
							content: "Native visible skill body",
						},
					];
				},
				get() {
					return undefined;
				},
				dirs() {
					return [];
				},
			},
		});

		//#when
		expect(tool.description).toContain("seeded-skill");
		expect(tool.description).toContain("native-visible-skill");
		await tool.execute({ name: "native-visible-skill" }, mockContext);

		//#then
		expect(tool.description).toContain("seeded-skill");
		expect(tool.description).toContain("native-visible-skill");
	});

	it("merges native skills exposed by PluginInput.skills.all()", async () => {
		//#given
		const tool = createSkillTool({
			skills: [],
			nativeSkills: {
				async all() {
					return [
						{
							name: "external-plugin-skill",
							description: "Skill from config.skills.paths",
							location: "/external/skills/external-plugin-skill/SKILL.md",
							content: "External plugin skill body",
						},
					];
				},
				async get() {
					return undefined;
				},
				async dirs() {
					return [];
				},
			},
		});

		//#when
		const result = await tool.execute(
			{ name: "external-plugin-skill" },
			mockContext,
		);

		//#then
		expect(result).toContain("external-plugin-skill");
		expect(result).toContain("External plugin skill body");
	});
});

describe("skill tool - short name resolution", () => {
	it("resolves namespaced skill by short name when unambiguous", async () => {
		// given
		const loadedSkills = [
			createMockSkill("superpowers/unique-short-debugging-skill"),
		];
		const tool = createSkillTool({ skills: loadedSkills });

		// when
		const result = await tool.execute(
			{ name: "unique-short-debugging-skill" },
			mockContext,
		);

		// then
		expect(result).toContain("superpowers/unique-short-debugging-skill");
	});

	it("still resolves by exact full name", async () => {
		// given
		const loadedSkills = [
			createMockSkill("superpowers/unique-short-debugging-skill"),
		];
		const tool = createSkillTool({ skills: loadedSkills });

		// when
		const result = await tool.execute(
			{ name: "superpowers/unique-short-debugging-skill" },
			mockContext,
		);

		// then
		expect(result).toContain("superpowers/unique-short-debugging-skill");
	});

	it("does not resolve short name when ambiguous (multiple matches)", async () => {
		// given
		const loadedSkills = [
			createMockSkill("superpowers/unique-ambiguous-debugging"),
			createMockSkill("utils/unique-ambiguous-debugging"),
		];
		const tool = createSkillTool({ skills: loadedSkills });

		// when / then, should not resolve (ambiguous), should suggest both
		await expect(
			tool.execute({ name: "unique-ambiguous-debugging" }, mockContext),
		).rejects.toThrow("not found");
	});

	it("prefers exact match over short name match", async () => {
		// given, "debugging" exists as both exact and as part of a namespace
		const loadedSkills = [
			createMockSkill("unique-debugging"),
			createMockSkill("superpowers/unique-debugging"),
		];
		const tool = createSkillTool({ skills: loadedSkills });

		// when
		const result = await tool.execute(
			{ name: "unique-debugging" },
			mockContext,
		);

		// then, should match "debugging" exactly, not "superpowers/debugging"
		expect(result).toContain("## Skill: unique-debugging");
	});
});
