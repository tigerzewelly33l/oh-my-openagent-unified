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

import { DIAGNOSTIC_CODES } from "./diagnostic-codes.js";
import { doctorCommand } from "./doctor.js";
import {
	createOpencodeProject,
	createTempProject,
} from "./opencode-project-fixture.js";
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

function getLastJsonCall(consoleSpy: ReturnType<typeof vi.spyOn>) {
	const values = consoleSpy.mock.calls
		.map((call: unknown[]) => call[0])
		.filter((value: unknown): value is string => typeof value === "string");
	const last = values.at(-1);
	if (!last) {
		throw new Error("No JSON output captured");
	}

	return JSON.parse(last) as {
		surface: string;
		mode: string;
		level: string;
		summary: { ok: number; warnings: number; errors: number };
		checks: Array<{
			name: string;
			code: string;
			level: string;
			owner: string;
			canonicalStore: string;
			repairable: boolean;
			message: string;
			details: string[];
		}>;
		repair?: {
			target: string;
			beadId: string | null;
			boulderPath: string | null;
			restoredPlanPath: string | null;
		};
	};
}

describe("status/doctor --json", () => {
	it("emits stable shared checks for status --json", async () => {
		const projectDir = createTempProject("ock-status-json-");
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
		process.argv = ["node", "ock", "status", "--json"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await statusCommand({ json: true });

		const payload = getLastJsonCall(consoleSpy);
		expect(payload.surface).toBe("status");
		expect(payload.mode).toBe("health");
		expect(payload.level).toBe("OK");
		expect(payload.summary.errors).toBe(0);
		expect(payload.checks.length).toBeGreaterThan(0);
		expect(
			payload.checks.every((check) => typeof check.code === "string"),
		).toBe(true);
		expect(payload.checks.every((check) => Array.isArray(check.details))).toBe(
			true,
		);
		expect(payload.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DIAGNOSTIC_CODES.OK,
					level: "OK",
					owner: expect.any(String),
					canonicalStore: expect.any(String),
					repairable: false,
					message: expect.any(String),
					details: expect.any(Array),
				}),
			]),
		);
	});

	it("emits stable shared checks for doctor --json while preserving warning exit codes", async () => {
		const projectDir = createTempProject("ock-doctor-json-");
		const opencodeDir = createOpencodeProject(projectDir);
		mkdirSync(join(opencodeDir, "agent"), { recursive: true });
		writeFileSync(
			join(opencodeDir, "agent", "build.md"),
			"---\nmode: primary\n---\n# Build\n",
		);
		writeManagedRuntimeConfig(opencodeDir, {
			beads_runtime: true,
			task_system: true,
		});
		installFakeBr(projectDir, "printf '[]\\n'");

		process.chdir(projectDir);
		process.argv = ["node", "ock", "doctor", "--json"];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand({ json: true });

		const payload = getLastJsonCall(consoleSpy);
		expect(payload.surface).toBe("doctor");
		expect(payload.mode).toBe("health");
		expect(payload.level).toBe("ERROR");
		expect(payload.summary.errors).toBeGreaterThan(0);
		expect(payload.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DIAGNOSTIC_CODES.SPLIT_BRAIN,
					level: "ERROR",
					owner: "ock",
					canonicalStore: ".sisyphus",
					repairable: true,
					message: expect.stringContaining("experimental.task_system collides"),
					details: expect.any(Array),
				}),
			]),
		);
		expect(process.exitCode).toBe(1);
	});

	it("folds doctor repair --json into the same checks shape and includes runtime repaired code", async () => {
		const projectDir = createTempProject("ock-doctor-repair-json-contract-");
		createOpencodeProject(projectDir);
		installFakeBr(
			projectDir,
			[
				'if [ "$1" = "create" ]; then printf \'%s\' \'{"id":"bd-1"}\'; exit 0; fi',
				'if [ "$1" = "show" ]; then printf \'%s\' \'[{"id":"\'"$2"\'","status":"open"}]\'; exit 0; fi',
				'if [ "$1" = "list" ]; then printf \'%s\' \'{"issues":[{"id":"bd-1","status":"open"}]}\'; exit 0; fi',
				'if [ "$1" = "ready" ]; then printf \'%s\' \'[{"id":"bd-1","status":"open"}]\'; exit 0; fi',
				'printf "unsupported" >&2',
				"exit 1",
			].join("\n"),
		);
		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-checkpoints"), {
			recursive: true,
		});
		mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-attachments"), {
			recursive: true,
		});
		writeFileSync(join(projectDir, ".beads", "config.yaml"), "version: 1\n");
		writeFileSync(
			join(
				projectDir,
				".beads",
				"artifacts",
				"runtime-checkpoints",
				"checkpoint-ses-1.schema-1.json",
			),
			JSON.stringify(
				{
					schemaVersion: 1,
					producer: { name: "omo", version: "0.20.1-test" },
					runtime: { name: "oh-my-openagent", version: "0.20.1-test" },
					writtenAt: "2026-04-12T10:00:00.000Z",
					session_id: "ses-1",
					session_ids: ["ses-1"],
					bead_id: "bd-1",
					task_sessions: [],
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
					writtenAt: "2026-04-12T10:00:00.000Z",
					attachments: {
						"/tmp/demo::2026-04-12T10:00:00.000Z": {
							beadID: "bd-1",
							continuationDirectory: projectDir,
							activePlan: join(projectDir, ".sisyphus", "plans", "repair.md"),
							startedAt: "2026-04-12T10:00:00.000Z",
							sourceCommand: "start",
							worktreePath: projectDir,
							attachedAt: "2026-04-12T10:00:00.000Z",
						},
					},
				},
				null,
				2,
			),
		);

		process.chdir(projectDir);
		process.argv = [
			"node",
			"ock",
			"doctor",
			"--repair",
			"runtime-state",
			"--json",
			"--bead",
			"bd-1",
		];

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);

		await doctorCommand({ repair: "runtime-state", json: true, bead: "bd-1" });

		const payload = getLastJsonCall(consoleSpy);
		expect(payload.surface).toBe("doctor");
		expect(payload.mode).toBe("repair");
		expect(payload.level).toBe("WARN");
		expect(payload.repair?.target).toBe("runtime-state");
		expect(payload.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: DIAGNOSTIC_CODES.RUNTIME_REPAIRED,
					owner: "ock",
					canonicalStore: ".sisyphus",
					repairable: false,
					message: expect.stringContaining("rebuilt the working runtime state"),
				}),
				// no durable plan snapshot present, but repair still succeeds with warning
				expect.objectContaining({
					code: DIAGNOSTIC_CODES.MISSING_DURABLE_PLAN,
					level: "WARN",
					owner: "ock",
					canonicalStore: ".beads",
					repairable: true,
				}),
			]),
		);
		expect(process.exitCode).toBe(2);
	});
});
