import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface RuntimeArtifactFixture {
	activePlan: string;
	continuationDirectory: string;
	reconciledAt: string;
	startedAt: string;
}

export function writeRuntimeArtifacts(
	projectDir: string,
	beadId: string,
): RuntimeArtifactFixture {
	const continuationDirectory = join(
		projectDir,
		".omo",
		"continuations",
		"ses-root",
	);
	const activePlan = join(
		projectDir,
		".sisyphus",
		"plans",
		"ock-omo-beads-runtime-integration.md",
	);
	const startedAt = "2026-04-11T00:00:00.000Z";
	const reconciledAt = "2026-04-11T00:05:00.000Z";

	mkdirSync(join(projectDir, ".beads", "artifacts"), { recursive: true });
	mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-checkpoints"), {
		recursive: true,
	});
	mkdirSync(join(projectDir, ".beads", "artifacts", "runtime-attachments"), {
		recursive: true,
	});
	mkdirSync(join(continuationDirectory, ".sisyphus"), { recursive: true });

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
				writtenAt: reconciledAt,
				session_id: "ses-root",
				cleared_at: reconciledAt,
				bead_id: beadId,
				active_plan: activePlan,
				started_at: startedAt,
				plan_name: "ock-omo-beads-runtime-integration",
				session_ids: ["ses-root"],
				task_sessions: {},
				worktree_path: projectDir,
				bead_source_command: "start",
				bead_worktree_path: projectDir,
				bead_last_reconciled_at: reconciledAt,
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
				writtenAt: reconciledAt,
				attachments: {
					[`${beadId}::${startedAt}`]: {
						beadID: beadId,
						continuationDirectory,
						activePlan,
						startedAt,
						sourceCommand: "start",
						worktreePath: projectDir,
						attachedAt: reconciledAt,
						runtimeVersion: "0.20.1-test",
					},
				},
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(continuationDirectory, ".sisyphus", "boulder.json"),
		JSON.stringify(
			{
				active_plan: activePlan,
				started_at: startedAt,
				bead_id: beadId,
				bead_last_reconciled_at: reconciledAt,
			},
			null,
			2,
		),
	);

	return {
		activePlan,
		continuationDirectory,
		reconciledAt,
		startedAt,
	};
}
