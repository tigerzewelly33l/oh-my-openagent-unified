import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assertBeadsRuntimeCommandContracts } from "./beads-runtime-command-assertions.js";
import { writeRuntimeArtifacts } from "./beads-runtime-test-artifacts.js";
import { installFakeRuntimeBinaries } from "./beads-runtime-test-binaries.js";

const TEMPLATE_ROOT = new URL("../..", import.meta.url);
const TEMPLATE_ROOT_PATH = fileURLToPath(TEMPLATE_ROOT);

const promptMocks = vi.hoisted(() => ({
	intro: vi.fn(),
	outro: vi.fn(),
	info: vi.fn(),
	logError: vi.fn(),
	logWarn: vi.fn(),
	spinnerStart: vi.fn(),
	spinnerStop: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
	intro: promptMocks.intro,
	outro: promptMocks.outro,
	confirm: vi.fn(),
	text: vi.fn(),
	select: vi.fn(),
	note: vi.fn(),
	isCancel: () => false,
	spinner: () => ({
		start: promptMocks.spinnerStart,
		stop: promptMocks.spinnerStop,
	}),
	log: {
		info: promptMocks.info,
		error: promptMocks.logError,
		warn: promptMocks.logWarn,
	},
}));

vi.mock("./init/paths.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./init/paths.js")>();
	return {
		...actual,
		getTemplateRoot: () => TEMPLATE_ROOT_PATH,
		getPackageVersion: () => "0.20.1-test",
	};
});

import { initCommand } from "./init.js";
import { createTempProject } from "./opencode-project-fixture.js";

const ORIGINAL_ARGV = [...process.argv];
const ORIGINAL_CWD = process.cwd();
const ORIGINAL_PATH = process.env.PATH;
const ORIGINAL_XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME;
const TEMP_DIRS: string[] = [];

afterEach(() => {
	process.argv = [...ORIGINAL_ARGV];
	process.chdir(ORIGINAL_CWD);
	process.exitCode = undefined;
	process.env.PATH = ORIGINAL_PATH;
	if (ORIGINAL_XDG_CONFIG_HOME === undefined) {
		delete process.env.XDG_CONFIG_HOME;
	} else {
		process.env.XDG_CONFIG_HOME = ORIGINAL_XDG_CONFIG_HOME;
	}
	promptMocks.intro.mockReset();
	promptMocks.outro.mockReset();
	promptMocks.info.mockReset();
	promptMocks.logError.mockReset();
	promptMocks.logWarn.mockReset();
	promptMocks.spinnerStart.mockReset();
	promptMocks.spinnerStop.mockReset();
	vi.restoreAllMocks();
	for (const tempDir of TEMP_DIRS.splice(0)) {
		rmSync(tempDir, { recursive: true, force: true });
	}
});

