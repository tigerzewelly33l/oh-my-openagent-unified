import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LoadedSkill } from "../../features/opencode-skill-loader";
import { executeSlashCommand } from "./executor";

const ENV_KEYS = [
	"CLAUDE_CONFIG_DIR",
	"CLAUDE_PLUGINS_HOME",
	"CLAUDE_SETTINGS_PATH",
	"OPENCODE_CONFIG_DIR",
] as const;

type EnvKey = (typeof ENV_KEYS)[number];
type EnvSnapshot = Record<EnvKey, string | undefined>;

function writePluginFixture(baseDir: string): void {
	const claudeConfigDir = join(baseDir, "claude-config");
	const pluginsHome = join(claudeConfigDir, "plugins");
	const settingsPath = join(claudeConfigDir, "settings.json");
	const opencodeConfigDir = join(baseDir, "opencode-config");
	const pluginInstallPath = join(baseDir, "installed-plugins", "daplug");
	const pluginKey = "daplug@1.0.0";

	mkdirSync(join(pluginInstallPath, ".claude-plugin"), { recursive: true });
	mkdirSync(join(pluginInstallPath, "commands"), { recursive: true });

	writeFileSync(
		join(pluginInstallPath, ".claude-plugin", "plugin.json"),
		JSON.stringify({ name: "daplug", version: "1.0.0" }, null, 2),
	);
	writeFileSync(
		join(pluginInstallPath, "commands", "run-prompt.md"),
		`---
description: Run prompt from daplug
---
Execute daplug prompt flow.
`,
	);
	writeFileSync(
		join(pluginInstallPath, "commands", "templated.md"),
		`---
description: Templated prompt from daplug
---
Echo $ARGUMENTS and \${user_message}.
`,
	);

	mkdirSync(pluginsHome, { recursive: true });
	writeFileSync(
		join(pluginsHome, "installed_plugins.json"),
		JSON.stringify(
			{
				version: 2,
				plugins: {
					[pluginKey]: [
						{
							scope: "user",
							installPath: pluginInstallPath,
							version: "1.0.0",
							installedAt: "2026-01-01T00:00:00.000Z",
							lastUpdated: "2026-01-01T00:00:00.000Z",
						},
					],
				},
			},
			null,
			2,
		),
	);

	mkdirSync(claudeConfigDir, { recursive: true });
	writeFileSync(
		settingsPath,
		JSON.stringify(
			{
				enabledPlugins: {
					[pluginKey]: true,
				},
			},
			null,
			2,
		),
	);
	mkdirSync(opencodeConfigDir, { recursive: true });

	process.env.CLAUDE_CONFIG_DIR = claudeConfigDir;
	process.env.CLAUDE_PLUGINS_HOME = pluginsHome;
	process.env.CLAUDE_SETTINGS_PATH = settingsPath;
	process.env.OPENCODE_CONFIG_DIR = opencodeConfigDir;
}

