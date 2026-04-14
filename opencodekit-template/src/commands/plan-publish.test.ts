import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCli } from "../index.js";
import {
	getArtifactsIndexPath,
	getPlanSnapshotManifestPath,
	isPlanSnapshotIndex,
	isPlanSnapshotManifest,
} from "./beads-runtime-artifact-files.js";
import { installFakeRuntimeBinaries } from "./beads-runtime-test-binaries.js";
import {
	createOpencodeProject,
	createTempProject,
} from "./opencode-project-fixture.js";
import { planPublishCommand, publishPlanSnapshot } from "./plan-publish.js";
import { SOURCE_CLI_ENTRY_PATH, TSX_LOADER_PATH } from "./test-cli-paths.js";

const promptMocks = vi.hoisted(() => ({
	outro: vi.fn(),
}));

vi.mock("@clack/prompts", () => ({
	outro: promptMocks.outro,
}));

const ORIGINAL_ARGV = [...process.argv];
const ORIGINAL_CWD = process.cwd();
const ORIGINAL_PATH = process.env.PATH;
beforeEach(() => {
	promptMocks.outro.mockReset();
});

afterEach(() => {
	process.argv = [...ORIGINAL_ARGV];
	process.chdir(ORIGINAL_CWD);
	process.env.PATH = ORIGINAL_PATH;
	vi.restoreAllMocks();
});

function createBead(projectDir: string, title = "Plan Publish Task"): string {
	const output = execFileSync(
		"br",
		["create", title, "--type", "task", "--priority", "1", "--json"],
		{
			cwd: projectDir,
			encoding: "utf-8",
		},
	);
	return (JSON.parse(output) as { id: string }).id;
}

function setupPlanFixture(prefix: string) {
	const projectDir = createTempProject(prefix);
	createOpencodeProject(projectDir);
	installFakeRuntimeBinaries(projectDir, ORIGINAL_PATH);
	process.chdir(projectDir);
	process.argv = ["node", "ock", "plan", "publish"];

	mkdirSync(join(projectDir, ".sisyphus", "plans"), { recursive: true });
	mkdirSync(join(projectDir, ".beads"), { recursive: true });
	writeFileSync(join(projectDir, ".beads", "config.yaml"), "version: 1\n");

	return projectDir;
}

async function parseCliArgs(argv: string[]) {
	const cli = buildCli();
	process.argv = argv;
	await cli.parse(argv, { run: false });
	return cli.runMatchedCommand();
}

