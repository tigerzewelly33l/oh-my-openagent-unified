import { execFileSync, spawnSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";
import { writeRuntimeArtifacts } from "./beads-runtime-test-artifacts.js";
import { installFakeRuntimeBinaries } from "./beads-runtime-test-binaries.js";
import {
	createOpencodeProject,
	createTempProject,
} from "./opencode-project-fixture.js";
import { publishPlanSnapshot } from "./plan-publish.js";
import { repairRuntimeState } from "./runtime-state-repair.js";
import { TSX_LOADER_PATH } from "./test-cli-paths.js";

const ORIGINAL_CWD = process.cwd();
const ORIGINAL_PATH = process.env.PATH;

afterEach(() => {
	process.chdir(ORIGINAL_CWD);
	process.env.PATH = ORIGINAL_PATH;
	process.exitCode = undefined;
});

function createBead(projectDir: string, title = "Repair Task") {
	const output = execFileSync(
		"br",
		["create", title, "--type", "task", "--priority", "1", "--json"],
		{ cwd: projectDir, encoding: "utf-8" },
	);
	return (JSON.parse(output) as { id: string }).id;
}

function setupRepairProject(prefix: string) {
	const projectDir = createTempProject(prefix);
	createOpencodeProject(projectDir);
	installFakeRuntimeBinaries(projectDir, ORIGINAL_PATH);
	mkdirSync(join(projectDir, ".beads"), { recursive: true });
	writeFileSync(join(projectDir, ".beads", "config.yaml"), "version: 1\n");
	process.chdir(projectDir);
	return projectDir;
}

describe("runtime-state repair", () => {
	it("rebuilds .sisyphus runtime state from durable truth and restores the latest published plan", () => {
		const projectDir = setupRepairProject("ock-runtime-repair-success-");
		const beadId = createBead(projectDir);
		mkdirSync(join(projectDir, ".sisyphus", "plans"), { recursive: true });
		writeFileSync(
			join(projectDir, ".sisyphus", "plans", "repair.md"),
			"# Repair Plan\n\n- durable step\n",
		);
		writeRuntimeArtifacts(projectDir, beadId);
		publishPlanSnapshot({
			projectDir,
			beadId,
			sourcePlanPath: ".sisyphus/plans/repair.md",
			planContent: "# Repair Plan\n\n- durable step\n",
			now: new Date("2026-04-12T10:00:00.000Z"),
		});
		rmSync(join(projectDir, ".sisyphus"), { recursive: true, force: true });

		const result = repairRuntimeState({ projectDir, beadId });

		expect(result.level).toBe("OK");
		expect(result.diagnostics).toEqual([]);
		expect(existsSync(join(projectDir, ".sisyphus", "boulder.json"))).toBe(
			true,
		);
		expect(
			existsSync(join(projectDir, ".sisyphus", "plans", "repair.md")),
		).toBe(true);
		const boulder = JSON.parse(
			readFileSync(join(projectDir, ".sisyphus", "boulder.json"), "utf-8"),
		) as {
			bead_id: string;
			active_plan: string;
			bead_runtime_state: { last_rebuild_source: string };
		};
		expect(boulder.bead_id).toBe(beadId);
		expect(boulder.active_plan).toBe(
			join(projectDir, ".sisyphus", "plans", "repair.md"),
		);
		expect(boulder.bead_runtime_state.last_rebuild_source).toBe(
			"doctor --repair runtime-state",
		);
		expect(
			readFileSync(
				join(projectDir, ".sisyphus", "plans", "repair.md"),
				"utf-8",
			),
		).toBe("# Repair Plan\n\n- durable step\n");
	});

	it("fails deterministically from the workspace root wrong scope", () => {
		const result = repairRuntimeState({ projectDir: "/work/ock-omo-system" });

		expect(result.level).toBe("ERROR");
		expect(result.diagnostics[0]?.code).toBe("UNIFICATION_WRONG_SCOPE");
	});

	it("degrades to a warning when no durable plan snapshot exists", () => {
		const projectDir = setupRepairProject("ock-runtime-repair-missing-plan-");
		const beadId = createBead(projectDir);
		writeRuntimeArtifacts(projectDir, beadId);
		rmSync(join(projectDir, ".sisyphus"), { recursive: true, force: true });

		const result = repairRuntimeState({ projectDir, beadId });

		expect(result.level).toBe("WARN");
		expect(result.diagnostics).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "UNIFICATION_MISSING_DURABLE_PLAN",
					level: "WARN",
					repairable: true,
				}),
			]),
		);
		expect(existsSync(join(projectDir, ".sisyphus", "boulder.json"))).toBe(
			true,
		);
		expect(existsSync(join(projectDir, ".sisyphus", "plans"))).toBe(false);
	});

	it("does not mutate durable .beads state during repair", () => {
		const projectDir = setupRepairProject("ock-runtime-repair-no-mutation-");
		const beadId = createBead(projectDir);
		mkdirSync(join(projectDir, ".sisyphus", "plans"), { recursive: true });
		writeFileSync(
			join(projectDir, ".sisyphus", "plans", "repair.md"),
			"# Repair Plan\n\n- durable step\n",
		);
		writeRuntimeArtifacts(projectDir, beadId);
		publishPlanSnapshot({
			projectDir,
			beadId,
			sourcePlanPath: ".sisyphus/plans/repair.md",
			planContent: "# Repair Plan\n\n- durable step\n",
			now: new Date("2026-04-12T10:00:00.000Z"),
		});
		const issuesPath = join(projectDir, ".beads", "issues.jsonl");
		if (!existsSync(issuesPath)) {
			writeFileSync(issuesPath, "\n");
		}
		const before = {
			ledger: readFileSync(join(projectDir, ".beads", "ledger.json"), "utf-8"),
			issues: readFileSync(issuesPath, "utf-8"),
			manifest: readFileSync(
				join(
					projectDir,
					".beads",
					"artifacts",
					"plan-snapshots",
					beadId,
					"manifest.schema-1.json",
				),
				"utf-8",
			),
			registryMtime: statSync(
				join(
					projectDir,
					".beads",
					"artifacts",
					"runtime-attachments",
					"registry.schema-1.json",
				),
			).mtimeMs,
		};
		rmSync(join(projectDir, ".sisyphus"), { recursive: true, force: true });

		repairRuntimeState({ projectDir, beadId });

		expect(
			readFileSync(join(projectDir, ".beads", "ledger.json"), "utf-8"),
		).toBe(before.ledger);
		expect(readFileSync(issuesPath, "utf-8")).toBe(before.issues);
		expect(
			readFileSync(
				join(
					projectDir,
					".beads",
					"artifacts",
					"plan-snapshots",
					beadId,
					"manifest.schema-1.json",
				),
				"utf-8",
			),
		).toBe(before.manifest);
		expect(
			statSync(
				join(
					projectDir,
					".beads",
					"artifacts",
					"runtime-attachments",
					"registry.schema-1.json",
				),
			).mtimeMs,
		).toBe(before.registryMtime);
	});

	it("built CLI repair emits warning-level JSON and restores runtime state", () => {
		const projectDir = setupRepairProject("ock-runtime-repair-cli-");
		const beadId = createBead(projectDir);
		writeRuntimeArtifacts(projectDir, beadId);
		rmSync(join(projectDir, ".sisyphus"), { recursive: true, force: true });

		const result = spawnSync(
			"node",
			[
				"--import",
				TSX_LOADER_PATH,
				"/work/ock-omo-system/opencodekit-template/src/index.ts",
				"doctor",
				"--repair",
				"runtime-state",
				"--json",
				"--bead",
				beadId,
			],
			{ cwd: projectDir, encoding: "utf-8", env: process.env },
		);

		expect(result.status).toBe(2);
		const payload = JSON.parse(result.stdout) as {
			level: string;
			checks: Array<{ code: string }>;
			repair: { beadId: string | null };
		};
		expect(payload.level).toBe("WARN");
		expect(payload.repair.beadId).toBe(beadId);
		expect(payload.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ code: "UNIFICATION_MISSING_DURABLE_PLAN" }),
			]),
		);
		expect(existsSync(join(projectDir, ".sisyphus", "boulder.json"))).toBe(
			true,
		);
	});

	it("built CLI repair returns structured ambiguity diagnostics instead of crashing when multiple durable plans exist without --bead", () => {
		const projectDir = setupRepairProject("ock-runtime-repair-ambiguous-");
		const beadId = createBead(projectDir, "Primary Repair Task");
		const otherBeadId = createBead(projectDir, "Secondary Repair Task");
		writeRuntimeArtifacts(projectDir, beadId);
		mkdirSync(join(projectDir, ".sisyphus", "plans"), { recursive: true });
		writeFileSync(
			join(projectDir, ".sisyphus", "plans", "repair.md"),
			"# Repair Plan\n\n- durable step\n",
		);
		writeFileSync(
			join(projectDir, ".sisyphus", "plans", "other.md"),
			"# Other Plan\n\n- second durable step\n",
		);
		publishPlanSnapshot({
			projectDir,
			beadId,
			sourcePlanPath: ".sisyphus/plans/repair.md",
			planContent: "# Repair Plan\n\n- durable step\n",
			now: new Date("2026-04-12T10:00:00.000Z"),
		});
		publishPlanSnapshot({
			projectDir,
			beadId: otherBeadId,
			sourcePlanPath: ".sisyphus/plans/other.md",
			planContent: "# Other Plan\n\n- second durable step\n",
			now: new Date("2026-04-12T10:05:00.000Z"),
		});
		rmSync(join(projectDir, ".sisyphus"), { recursive: true, force: true });

		const result = spawnSync(
			"node",
			[
				"--import",
				TSX_LOADER_PATH,
				"/work/ock-omo-system/opencodekit-template/src/index.ts",
				"doctor",
				"--repair",
				"runtime-state",
				"--json",
			],
			{ cwd: projectDir, encoding: "utf-8", env: process.env },
		);

		expect(result.status).toBe(1);
		expect(result.stderr).not.toContain("UnhandledPromiseRejection");
		const payload = JSON.parse(result.stdout) as {
			level: string;
			checks: Array<{ code: string; repairable: boolean }>;
			repair: { beadId: string | null };
		};
		expect(payload.level).toBe("ERROR");
		expect(payload.repair.beadId).toBeNull();
		expect(payload.checks).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					code: "UNIFICATION_AMBIGUOUS_DURABLE_PLAN",
					repairable: true,
				}),
			]),
		);
	});
});
