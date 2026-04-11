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
	mkdirSync(join(continuationDirectory, ".sisyphus"), { recursive: true });

	writeFileSync(
		join(projectDir, ".beads", "artifacts", "checkpoint-ses-root.json"),
		JSON.stringify(
			{
				session_id: "ses-root",
				bead_id: beadId,
				active_plan: activePlan,
				started_at: startedAt,
			},
			null,
			2,
		),
	);
	writeFileSync(
		join(projectDir, ".beads", "artifacts", "runtime-attachments.json"),
		JSON.stringify(
			{
				[`${beadId}::${startedAt}`]: {
					beadID: beadId,
					continuationDirectory,
					activePlan,
					startedAt,
					sourceCommand: "start",
					worktreePath: projectDir,
					attachedAt: reconciledAt,
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