describe("plan publish durable snapshot flow", () => {
	it("accepts --bead and --plan through the real CLI parser and publishes a durable snapshot", async () => {
		const projectDir = setupPlanFixture("ock-plan-publish-success-");
		const beadId = createBead(projectDir);
		writeFileSync(
			join(projectDir, ".sisyphus", "plans", "example.md"),
			"# Example Plan\n\n- first step\n",
			"utf-8",
		);

		await parseCliArgs([
			"node",
			"ock",
			"plan",
			"publish",
			"--bead",
			beadId,
			"--plan",
			".sisyphus/plans/example.md",
		]);

		const manifestPath = join(projectDir, getPlanSnapshotManifestPath(beadId));
		const indexPath = join(projectDir, getArtifactsIndexPath());
		const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
		const index = JSON.parse(readFileSync(indexPath, "utf-8"));

		expect(isPlanSnapshotManifest(manifest)).toBe(true);
		expect(isPlanSnapshotIndex(index)).toBe(true);
		expect(manifest.beadId).toBe(beadId);
		expect(manifest.sourcePlanPath).toBe(".sisyphus/plans/example.md");
		expect(manifest.producer.name).toBe("ock");
		expect(manifest.schemaVersion).toBe(1);
		expect(typeof manifest.contentHash).toBe("string");
		expect(manifest.latestSnapshot).toMatch(
			new RegExp(
				`^\\.beads/artifacts/plan-snapshots/${beadId}/snapshots/.+\\.md$`,
			),
		);
		expect(index.plans[beadId]).toMatchObject({
			beadId,
			manifestPath: `.beads/artifacts/plan-snapshots/${beadId}/manifest.schema-1.json`,
			sourcePlanPath: ".sisyphus/plans/example.md",
			contentHash: manifest.contentHash,
			latestSnapshot: manifest.latestSnapshot,
		});
		expect(
			readFileSync(join(projectDir, manifest.latestSnapshot), "utf-8"),
		).toBe("# Example Plan\n\n- first step\n");
		expect(promptMocks.outro).toHaveBeenCalledWith(
			expect.stringContaining(`Published plan snapshot for ${beadId}`),
		);
	});

	it("CLI process accepts --bead and --plan instead of rejecting them during parse", () => {
		const projectDir = setupPlanFixture("ock-plan-publish-built-cli-");
		const beadId = createBead(projectDir);
		writeFileSync(
			join(projectDir, ".sisyphus", "plans", "example.md"),
			"# Example Plan\n\n- first step\n",
			"utf-8",
		);

		const result = spawnSync(
			"node",
			[
				"--import",
				TSX_LOADER_PATH,
				SOURCE_CLI_ENTRY_PATH,
				"plan",
				"publish",
				"--bead",
				beadId,
				"--plan",
				".sisyphus/plans/example.md",
			],
			{
				cwd: projectDir,
				encoding: "utf-8",
				env: process.env,
			},
		);

		expect(result.status).toBe(0);
		expect(result.stderr).not.toContain("Unknown option `--bead`");
		expect(result.stdout).toContain(`Published plan snapshot for ${beadId}`);
	});

	it("CLI process fails cleanly for invalid plan actions without a raw stack trace", () => {
		const projectDir = setupPlanFixture("ock-plan-invalid-action-");

		const result = spawnSync(
			"node",
			["--import", TSX_LOADER_PATH, SOURCE_CLI_ENTRY_PATH, "plan", "nonsense"],
			{
				cwd: projectDir,
				encoding: "utf-8",
				env: process.env,
			},
		);

		expect(result.status).toBe(1);
		expect(result.stderr).not.toContain("file://");
		expect(result.stderr).not.toContain("at CAC");
		expect(result.stderr).not.toContain("Error:");
		expect(result.stdout).toContain("Unknown plan action: nonsense");
		expect(result.stdout).toContain(
			"Use: ock plan publish --bead <id> --plan <path>",
		);
	});

	it("fails cleanly when the bead is not visible through supported br lookups", async () => {
		const projectDir = setupPlanFixture("ock-plan-publish-missing-bead-");
		writeFileSync(
			join(projectDir, ".sisyphus", "plans", "example.md"),
			"# Example Plan\n",
			"utf-8",
		);

		await expect(
			planPublishCommand({
				bead: "bd-missing",
				plan: ".sisyphus/plans/example.md",
			}),
		).rejects.toThrow(
			"Bead not visible through supported br lookups: bd-missing",
		);
	});

	it("rejects plan paths outside .sisyphus/plans/*.md", async () => {
		const projectDir = setupPlanFixture("ock-plan-publish-invalid-plan-");
		const beadId = createBead(projectDir);
		writeFileSync(join(projectDir, "notes.md"), "# Wrong Place\n", "utf-8");

		await expect(
			planPublishCommand({ bead: beadId, plan: "notes.md" }),
		).rejects.toThrow(
			"Plan path must point to a .sisyphus/plans/*.md file inside the current project.",
		);
	});

	it("returns a deterministic already current result for unchanged repeated publish", () => {
		const projectDir = createTempProject("ock-plan-publish-repeat-");
		const beadId = "bd-repeat";
		const sourcePlanPath = ".sisyphus/plans/example.md";
		const planContent = "# Example Plan\n\n- first step\n";

		const first = publishPlanSnapshot({
			projectDir,
			beadId,
			sourcePlanPath,
			planContent,
			now: new Date("2026-04-12T07:00:00.000Z"),
		});
		const firstSnapshotContent = readFileSync(
			join(projectDir, first.snapshotPath),
			"utf-8",
		);

		const second = publishPlanSnapshot({
			projectDir,
			beadId,
			sourcePlanPath,
			planContent,
			now: new Date("2026-04-12T08:00:00.000Z"),
		});

		expect(first.written).toBe(true);
		expect(second.written).toBe(false);
		expect(second.alreadyCurrent).toBe(true);
		expect(second.snapshotPath).toBe(first.snapshotPath);
		expect(readFileSync(join(projectDir, first.snapshotPath), "utf-8")).toBe(
			firstSnapshotContent,
		);
	});

	it("preserves historical snapshot contents when a later publish changes the plan", () => {
		const projectDir = createTempProject("ock-plan-publish-history-");
		const beadId = "bd-history";
		const sourcePlanPath = ".sisyphus/plans/example.md";

		const first = publishPlanSnapshot({
			projectDir,
			beadId,
			sourcePlanPath,
			planContent: "# Example Plan\n\n- first step\n",
			now: new Date("2026-04-12T07:00:00.000Z"),
		});
		const second = publishPlanSnapshot({
			projectDir,
			beadId,
			sourcePlanPath,
			planContent: "# Example Plan\n\n- first step\n- second step\n",
			now: new Date("2026-04-12T09:00:00.000Z"),
		});

		expect(second.written).toBe(true);
		expect(second.snapshotPath).not.toBe(first.snapshotPath);
		expect(readFileSync(join(projectDir, first.snapshotPath), "utf-8")).toBe(
			"# Example Plan\n\n- first step\n",
		);
		expect(readFileSync(join(projectDir, second.snapshotPath), "utf-8")).toBe(
			"# Example Plan\n\n- first step\n- second step\n",
		);
	});
});
