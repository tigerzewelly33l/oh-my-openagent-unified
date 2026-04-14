import { join } from "node:path";

export const BEADS_ARTIFACTS_DIR = join(".beads", "artifacts");
export const BEADS_ARTIFACTS_SCHEMA_VERSION = 1;
export const BEADS_ARTIFACTS_SCHEMA_LABEL = `schema-${BEADS_ARTIFACTS_SCHEMA_VERSION}`;
export const MANIFESTS_DIR = join(BEADS_ARTIFACTS_DIR, "manifests");
export const PLAN_SNAPSHOTS_DIR = join(BEADS_ARTIFACTS_DIR, "plan-snapshots");
export const RUNTIME_ATTACHMENTS_DIR = join(
	BEADS_ARTIFACTS_DIR,
	"runtime-attachments",
);
export const RUNTIME_CHECKPOINTS_DIR = join(
	BEADS_ARTIFACTS_DIR,
	"runtime-checkpoints",
);
export const LEGACY_RUNTIME_ATTACHMENTS_FILE = join(
	BEADS_ARTIFACTS_DIR,
	"runtime-attachments.json",
);
export const BOULDER_STATE_FILE = join(".sisyphus", "boulder.json");

export function getArtifactsIndexPath(): string {
	return join(MANIFESTS_DIR, `index.${BEADS_ARTIFACTS_SCHEMA_LABEL}.json`);
}

export function getPlanSnapshotManifestPath(beadId: string): string {
	return join(
		PLAN_SNAPSHOTS_DIR,
		beadId,
		`manifest.${BEADS_ARTIFACTS_SCHEMA_LABEL}.json`,
	);
}

export function getPlanSnapshotDirectory(beadId: string): string {
	return join(PLAN_SNAPSHOTS_DIR, beadId, "snapshots");
}

export function getPlanSnapshotPath(args: {
	beadId: string;
	timestamp: string;
	hash: string;
}): string {
	return join(
		getPlanSnapshotDirectory(args.beadId),
		`${args.timestamp}-${args.hash}.md`,
	);
}

export function getRuntimeAttachmentsRegistryPath(): string {
	return join(
		RUNTIME_ATTACHMENTS_DIR,
		`registry.${BEADS_ARTIFACTS_SCHEMA_LABEL}.json`,
	);
}

export function getRuntimeCheckpointPath(sessionId: string): string {
	return join(
		RUNTIME_CHECKPOINTS_DIR,
		`checkpoint-${sessionId}.${BEADS_ARTIFACTS_SCHEMA_LABEL}.json`,
	);
}
