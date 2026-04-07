import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { OhMyOpenCodeConfig } from "../config";
import * as builtinCommands from "../features/builtin-commands";
import * as commandLoader from "../features/claude-code-command-loader";
import * as skillLoader from "../features/opencode-skill-loader";
import { getAgentListDisplayName } from "../shared/agent-display-names";
import { applyCommandConfig } from "./command-config-handler";
import type { PluginComponents } from "./plugin-components-loader";

const tempDirectories = new Set<string>();

function trackTempDirectory(directory: string): string {
	tempDirectories.add(directory);
	return directory;
}

function createOckBeadFirstRepoFixture(): string {
	const projectDir = trackTempDirectory(
		mkdtempSync(join(tmpdir(), "omo-command-config-ock-")),
	);
	const commandsDir = join(projectDir, ".opencode", "command");

	mkdirSync(join(projectDir, ".beads"), { recursive: true });
	mkdirSync(commandsDir, { recursive: true });

	for (const commandName of [
		"create.md",
		"research.md",
		"start.md",
		"ship.md",
	]) {
		writeFileSync(join(commandsDir, commandName), `# ${commandName}\n`);
	}

	return projectDir;
}

function createPluginComponents(): PluginComponents {
	return {
		commands: {},
		skills: {},
		agents: {},
		mcpServers: {},
		hooksConfigs: [],
		plugins: [],
		errors: [],
	};
}

function createPluginConfig(): OhMyOpenCodeConfig {
	return {};
}

