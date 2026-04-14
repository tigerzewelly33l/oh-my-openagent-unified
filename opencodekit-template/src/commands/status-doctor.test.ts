import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

import { writeRuntimeArtifacts } from "./beads-runtime-test-artifacts.js";
import { doctorCommand } from "./doctor.js";
import {
	createOpencodeProject,
	createTempProject,
} from "./opencode-project-fixture.js";
import { publishPlanSnapshot } from "./plan-publish.js";
import { statusCommand } from "./status.js";

const ORIGINAL_ARGV = [...process.argv];
const ORIGINAL_CWD = process.cwd();
const ORIGINAL_PATH = process.env.PATH;

afterEach(() => {
	process.argv = [...ORIGINAL_ARGV];
	process.chdir(ORIGINAL_CWD);
	process.exitCode = undefined;
	process.env.PATH = ORIGINAL_PATH;
	vi.restoreAllMocks();
	promptMocks.intro.mockReset();
	promptMocks.outro.mockReset();
	promptMocks.warn.mockReset();
	promptMocks.info.mockReset();
});

function writeManagedRuntimeConfig(
	opencodeDir: string,
	experimental: { beads_runtime?: boolean; task_system?: boolean },
) {
	writeFileSync(
		join(opencodeDir, "oh-my-openagent.jsonc"),
		`${JSON.stringify({ experimental }, null, 2)}\n`,
	);
}

function installFakeBr(projectDir: string, scriptBody: string) {
	const binDir = join(projectDir, "bin");
	mkdirSync(binDir, { recursive: true });
	const brPath = join(binDir, "br");
	writeFileSync(brPath, `#!/usr/bin/env bash\n${scriptBody}\n`);
	chmodSync(brPath, 0o755);
	process.env.PATH = `${binDir}:${ORIGINAL_PATH ?? ""}`;
}

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

	it("prints a separate Beads Runtime section for a healthy beads-runtime project", async () => {
		const projectDir = createTempProject("ock-status-beads-runtime-ok-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: false,
		});
		installFakeBr(projectDir, "printf '[]\\n'");

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await statusCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("Beads Runtime"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("experimental.beads_runtime is enabled"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("br ready --json succeeded in the current repo"),
		);
	});
});