describe("auto-slash command executor plugin dispatch", () => {
	let tempDir = "";
	let envSnapshot: EnvSnapshot;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "omo-executor-plugin-test-"));
		envSnapshot = {
			CLAUDE_CONFIG_DIR: process.env.CLAUDE_CONFIG_DIR,
			CLAUDE_PLUGINS_HOME: process.env.CLAUDE_PLUGINS_HOME,
			CLAUDE_SETTINGS_PATH: process.env.CLAUDE_SETTINGS_PATH,
			OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
		};
		writePluginFixture(tempDir);
	});

	afterEach(() => {
		for (const key of ENV_KEYS) {
			const previousValue = envSnapshot[key];
			if (previousValue === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = previousValue;
			}
		}
		rmSync(tempDir, { recursive: true, force: true });
	});

	it("resolves marketplace plugin commands when plugin loading is enabled", async () => {
		const result = await executeSlashCommand(
			{
				command: "daplug:run-prompt",
				args: "ship it",
				raw: "/daplug:run-prompt ship it",
			},
			{
				skills: [],
				pluginsEnabled: true,
			},
		);

		expect(result.success).toBe(true);
		expect(result.replacementText).toContain("# /daplug:run-prompt Command");
		expect(result.replacementText).toContain("**Scope**: plugin");
	});

	it("excludes marketplace commands when plugins are disabled via config toggle", async () => {
		const result = await executeSlashCommand(
			{
				command: "daplug:run-prompt",
				args: "",
				raw: "/daplug:run-prompt",
			},
			{
				skills: [],
				pluginsEnabled: false,
			},
		);

		expect(result.success).toBe(false);
		expect(result.error).toBe(
			'Command "/daplug:run-prompt" not found. Use the skill tool to list available skills and commands.',
		);
	});

	it("returns standard not-found for unknown namespaced commands", async () => {
		const result = await executeSlashCommand(
			{
				command: "daplug:missing",
				args: "",
				raw: "/daplug:missing",
			},
			{
				skills: [],
				pluginsEnabled: true,
			},
		);

		expect(result.success).toBe(false);
		expect(result.error).toBe(
			'Command "/daplug:missing" not found. Use the skill tool to list available skills and commands.',
		);
		expect(result.error).not.toContain("Marketplace plugin commands");
	});

	it("replaces $ARGUMENTS placeholders in plugin command templates", async () => {
		const result = await executeSlashCommand(
			{
				command: "daplug:templated",
				args: "ship it",
				raw: "/daplug:templated ship it",
			},
			{
				skills: [],
				pluginsEnabled: true,
			},
		);

		expect(result.success).toBe(true);
		expect(result.replacementText).toContain("Echo ship it and ship it.");
		expect(result.replacementText).not.toContain("$ARGUMENTS");
		expect(result.replacementText).not.toContain("${user_message}");
	});

	it("renders Atlas as the builtin start-work agent during slash-command execution", async () => {
		// given
		const nonOckProjectDir = join(tempDir, "non-ock-project");
		mkdirSync(nonOckProjectDir, { recursive: true });

		// when
		const result = await executeSlashCommand(
			{
				command: "start-work",
				args: "",
				raw: "/start-work",
			},
			{
				skills: [],
				directory: nonOckProjectDir,
			},
		);

		// then
		expect(result.success).toBe(true);
		expect(result.replacementText).toContain("**Agent**: atlas");
	});

	it("prefers bead-backed opencode workflow commands over same-named claude commands in OCK projects", async () => {
		// given
		const projectDir = join(tempDir, "ock-project");
		const opencodeCommandDir = join(projectDir, ".opencode", "command");
		const claudeCommandDir = join(projectDir, ".claude", "commands");

		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		mkdirSync(opencodeCommandDir, { recursive: true });
		mkdirSync(claudeCommandDir, { recursive: true });

		writeFileSync(
			join(opencodeCommandDir, "create.md"),
			`---
description: Canonical create command
---
Use bead-backed create workflow.
`,
		);
		writeFileSync(
			join(opencodeCommandDir, "start.md"),
			`---
description: Canonical start command
---
Use bead-backed start workflow.
`,
		);
		writeFileSync(
			join(opencodeCommandDir, "research.md"),
			`---
description: Canonical research command
---
Use bead-backed research workflow.
`,
		);
		writeFileSync(
			join(opencodeCommandDir, "ship.md"),
			`---
description: Canonical ship command
---
Use bead-backed ship workflow.
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

		// when
		const result = await executeSlashCommand(
			{
				command: "create",
				args: "new task",
				raw: "/create new task",
			},
			{
				skills: [],
				directory: projectDir,
			},
		);

		// then
		expect(result.success).toBe(true);
		expect(result.replacementText).toContain(
			"Use bead-backed create workflow.",
		);
		expect(result.replacementText).toContain("**Category**: primary workflow");
		expect(result.replacementText).toContain("**Scope**: opencode-project");
		expect(result.replacementText).not.toContain(
			"Use legacy claude create flow.",
		);
	});

	it("does not resolve suppressed builtin workflow commands in OCK projects", async () => {
		// given
		const projectDir = join(tempDir, "ock-project-builtins");
		const opencodeCommandDir = join(projectDir, ".opencode", "command");

		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		mkdirSync(opencodeCommandDir, { recursive: true });
		for (const commandName of [
			"create.md",
			"research.md",
			"start.md",
			"ship.md",
		]) {
			writeFileSync(
				join(opencodeCommandDir, commandName),
				`# ${commandName}\n`,
			);
		}

		// when
		const result = await executeSlashCommand(
			{
				command: "start-work",
				args: "",
				raw: "/start-work",
			},
			{
				skills: [],
				directory: projectDir,
			},
		);

		// then
		expect(result.success).toBe(false);
		expect(result.error).toBe(
			'Command "/start-work" not found. Use the skill tool to list available skills and commands.',
		);
	});

	it("prefers user workflow support commands over global opencode collisions in OCK projects", async () => {
		// given
		const projectDir = join(tempDir, "ock-project-user-verify");
		const opencodeCommandDir = join(projectDir, ".opencode", "command");
		const userCommandsDir = join(process.env.CLAUDE_CONFIG_DIR!, "commands");
		const opencodeGlobalDir = join(process.env.OPENCODE_CONFIG_DIR!, "command");

		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		mkdirSync(opencodeCommandDir, { recursive: true });
		mkdirSync(userCommandsDir, { recursive: true });
		mkdirSync(opencodeGlobalDir, { recursive: true });
		for (const commandName of [
			"create.md",
			"research.md",
			"start.md",
			"ship.md",
		]) {
			writeFileSync(
				join(opencodeCommandDir, commandName),
				`# ${commandName}\n`,
			);
		}
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
description: Global opencode verify command
---
Use global opencode verify command.
`,
		);

		// when
		const result = await executeSlashCommand(
			{
				command: "verify",
				args: "bd-l1s",
				raw: "/verify bd-l1s",
			},
			{
				skills: [],
				directory: projectDir,
			},
		);

		// then
		expect(result.success).toBe(true);
		expect(result.replacementText).toContain("Use user verify command.");
		expect(result.replacementText).toContain("**Category**: workflow support");
		expect(result.replacementText).toContain("**Scope**: user");
		expect(result.replacementText).not.toContain(
			"Use global opencode verify command.",
		);
	});

	it("prefers bead-backed handoff over builtin handoff in OCK projects", async () => {
		// given
		const projectDir = join(tempDir, "ock-project-handoff");
		const opencodeCommandDir = join(projectDir, ".opencode", "command");

		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		mkdirSync(opencodeCommandDir, { recursive: true });
		for (const commandName of [
			"create.md",
			"research.md",
			"start.md",
			"ship.md",
		]) {
			writeFileSync(
				join(opencodeCommandDir, commandName),
				`# ${commandName}\n`,
			);
		}
		writeFileSync(
			join(opencodeCommandDir, "handoff.md"),
			`---
description: Bead-backed handoff command
---
Use bead-backed handoff command.
`,
		);

		// when
		const result = await executeSlashCommand(
			{
				command: "handoff",
				args: "bd-l1s",
				raw: "/handoff bd-l1s",
			},
			{
				skills: [],
				directory: projectDir,
			},
		);

		// then
		expect(result.success).toBe(true);
		expect(result.replacementText).toContain(
			"Use bead-backed handoff command.",
		);
		expect(result.replacementText).toContain("**Category**: workflow support");
		expect(result.replacementText).toContain("**Scope**: opencode-project");
		expect(result.replacementText).not.toContain("**Agent**: prometheus");
	});

	it("marks compatibility commands as adapters during slash-command execution in OCK projects", async () => {
		// given
		const projectDir = join(tempDir, "ock-project-compound");
		const opencodeCommandDir = join(projectDir, ".opencode", "command");

		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		mkdirSync(opencodeCommandDir, { recursive: true });
		for (const commandName of [
			"create.md",
			"research.md",
			"start.md",
			"ship.md",
		]) {
			writeFileSync(
				join(opencodeCommandDir, commandName),
				`# ${commandName}\n`,
			);
		}
		writeFileSync(
			join(opencodeCommandDir, "lfg.md"),
			`---
description: Compatibility full-cycle adapter
---
Run full compatibility workflow.
`,
		);
		writeFileSync(
			join(opencodeCommandDir, "compound.md"),
			`---
description: Compatibility adapter
---
Run compatibility flow.
`,
		);

		// when
		const result = await executeSlashCommand(
			{
				command: "lfg",
				args: "bd-l1s",
				raw: "/lfg bd-l1s",
			},
			{
				skills: [],
				directory: projectDir,
			},
		);
		const compoundResult = await executeSlashCommand(
			{
				command: "compound",
				args: "bd-l1s",
				raw: "/compound bd-l1s",
			},
			{
				skills: [],
				directory: projectDir,
			},
		);

		// then
		expect(result.success).toBe(true);
		expect(result.replacementText).toContain(
			"**Category**: compatibility adapter",
		);
		expect(result.replacementText).toContain(
			"Run full compatibility workflow.",
		);
		expect(compoundResult.success).toBe(true);
		expect(compoundResult.replacementText).toContain(
			"**Category**: compatibility adapter",
		);
		expect(compoundResult.replacementText).toContain("Run compatibility flow.");
	});

	it("prefers bead-backed workflow commands over same-named skills in OCK projects", async () => {
		// given
		const projectDir = join(tempDir, "ock-project-skill-collision");
		const opencodeCommandDir = join(projectDir, ".opencode", "command");
		const collidingSkill: LoadedSkill = {
			name: "create",
			definition: {
				name: "create",
				description: "Colliding skill create",
				template: "Use colliding skill create flow.",
			},
			scope: "project",
		};

		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		mkdirSync(opencodeCommandDir, { recursive: true });
		for (const commandName of [
			"create.md",
			"research.md",
			"start.md",
			"ship.md",
		]) {
			writeFileSync(
				join(opencodeCommandDir, commandName),
				`# ${commandName}\n`,
			);
		}
		writeFileSync(
			join(opencodeCommandDir, "create.md"),
			`---
description: Canonical create command
---
Use bead-backed create workflow.
`,
		);

		// when
		const result = await executeSlashCommand(
			{
				command: "create",
				args: "new task",
				raw: "/create new task",
			},
			{
				skills: [collidingSkill],
				directory: projectDir,
			},
		);

		// then
		expect(result.success).toBe(true);
		expect(result.replacementText).toContain(
			"Use bead-backed create workflow.",
		);
		expect(result.replacementText).toContain("**Scope**: opencode-project");
		expect(result.replacementText).not.toContain(
			"Use colliding skill create flow.",
		);
	});
});
