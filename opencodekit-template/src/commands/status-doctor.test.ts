import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";

const promptMocks = vi.hoisted(() => ({
	intro: vi.fn(),
	outro: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
	intro: promptMocks.intro,
	outro: promptMocks.outro,
	log: {
		warn: promptMocks.warn,
		info: promptMocks.info,
	},
}));

import { doctorCommand } from "./doctor.js";
import { statusCommand } from "./status.js";

const ORIGINAL_ARGV = [...process.argv];
const ORIGINAL_CWD = process.cwd();
const tempProjects: string[] = [];

function createTempProject(prefix: string) {
	const projectDir = mkdtempSync(join(tmpdir(), prefix));
	tempProjects.push(projectDir);
	return projectDir;
}

function createOpencodeProject(rootDir: string, options: { installDependencies?: boolean } = {}) {
	const opencodeDir = join(rootDir, ".opencode");
	mkdirSync(opencodeDir, { recursive: true });
	if (options.installDependencies !== false) {
		mkdirSync(join(opencodeDir, "node_modules"), { recursive: true });
	}
	writeFileSync(
		join(opencodeDir, "opencode.json"),
		JSON.stringify({
			$schema: "https://opencode.ai/config.json",
			model: "openai/gpt-5.4",
			mcp: {},
			plugin: ["oh-my-openagent"],
		}),
	);
	writeFileSync(join(opencodeDir, "package.json"), JSON.stringify({ name: "fixture" }));
	return opencodeDir;
}

afterEach(() => {
	process.argv = [...ORIGINAL_ARGV];
	process.chdir(ORIGINAL_CWD);
	process.exitCode = undefined;
	vi.restoreAllMocks();
	promptMocks.intro.mockReset();
	promptMocks.outro.mockReset();
	promptMocks.warn.mockReset();
	promptMocks.info.mockReset();
	while (tempProjects.length > 0) {
		const projectDir = tempProjects.pop();
		if (projectDir) {
			rmSync(projectDir, { recursive: true, force: true });
		}
	}
});

describe("statusCommand", () => {
	it("shows npm dependency guidance when project dependencies are missing", async () => {
		const projectDir = createTempProject("ock-status-");
		createOpencodeProject(projectDir, { installDependencies: false });
		mkdirSync(join(projectDir, ".opencode", "agent"), { recursive: true });

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		vi.spyOn(console, "log").mockImplementation(() => undefined);

		await statusCommand();

		expect(promptMocks.warn).toHaveBeenCalledWith(
			expect.stringContaining("Dependencies not installed"),
		);
		expect(promptMocks.info).toHaveBeenCalledWith(
			expect.stringContaining("cd .opencode && npm install"),
		);
	});
});

describe("doctorCommand", () => {
	it("reports npm dependency guidance in the structure checks", async () => {
		const projectDir = createTempProject("ock-doctor-");
		createOpencodeProject(projectDir, { installDependencies: false });

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Dependencies installed"));
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("cd .opencode && npm install"),
		);
	});

	it("reports bridge OK with exit code 0 when canonical registration is healthy", async () => {
		const projectDir = createTempProject("ock-doctor-bridge-ok-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(join(opencodeDir, "agent", "build.md"), "---\nmode: primary\n---\n# Build\n")
		writeFileSync(join(opencodeDir, "skill", "demo", "SKILL.md"), "---\nname: demo\ndescription: demo\n---\n")
		writeFileSync(join(opencodeDir, "oh-my-openagent.jsonc"), "{}\n")

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("BRIDGE OK: canonical OMO runtime registration detected"),
		);
		expect(process.exitCode ?? 0).toBe(0);
	});

	it("reports dual basename warning and exit code 2 when canonical and legacy config files coexist", async () => {
		const projectDir = createTempProject("ock-doctor-bridge-warn-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(join(opencodeDir, "agent", "build.md"), "---\nmode: primary\n---\n# Build\n")
		writeFileSync(join(opencodeDir, "skill", "demo", "SKILL.md"), "---\nname: demo\ndescription: demo\n---\n")
		writeFileSync(join(opencodeDir, "oh-my-openagent.jsonc"), "{}\n")
		writeFileSync(join(opencodeDir, "oh-my-opencode.jsonc"), "{}\n")

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"BRIDGE WARNING: both canonical and legacy runtime config basenames exist; OMO currently loads canonical first",
			),
		);
		expect(process.exitCode).toBe(2);
	});

	it("reports canonical plugin entry errors and exit code 1 when registration is missing", async () => {
		const projectDir = createTempProject("ock-doctor-bridge-error-");
		const opencodeDir = join(projectDir, ".opencode");
		mkdirSync(opencodeDir, { recursive: true });
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		mkdirSync(join(opencodeDir, "node_modules"), { recursive: true });
		writeFileSync(join(opencodeDir, "agent", "build.md"), "---\nmode: primary\n---\n# Build\n")
		writeFileSync(join(opencodeDir, "package.json"), JSON.stringify({ name: "fixture" }));
		writeFileSync(join(opencodeDir, "opencode.json"), JSON.stringify({ mcp: {}, plugin: ["other-plugin"] }));
		writeFileSync(join(opencodeDir, "skill", "demo", "SKILL.md"), "---\nname: demo\ndescription: demo\n---\n")

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				'BRIDGE ERROR: canonical plugin entry "oh-my-openagent" missing from .opencode/opencode.json',
			),
		);
		expect(process.exitCode).toBe(1);
	});

	it("reports preserved legacy-authored content drift and shows WARN bridge health in status", async () => {
		const projectDir = createTempProject("ock-status-bridge-drift-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		writeFileSync(join(opencodeDir, "agent", "build.md"), "---\nmode: primary\n---\n# Build\n")
		mkdirSync(join(opencodeDir, "skill", "context-management"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "skill", "context-management", "SKILL.md"),
			"find_sessions({ query: \"auth\" })\n",
		);
		writeFileSync(join(opencodeDir, "oh-my-openagent.jsonc"), "{}\n")

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

		await statusCommand();

		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Bridge Health"));
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("WARN"));
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("BRIDGE WARNING: preserved project content still references legacy runtime surfaces"),
		);
		expect(process.exitCode ?? 0).toBe(0);
	});
});