describe("doctorCommand", () => {
	it("runs runtime-state repair in json mode and preserves warning exit semantics", async () => {
		const projectDir = createTempProject("ock-doctor-repair-json-");
		createOpencodeProject(projectDir);
		installFakeBr(
			projectDir,
			[
				'if [ "$1" = "create" ]; then printf \'%s\' \'{"id":"bd-1"}\'; exit 0; fi',
				'if [ "$1" = "show" ]; then printf \'%s\' "[{\\"id\\":\\"$2\\",\\"status\\":\\"open\\"}]"; exit 0; fi',
				'if [ "$1" = "list" ]; then printf \'%s\' \'{"issues":[{"id":"bd-1","status":"open"}]}\'; exit 0; fi',
				'if [ "$1" = "ready" ]; then printf \'%s\' \'[{"id":"bd-1","status":"open"}]\'; exit 0; fi',
				'printf "unsupported" >&2',
				"exit 1",
			].join("\n"),
		);
		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		writeFileSync(join(projectDir, ".beads", "config.yaml"), "version: 1\n");
		const bead = JSON.parse(
			execFileSync(
				"br",
				["create", "Repair", "--type", "task", "--priority", "1", "--json"],
				{
					cwd: projectDir,
					encoding: "utf-8",
				},
			),
		) as { id: string };
		writeFileSync(
			join(projectDir, ".beads", "ledger.json"),
			JSON.stringify(
				{ next: 2, tasks: [{ id: bead.id, title: "Repair", status: "open" }] },
				null,
				2,
			),
		);
		writeRuntimeArtifacts(projectDir, bead.id);
		mkdirSync(join(projectDir, ".sisyphus", "plans"), { recursive: true });
		writeFileSync(
			join(projectDir, ".sisyphus", "plans", "repair.md"),
			"# Plan\n",
		);
		publishPlanSnapshot({
			projectDir,
			beadId: bead.id,
			sourcePlanPath: ".sisyphus/plans/repair.md",
			planContent: "# Plan\n",
			now: new Date("2026-04-12T10:00:00.000Z"),
		});

		process.chdir(projectDir);
		process.argv = [
			"node",
			"ock",
			"doctor",
			"--repair",
			"runtime-state",
			"--json",
			"--bead",
			bead.id,
		];
		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand({ repair: "runtime-state", json: true, bead: bead.id });

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining('"target": "runtime-state"'),
		);
		expect(process.exitCode ?? 0).toBe(0);
	});

	it("reports npm dependency guidance in the structure checks", async () => {
		const projectDir = createTempProject("ock-doctor-");
		createOpencodeProject(projectDir, { installDependencies: false });

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("Dependencies installed"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("cd .opencode && npm install"),
		);
	});

	it("reports bridge OK with exit code 0 when canonical registration is healthy", async () => {
		const projectDir = createTempProject("ock-doctor-bridge-ok-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeFileSync(join(opencodeDir, "oh-my-openagent.jsonc"), "{}\n");

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"BRIDGE OK: canonical OMO runtime registration detected",
			),
		);
		expect(process.exitCode ?? 0).toBe(0);
	});

	it("reports beads-runtime OK with exit code 0 for a healthy project", async () => {
		const projectDir = createTempProject("ock-doctor-beads-runtime-ok-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: false,
		});
		installFakeBr(projectDir, "printf '[]\\n'");

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("managed config present"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("br ready --json succeeded in the current repo"),
		);
		expect(process.exitCode ?? 0).toBe(0);
	});

	it("reports missing br as a beads-runtime error with exit code 1", async () => {
		const projectDir = createTempProject("ock-doctor-beads-runtime-no-br-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: false,
		});
		process.env.PATH = "/nonexistent";

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"br is unavailable for beads-runtime reads in the current repo",
			),
		);
		expect(process.exitCode).toBe(1);
	});

	it("reports config collisions as a beads-runtime error with exit code 1", async () => {
		const projectDir = createTempProject("ock-doctor-beads-runtime-collision-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: true,
		});
		installFakeBr(projectDir, "printf '[]\\n'");

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"experimental.task_system collides with experimental.beads_runtime in managed runtime config",
			),
		);
		expect(process.exitCode).toBe(1);
	});

	it("reports malformed runtime artifacts and missing checkpoint bead_id as warnings", async () => {
		const projectDir = createTempProject("ock-doctor-beads-runtime-artifacts-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: false,
		});
		installFakeBr(projectDir, "printf '[]\\n'");
		mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-checkpoints"), {
			recursive: true,
		});
		mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-attachments"), {
			recursive: true,
		});
		writeFileSync(
			join(
				projectDir,
				".beads",
				"artifacts",
				"runtime-checkpoints",
				"checkpoint-ses-root.schema-1.json",
			),
			JSON.stringify(
				{
					schemaVersion: 1,
					producer: { name: "omo", version: "0.20.1-test" },
					runtime: { name: "oh-my-openagent", version: "0.20.1-test" },
					writtenAt: "2026-04-10T00:05:00.000Z",
					session_id: "ses-root",
				},
				null,
				2,
			),
		);
		writeFileSync(
			join(
				projectDir,
				".beads",
				"artifacts",
				"runtime-attachments",
				"registry.schema-1.json",
			),
			JSON.stringify(
				{
					schemaVersion: 1,
					producer: { name: "omo", version: "0.20.1-test" },
					runtime: { name: "oh-my-openagent", version: "0.20.1-test" },
					writtenAt: "2026-04-10T00:05:00.000Z",
					attachments: {
						"/tmp/demo::2026-04-10T00:00:00.000Z": {
							beadID: "bd-123",
							continuationDirectory: join(projectDir, "missing-continuation"),
							activePlan: join(projectDir, ".sisyphus", "plans", "demo.md"),
							startedAt: "2026-04-10T00:00:00.000Z",
							sourceCommand: "start",
							worktreePath: projectDir,
							attachedAt: "2026-04-10T00:05:00.000Z",
						},
					},
				},
				null,
				2,
			),
		);

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("active checkpoint payload missing bead_id"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("stale attach/reconcile artifacts detected"),
		);
		expect(process.exitCode).toBe(2);
	});

	it("reports unsupported schema versions as beads-runtime errors", async () => {
		const projectDir = createTempProject("ock-doctor-beads-runtime-schema-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: false,
		});
		installFakeBr(projectDir, "printf '[]\\n'");
		mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-attachments"), {
			recursive: true,
		});
		writeFileSync(
			join(
				projectDir,
				".beads",
				"artifacts",
				"runtime-attachments",
				"registry.schema-1.json",
			),
			JSON.stringify(
				{
					schemaVersion: 2,
					producer: { name: "omo", version: "0.20.1-test" },
					runtime: { name: "oh-my-openagent", version: "0.20.1-test" },
					writtenAt: "2026-04-10T00:05:00.000Z",
					attachments: {},
				},
				null,
				2,
			),
		);

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"runtime attachment registry uses unsupported schema version 2",
			),
		);
		expect(process.exitCode).toBe(1);
	});

	it("reports runtime artifact namespace collisions as beads-runtime errors", async () => {
		const projectDir = createTempProject("ock-doctor-beads-runtime-collision-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: false,
		});
		installFakeBr(projectDir, "printf '[]\\n'");
		mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-attachments"), {
			recursive: true,
		});
		writeFileSync(
			join(projectDir, ".beads", "artifacts", "runtime-attachments.json"),
			JSON.stringify({}, null, 2),
		);
		writeFileSync(
			join(
				projectDir,
				".beads",
				"artifacts",
				"runtime-attachments",
				"registry.schema-1.json",
			),
			JSON.stringify(
				{
					schemaVersion: 1,
					producer: { name: "omo", version: "0.20.1-test" },
					runtime: { name: "oh-my-openagent", version: "0.20.1-test" },
					writtenAt: "2026-04-10T00:05:00.000Z",
					attachments: {},
				},
				null,
				2,
			),
		);

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"runtime attachment namespace collision detected",
			),
		);
		expect(process.exitCode).toBe(1);
	});

	it("reports legacy runtime artifacts as migration warnings instead of silent success", async () => {
		const projectDir = createTempProject("ock-doctor-beads-runtime-legacy-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: false,
		});
		installFakeBr(projectDir, "printf '[]\\n'");
		mkdirSync(join(projectDir, ".beads", "artifacts"), { recursive: true });
		writeFileSync(
			join(projectDir, ".beads", "artifacts", "checkpoint-ses-root.json"),
			JSON.stringify({ session_id: "ses-root", bead_id: "bd-legacy" }, null, 2),
		);
		writeFileSync(
			join(projectDir, ".beads", "artifacts", "runtime-attachments.json"),
			JSON.stringify({}, null, 2),
		);

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("legacy runtime checkpoint remains readable"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"legacy runtime attachment registry remains readable",
			),
		);
		expect(process.exitCode).toBe(2);
	});

	it("prefers schema-1 artifacts when legacy and canonical layouts coexist after migration", async () => {
		const projectDir = createTempProject("ock-doctor-beads-runtime-migrated-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: false,
		});
		installFakeBr(projectDir, "printf '[]\\n'");
		mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-checkpoints"), {
			recursive: true,
		});
		mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-attachments"), {
			recursive: true,
		});
		writeFileSync(
			join(projectDir, ".beads", "artifacts", "checkpoint-ses-root.json"),
			JSON.stringify({ session_id: "ses-root", bead_id: "bd-legacy" }, null, 2),
		);
		writeFileSync(
			join(projectDir, ".beads", "artifacts", "runtime-attachments.json"),
			JSON.stringify({ legacy: {} }, null, 2),
		);
		writeFileSync(
			join(
				projectDir,
				".beads",
				"artifacts",
				"runtime-checkpoints",
				"checkpoint-ses-root.schema-1.json",
			),
			JSON.stringify(
				{
					schemaVersion: 1,
					producer: { name: "omo", version: "0.20.1-test" },
					runtime: { name: "oh-my-openagent", version: "0.20.1-test" },
					writtenAt: "2026-04-10T00:05:00.000Z",
					session_id: "ses-root",
					bead_id: "bd-schema-1",
				},
				null,
				2,
			),
		);
		writeFileSync(
			join(
				projectDir,
				".beads",
				"artifacts",
				"runtime-attachments",
				"registry.schema-1.json",
			),
			JSON.stringify(
				{
					schemaVersion: 1,
					producer: { name: "omo", version: "0.20.1-test" },
					runtime: { name: "oh-my-openagent", version: "0.20.1-test" },
					writtenAt: "2026-04-10T00:05:00.000Z",
					attachments: {},
				},
				null,
				2,
			),
		);

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"runtime checkpoint namespace collision detected",
			),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"runtime attachment namespace collision detected",
			),
		);
		expect(process.exitCode).toBe(1);
	});

	it("reports dual basename warning and exit code 2 when canonical and legacy config files coexist", async () => {
		const projectDir = createTempProject("ock-doctor-bridge-warn-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		mkdirSync(join(opencodeDir, "skill", "demo"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);
		writeFileSync(join(opencodeDir, "oh-my-openagent.jsonc"), "{}\n");
		writeFileSync(join(opencodeDir, "oh-my-opencode.jsonc"), "{}\n");

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

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
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeFileSync(
			join(opencodeDir, "package.json"),
			JSON.stringify({ name: "fixture" }),
		);
		writeFileSync(
			join(opencodeDir, "opencode.json"),
			JSON.stringify({ mcp: {}, plugin: ["other-plugin"] }),
		);
		writeFileSync(
			join(opencodeDir, "skill", "demo", "SKILL.md"),
			"---\nname: demo\ndescription: demo\n---\n",
		);

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

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
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		mkdirSync(join(opencodeDir, "skill", "context-management"), {
			recursive: true,
		});
		writeFileSync(
			join(opencodeDir, "skill", "context-management", "SKILL.md"),
			'find_sessions({ query: "auth" })\n',
		);
		writeFileSync(join(opencodeDir, "oh-my-openagent.jsonc"), "{}\n");

		process.chdir(projectDir);
		process.argv = ["node", "ock"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await statusCommand();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("Bridge Health"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("WARN"));
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"BRIDGE WARNING: preserved project content still references legacy runtime surfaces",
			),
		);
		expect(process.exitCode ?? 0).toBe(0);
	});
});