describe("beads runtime temp-project acceptance", () => {
	it("installs cross-platform fake runtime binaries and filters in-progress bead listings", () => {
		const projectDir = createTempProject("ock-beads-runtime-binaries-");
		TEMP_DIRS.push(projectDir);
		installFakeRuntimeBinaries(projectDir, ORIGINAL_PATH);

		expect(existsSync(join(projectDir, "bin", "npm"))).toBe(true);
		expect(existsSync(join(projectDir, "bin", "br"))).toBe(true);
		expect(existsSync(join(projectDir, "bin", "npm.cmd"))).toBe(true);
		expect(existsSync(join(projectDir, "bin", "br.cmd"))).toBe(true);

		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		writeFileSync(
			join(projectDir, ".beads", "ledger.json"),
			JSON.stringify(
				{
					next: 4,
					tasks: [
						{ id: "bd-1", title: "Open task", status: "open" },
						{ id: "bd-2", title: "In progress task", status: "in_progress" },
						{ id: "bd-3", title: "Completed task", status: "completed" },
					],
					deps: [],
					syncs: 0,
				},
				null,
				2,
			),
		);

		const listed = JSON.parse(
			execFileSync("br", ["list", "--status", "in_progress", "--json"], {
				cwd: projectDir,
				encoding: "utf-8",
			}),
		) as {
			issues: Array<{ id: string; title: string; status: string }>;
			total: number;
			limit: number;
			offset: number;
			has_more: boolean;
		};

		expect(listed).toEqual({
			issues: [
				{ id: "bd-2", title: "In progress task", status: "in_progress" },
			],
			total: 1,
			limit: 50,
			offset: 0,
			has_more: false,
		});
	});

	it("executes the integrated beads runtime contract in a temp project without crossing authored ownership boundaries", async () => {
		const projectDir = createTempProject("ock-beads-acceptance-");
		const xdgDir = createTempProject("ock-xdg-");
		TEMP_DIRS.push(projectDir, xdgDir);
		process.env.XDG_CONFIG_HOME = xdgDir;
		installFakeRuntimeBinaries(projectDir, ORIGINAL_PATH);
		process.chdir(projectDir);
		process.argv = ["node", "ock", "init", "--beads", "--yes"];

		await initCommand({ beads: true, yes: true });

		const bridgeConfig = readFileSync(
			join(projectDir, ".opencode", "oh-my-openagent.jsonc"),
			"utf-8",
		);
		const templateBridgeConfig = readFileSync(
			join(TEMPLATE_ROOT_PATH, ".opencode", "oh-my-openagent.jsonc"),
			"utf-8",
		);
		const opencodeConfig = JSON.parse(
			readFileSync(join(projectDir, ".opencode", "opencode.json"), "utf-8"),
		) as { plugin: string[] };
		expect(bridgeConfig).toBe(templateBridgeConfig);
		expect(bridgeConfig).toContain("Managed by ock bridge artifacts");
		expect(opencodeConfig.plugin).toContain("oh-my-openagent");

		const taskA = JSON.parse(
			execFileSync(
				"br",
				["create", "Task A", "--type", "task", "--priority", "1", "--json"],
				{
					cwd: projectDir,
					encoding: "utf-8",
				},
			),
		) as { id: string };
		const taskB = JSON.parse(
			execFileSync(
				"br",
				["create", "Task B", "--type", "task", "--priority", "1", "--json"],
				{
					cwd: projectDir,
					encoding: "utf-8",
				},
			),
		) as { id: string };
		execFileSync("br", ["dep", "add", taskB.id, taskA.id], { cwd: projectDir });
		const ready = JSON.parse(
			execFileSync("br", ["ready", "--json"], {
				cwd: projectDir,
				encoding: "utf-8",
			}),
		) as Array<{ id: string; title: string; status: string }>;
		expect(ready).toEqual([{ id: taskA.id, title: "Task A", status: "open" }]);

		expect(existsSync(join(projectDir, ".beads", "verify.log"))).toBe(false);
		expect(
			existsSync(
				join(projectDir, ".beads", "artifacts", "runtime-attachments.json"),
			),
		).toBe(false);
		expect(
			existsSync(
				join(projectDir, ".beads", "artifacts", "checkpoint-ses-root.json"),
			),
		).toBe(false);

		const { continuationDirectory, activePlan, reconciledAt, startedAt } =
			writeRuntimeArtifacts(projectDir, taskA.id);
		const checkpointPath = join(
			projectDir,
			".beads",
			"artifacts",
			"checkpoint-ses-root.json",
		);
		const attachmentPath = join(
			projectDir,
			".beads",
			"artifacts",
			"runtime-attachments.json",
		);
		const boulderPath = join(
			continuationDirectory,
			".sisyphus",
			"boulder.json",
		);

		expect(existsSync(checkpointPath)).toBe(true);
		expect(existsSync(attachmentPath)).toBe(true);
		expect(existsSync(boulderPath)).toBe(true);

		const checkpoint = JSON.parse(readFileSync(checkpointPath, "utf-8")) as {
			active_plan: string;
			bead_id: string;
			started_at: string;
		};
		const attachments = JSON.parse(
			readFileSync(attachmentPath, "utf-8"),
		) as Record<
			string,
			{
				activePlan: string;
				attachedAt: string;
				beadID: string;
				continuationDirectory: string;
				startedAt: string;
				worktreePath: string;
			}
		>;
		const boulder = JSON.parse(readFileSync(boulderPath, "utf-8")) as {
			active_plan: string;
			bead_id: string;
			bead_last_reconciled_at?: string;
			started_at: string;
		};

		expect(checkpoint).toMatchObject({
			active_plan: activePlan,
			bead_id: taskA.id,
			session_id: "ses-root",
			started_at: startedAt,
		});
		expect(attachments[`${taskA.id}::${startedAt}`]).toMatchObject({
			activePlan,
			attachedAt: reconciledAt,
			beadID: taskA.id,
			continuationDirectory,
			sourceCommand: "start",
			startedAt,
			worktreePath: projectDir,
		});
		expect(boulder).toMatchObject({
			active_plan: activePlan,
			bead_id: taskA.id,
			bead_last_reconciled_at: reconciledAt,
			started_at: startedAt,
		});

		writeFileSync(
			join(continuationDirectory, ".sisyphus", "boulder.json"),
			JSON.stringify(
				{
					active_plan: activePlan,
					started_at: startedAt,
					bead_id: taskA.id,
				},
				null,
				2,
			),
		);

		const staleBoulder = JSON.parse(readFileSync(boulderPath, "utf-8")) as {
			active_plan: string;
			bead_id: string;
			bead_last_reconciled_at?: string;
			started_at: string;
		};
		expect(staleBoulder).toEqual({
			active_plan: activePlan,
			bead_id: taskA.id,
			started_at: startedAt,
		});

		const ledger = JSON.parse(
			readFileSync(join(projectDir, ".beads", "ledger.json"), "utf-8"),
		) as {
			tasks: Array<{ status: string }>;
			syncs: number;
		};
		expect(ledger.tasks.every((task) => task.status === "open")).toBe(true);
		expect(ledger.syncs).toBe(0);

		assertBeadsRuntimeCommandContracts(projectDir);
	});
});
