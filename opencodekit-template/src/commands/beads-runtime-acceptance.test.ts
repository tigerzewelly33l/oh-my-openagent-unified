import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { assertBeadsRuntimeCommandContracts } from "./beads-runtime-command-assertions.js";
import { writeRuntimeArtifacts } from "./beads-runtime-test-artifacts.js";
import { installFakeRuntimeBinaries } from "./beads-runtime-test-binaries.js";

const TEMPLATE_ROOT = new URL("../..", import.meta.url);

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
		getTemplateRoot: () => TEMPLATE_ROOT.pathname,
		getPackageVersion: () => "0.20.1-test",
	};
});

import { doctorCommand } from "./doctor.js";
import { initCommand } from "./init.js";
import { createTempProject } from "./opencode-project-fixture.js";

const ORIGINAL_ARGV = [...process.argv];
const ORIGINAL_CWD = process.cwd();
const ORIGINAL_PATH = process.env.PATH;
const ORIGINAL_XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME;

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
});

describe("beads runtime temp-project acceptance", () => {
	it("executes the integrated beads runtime contract in a temp project without crossing authored ownership boundaries", async () => {
		const projectDir = createTempProject("ock-beads-acceptance-");
		const xdgDir = createTempProject("ock-xdg-");
		process.env.XDG_CONFIG_HOME = xdgDir;
		installFakeRuntimeBinaries(projectDir, ORIGINAL_PATH);
		process.chdir(projectDir);
		process.argv = ["node", "ock", "init", "--beads", "--yes"];

		await initCommand({ beads: true, yes: true });

		const bridgeConfig = JSON.parse(
			readFileSync(
				join(projectDir, ".opencode", "oh-my-openagent.jsonc"),
				"utf-8",
			),
		) as { experimental: { beads_runtime: boolean; task_system: boolean } };
		const opencodeConfig = JSON.parse(
			readFileSync(join(projectDir, ".opencode", "opencode.json"), "utf-8"),
		) as { plugin: string[] };
		expect(bridgeConfig.experimental).toEqual({
			beads_runtime: true,
			task_system: false,
		});
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

		const consoleSpy = vi
			.spyOn(console, "log")
			.mockImplementation(() => undefined);
		await doctorCommand();
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("br ready --json succeeded in the current repo"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("no runtime checkpoint artifacts detected"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(
				"runtime attachment registry is consistent (0 attachments)",
			),
		);
		expect(process.exitCode).not.toBe(1);
		expect(existsSync(join(projectDir, ".beads", "verify.log"))).toBe(false);
		expect(
			existsSync(
				join(
					projectDir,
					".beads",
					"artifacts",
					"manifests",
					"index.schema-1.json",
				),
			),
		).toBe(true);
		expect(
			JSON.parse(
				readFileSync(
					join(
						projectDir,
						".beads",
						"artifacts",
						"runtime-attachments",
						"registry.schema-1.json",
					),
					"utf-8",
				),
			),
		).toMatchObject({
			schemaVersion: 1,
			attachments: {},
		});
		expect(
			existsSync(
				join(
					projectDir,
					".beads",
					"artifacts",
					"runtime-checkpoints",
					"checkpoint-ses-root.schema-1.json",
				),
			),
		).toBe(false);

		const { continuationDirectory, activePlan, startedAt } =
			writeRuntimeArtifacts(projectDir, taskA.id);

		consoleSpy.mockClear();
		process.exitCode = undefined;
		await doctorCommand();
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining(`active checkpoint includes bead_id ${taskA.id}`),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("runtime attachment registry is consistent"),
		);
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("br ready --json succeeded in the current repo"),
		);

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

		consoleSpy.mockClear();
		process.exitCode = undefined;
		await doctorCommand();
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("stale attach/reconcile artifacts detected"),
		);
		expect(process.exitCode).toBe(2);

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