describe("applyCommandConfig", () => {
	let loadBuiltinCommandsSpy: ReturnType<typeof spyOn>;
	let loadUserCommandsSpy: ReturnType<typeof spyOn>;
	let loadProjectCommandsSpy: ReturnType<typeof spyOn>;
	let loadOpencodeGlobalCommandsSpy: ReturnType<typeof spyOn>;
	let loadOpencodeProjectCommandsSpy: ReturnType<typeof spyOn>;
	let discoverConfigSourceSkillsSpy: ReturnType<typeof spyOn>;
	let loadUserSkillsSpy: ReturnType<typeof spyOn>;
	let loadProjectSkillsSpy: ReturnType<typeof spyOn>;
	let loadOpencodeGlobalSkillsSpy: ReturnType<typeof spyOn>;
	let loadOpencodeProjectSkillsSpy: ReturnType<typeof spyOn>;
	let loadProjectAgentsSkillsSpy: ReturnType<typeof spyOn>;
	let loadGlobalAgentsSkillsSpy: ReturnType<typeof spyOn>;

	beforeEach(() => {
		loadBuiltinCommandsSpy = spyOn(
			builtinCommands,
			"loadBuiltinCommands",
		).mockReturnValue({});
		loadUserCommandsSpy = spyOn(
			commandLoader,
			"loadUserCommands",
		).mockResolvedValue({});
		loadProjectCommandsSpy = spyOn(
			commandLoader,
			"loadProjectCommands",
		).mockResolvedValue({});
		loadOpencodeGlobalCommandsSpy = spyOn(
			commandLoader,
			"loadOpencodeGlobalCommands",
		).mockResolvedValue({});
		loadOpencodeProjectCommandsSpy = spyOn(
			commandLoader,
			"loadOpencodeProjectCommands",
		).mockResolvedValue({});
		discoverConfigSourceSkillsSpy = spyOn(
			skillLoader,
			"discoverConfigSourceSkills",
		).mockResolvedValue([]);
		loadUserSkillsSpy = spyOn(skillLoader, "loadUserSkills").mockResolvedValue(
			{},
		);
		loadProjectSkillsSpy = spyOn(
			skillLoader,
			"loadProjectSkills",
		).mockResolvedValue({});
		loadOpencodeGlobalSkillsSpy = spyOn(
			skillLoader,
			"loadOpencodeGlobalSkills",
		).mockResolvedValue({});
		loadOpencodeProjectSkillsSpy = spyOn(
			skillLoader,
			"loadOpencodeProjectSkills",
		).mockResolvedValue({});
		loadProjectAgentsSkillsSpy = spyOn(
			skillLoader,
			"loadProjectAgentsSkills",
		).mockResolvedValue({});
		loadGlobalAgentsSkillsSpy = spyOn(
			skillLoader,
			"loadGlobalAgentsSkills",
		).mockResolvedValue({});
	});

	afterEach(() => {
		for (const directory of tempDirectories) {
			rmSync(directory, { recursive: true, force: true });
		}
		tempDirectories.clear();
		loadBuiltinCommandsSpy.mockRestore();
		loadUserCommandsSpy.mockRestore();
		loadProjectCommandsSpy.mockRestore();
		loadOpencodeGlobalCommandsSpy.mockRestore();
		loadOpencodeProjectCommandsSpy.mockRestore();
		discoverConfigSourceSkillsSpy.mockRestore();
		loadUserSkillsSpy.mockRestore();
		loadProjectSkillsSpy.mockRestore();
		loadOpencodeGlobalSkillsSpy.mockRestore();
		loadOpencodeProjectSkillsSpy.mockRestore();
		loadProjectAgentsSkillsSpy.mockRestore();
		loadGlobalAgentsSkillsSpy.mockRestore();
	});

	test("includes .agents skills in command config", async () => {
		// given
		loadProjectAgentsSkillsSpy.mockResolvedValue({
			"agents-project-skill": {
				description: "(project - Skill) Agents project skill",
				template: "template",
			},
		});
		loadGlobalAgentsSkillsSpy.mockResolvedValue({
			"agents-global-skill": {
				description: "(user - Skill) Agents global skill",
				template: "template",
			},
		});
		const config: Record<string, unknown> = { command: {} };

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: "/tmp" },
			pluginComponents: createPluginComponents(),
		});

		// then
		const commandConfig = config.command as Record<
			string,
			{ description?: string }
		>;
		expect(commandConfig["agents-project-skill"]?.description).toContain(
			"Agents project skill",
		);
		expect(commandConfig["agents-global-skill"]?.description).toContain(
			"Agents global skill",
		);
	});

	test("remaps Atlas command agents to the list display name used by runtime agent lookup", async () => {
		// given
		loadBuiltinCommandsSpy.mockReturnValue({
			"start-work": {
				name: "start-work",
				description: "(builtin) Start work",
				template: "template",
				agent: "atlas",
			},
		});
		const config: Record<string, unknown> = { command: {} };

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: "/tmp" },
			pluginComponents: createPluginComponents(),
		});

		// then
		const commandConfig = config.command as Record<string, { agent?: string }>;
		expect(commandConfig["start-work"]?.agent).toBe(
			getAgentListDisplayName("atlas"),
		);
	});

	test("omits conflicting builtin workflow commands in OCK bead-first repos", async () => {
		// given
		loadBuiltinCommandsSpy.mockReturnValue({
			"start-work": {
				name: "start-work",
				description: "Builtin start-work",
				template: "builtin start-work",
			},
			"ralph-loop": {
				name: "ralph-loop",
				description: "Builtin ralph-loop",
				template: "builtin ralph-loop",
			},
			"ulw-loop": {
				name: "ulw-loop",
				description: "Builtin ulw-loop",
				template: "builtin ulw-loop",
			},
			"cancel-ralph": {
				name: "cancel-ralph",
				description: "Builtin cancel-ralph",
				template: "builtin cancel-ralph",
			},
			"stop-continuation": {
				name: "stop-continuation",
				description: "Builtin stop-continuation",
				template: "builtin stop-continuation",
			},
			refactor: {
				name: "refactor",
				description: "Builtin refactor",
				template: "builtin refactor",
			},
		});
		const config: Record<string, unknown> = { command: {} };

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: createOckBeadFirstRepoFixture() },
			pluginComponents: createPluginComponents(),
		});

		// then
		const commandConfig = config.command as Record<
			string,
			{ template?: string }
		>;
		expect(commandConfig).not.toHaveProperty("start-work");
		expect(commandConfig).not.toHaveProperty("ralph-loop");
		expect(commandConfig).not.toHaveProperty("ulw-loop");
		expect(commandConfig).not.toHaveProperty("cancel-ralph");
		expect(commandConfig).not.toHaveProperty("stop-continuation");
		expect(commandConfig.refactor?.template).toBe("builtin refactor");
	});

	test("keeps conflicting builtin workflow commands in non-OCK repos", async () => {
		// given
		loadBuiltinCommandsSpy.mockReturnValue({
			"start-work": {
				name: "start-work",
				description: "Builtin start-work",
				template: "builtin start-work",
			},
			"ralph-loop": {
				name: "ralph-loop",
				description: "Builtin ralph-loop",
				template: "builtin ralph-loop",
			},
			refactor: {
				name: "refactor",
				description: "Builtin refactor",
				template: "builtin refactor",
			},
		});
		const config: Record<string, unknown> = { command: {} };

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: "/tmp/non-ock-project" },
			pluginComponents: createPluginComponents(),
		});

		// then
		const commandConfig = config.command as Record<
			string,
			{ template?: string }
		>;
		expect(commandConfig["start-work"]?.template).toBe("builtin start-work");
		expect(commandConfig["ralph-loop"]?.template).toBe("builtin ralph-loop");
		expect(commandConfig.refactor?.template).toBe("builtin refactor");
	});

	test("prefers bead-backed workflow commands over project and plugin collisions in OCK projects", async () => {
		// given
		loadProjectCommandsSpy.mockResolvedValue({
			create: {
				name: "create",
				description: "Legacy project create",
				template: "legacy project create",
			},
			verify: {
				name: "verify",
				description: "Legacy project verify",
				template: "legacy project verify",
			},
			compound: {
				name: "compound",
				description: "Legacy project compound",
				template: "legacy project compound",
			},
		});
		loadOpencodeProjectCommandsSpy.mockResolvedValue({
			create: {
				name: "create",
				description: "Bead-backed create",
				template: "bead-backed create",
			},
			verify: {
				name: "verify",
				description: "Bead-backed verify",
				template: "bead-backed verify",
			},
			compound: {
				name: "compound",
				description: "Bead-backed compound",
				template: "bead-backed compound",
			},
		});
		const config: Record<string, unknown> = { command: {} };
		const pluginComponents = createPluginComponents();
		pluginComponents.commands = {
			create: {
				name: "create",
				description: "Plugin create",
				template: "plugin create",
			},
			verify: {
				name: "verify",
				description: "Plugin verify",
				template: "plugin verify",
			},
			compound: {
				name: "compound",
				description: "Plugin compound",
				template: "plugin compound",
			},
		};

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: "/work/ock-omo-system" },
			pluginComponents,
		});

		// then
		const commandConfig = config.command as Record<
			string,
			{ template?: string }
		>;
		expect(commandConfig.create?.template).toBe("bead-backed create");
		expect(commandConfig.verify?.template).toBe("bead-backed verify");
		expect(commandConfig.compound?.template).toBe("bead-backed compound");
	});

	test("orders workflow commands ahead of support and compatibility commands in OCK projects", async () => {
		// given
		loadUserCommandsSpy.mockResolvedValue({
			lfg: {
				name: "lfg",
				description: "User lfg",
				template: "user lfg",
			},
			compound: {
				name: "compound",
				description: "User compound",
				template: "user compound",
			},
			create: {
				name: "create",
				description: "User create",
				template: "user create",
			},
			verify: {
				name: "verify",
				description: "User verify",
				template: "user verify",
			},
		});
		loadOpencodeProjectCommandsSpy.mockResolvedValue({
			lfg: {
				name: "lfg",
				description: "Bead-backed lfg",
				template: "bead-backed lfg",
			},
			compound: {
				name: "compound",
				description: "Bead-backed compound",
				template: "bead-backed compound",
			},
			create: {
				name: "create",
				description: "Bead-backed create",
				template: "bead-backed create",
			},
			verify: {
				name: "verify",
				description: "Bead-backed verify",
				template: "bead-backed verify",
			},
		});
		const config: Record<string, unknown> = { command: {} };

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: createOckBeadFirstRepoFixture() },
			pluginComponents: createPluginComponents(),
		});

		// then
		const workflowNames = Object.keys(
			config.command as Record<string, unknown>,
		).filter((name) => ["create", "verify", "lfg", "compound"].includes(name));
		expect(workflowNames).toEqual(["create", "verify", "lfg", "compound"]);
	});

	test("prefers user workflow support commands over global opencode collisions in OCK projects", async () => {
		// given
		loadUserCommandsSpy.mockResolvedValue({
			verify: {
				name: "verify",
				description: "User verify",
				template: "user verify",
			},
		});
		loadOpencodeGlobalCommandsSpy.mockResolvedValue({
			verify: {
				name: "verify",
				description: "Global opencode verify",
				template: "global opencode verify",
			},
		});
		const config: Record<string, unknown> = { command: {} };

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: createOckBeadFirstRepoFixture() },
			pluginComponents: createPluginComponents(),
		});

		// then
		const commandConfig = config.command as Record<
			string,
			{ template?: string }
		>;
		expect(commandConfig.verify?.template).toBe("user verify");
	});

	test("prefers bead-backed handoff over builtin handoff in OCK projects", async () => {
		// given
		loadBuiltinCommandsSpy.mockReturnValue({
			handoff: {
				name: "handoff",
				description: "Builtin handoff",
				template: "builtin handoff",
			},
		});
		loadOpencodeProjectCommandsSpy.mockResolvedValue({
			handoff: {
				name: "handoff",
				description: "Bead-backed handoff",
				template: "bead-backed handoff",
			},
		});
		const config: Record<string, unknown> = { command: {} };

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: createOckBeadFirstRepoFixture() },
			pluginComponents: createPluginComponents(),
		});

		// then
		const commandConfig = config.command as Record<
			string,
			{ template?: string }
		>;
		expect(commandConfig.handoff?.template).toBe("bead-backed handoff");
	});

	test("keeps last-write-wins for non-workflow command collisions", async () => {
		// given
		loadProjectCommandsSpy.mockResolvedValue({
			custom: {
				name: "custom",
				description: "Project custom",
				template: "project custom",
			},
		});
		loadOpencodeProjectCommandsSpy.mockResolvedValue({
			custom: {
				name: "custom",
				description: "Opencode custom",
				template: "opencode custom",
			},
		});
		const config: Record<string, unknown> = { command: {} };
		const pluginComponents = createPluginComponents();
		pluginComponents.commands = {
			custom: {
				name: "custom",
				description: "Plugin custom",
				template: "plugin custom",
			},
		};

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: "/work/ock-omo-system" },
			pluginComponents,
		});

		// then
		const commandConfig = config.command as Record<
			string,
			{ template?: string }
		>;
		expect(commandConfig.custom?.template).toBe("plugin custom");
	});

	test("keeps last-write-wins for workflow collisions outside OCK projects", async () => {
		// given
		loadProjectCommandsSpy.mockResolvedValue({
			create: {
				name: "create",
				description: "Project create",
				template: "project create",
			},
		});
		loadOpencodeProjectCommandsSpy.mockResolvedValue({
			create: {
				name: "create",
				description: "Opencode create",
				template: "opencode create",
			},
		});
		const config: Record<string, unknown> = { command: {} };
		const pluginComponents = createPluginComponents();
		pluginComponents.commands = {
			create: {
				name: "create",
				description: "Plugin create",
				template: "plugin create",
			},
		};

		// when
		await applyCommandConfig({
			config,
			pluginConfig: createPluginConfig(),
			ctx: { directory: "/tmp/non-ock-project" },
			pluginComponents,
		});

		// then
		const commandConfig = config.command as Record<
			string,
			{ template?: string }
		>;
		expect(commandConfig.create?.template).toBe("plugin create");
	});
});
