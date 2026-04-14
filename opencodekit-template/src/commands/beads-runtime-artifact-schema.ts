import { BEADS_ARTIFACTS_SCHEMA_VERSION } from "./beads-runtime-artifact-paths.js";
import { getPackageVersion } from "./init/paths.js";

export interface ProducerMetadata {
	name: string;
	version: string;
}

export interface SchemaContractMetadata {
	schemaVersion: number;
	producer: ProducerMetadata;
	writtenAt: string;
}

export interface PlanSnapshotManifest extends SchemaContractMetadata {
	beadId: string;
	sourcePlanPath: string;
	contentHash: string;
	createdAt: string;
	latestSnapshot?: string;
}

export interface PlanSnapshotIndexEntry {
	beadId: string;
	manifestPath: string;
	latestSnapshot?: string;
	updatedAt: string;
	sourcePlanPath: string;
	contentHash: string;
}

export interface PlanSnapshotIndex extends SchemaContractMetadata {
	plans: Record<string, PlanSnapshotIndexEntry>;
}

export interface RuntimeAttachmentRecord {
	beadID: string;
	continuationKey: string;
	continuationDirectory: string;
	activePlan: string;
	startedAt: string;
	sourceCommand: string;
	worktreePath: string;
	attachedAt: string;
	branchName?: string;
	worktreeName?: string;
	runtimeVersion?: string;
}

export interface RuntimeAttachmentsRegistry extends SchemaContractMetadata {
	attachments: Record<string, RuntimeAttachmentRecord>;
	runtime: ProducerMetadata;
}

export interface RuntimeCheckpointArtifact extends SchemaContractMetadata {
	session_id: string;
	cleared_at: string;
	active_plan: string | null;
	plan_name: string | null;
	session_ids: string[];
	task_sessions: Record<string, unknown>;
	worktree_path: string | null;
	bead_id: string | null;
	bead_source_command: string | null;
	bead_worktree_path: string | null;
	bead_last_reconciled_at: string | null;
	runtime: ProducerMetadata;
}

export function getArtifactsProducerMetadata(name: string): ProducerMetadata {
	return {
		name,
		version: getPackageVersion(),
	};
}

export function createSchemaMetadata(name: string, writtenAt: string) {
	return {
		schemaVersion: BEADS_ARTIFACTS_SCHEMA_VERSION,
		producer: getArtifactsProducerMetadata(name),
		writtenAt,
	};
}

export function createPlanSnapshotManifest(args: {
	beadId: string;
	sourcePlanPath: string;
	contentHash: string;
	createdAt: string;
	latestSnapshot?: string;
}): PlanSnapshotManifest {
	return {
		...createSchemaMetadata("ock", args.createdAt),
		beadId: args.beadId,
		sourcePlanPath: args.sourcePlanPath,
		contentHash: args.contentHash,
		createdAt: args.createdAt,
		...(args.latestSnapshot ? { latestSnapshot: args.latestSnapshot } : {}),
	};
}

export function createPlanSnapshotIndex(args: {
	plans?: Record<string, PlanSnapshotIndexEntry>;
	writtenAt: string;
}): PlanSnapshotIndex {
	return {
		...createSchemaMetadata("ock", args.writtenAt),
		plans: args.plans ?? {},
	};
}

export function createRuntimeAttachmentsRegistry(args: {
	attachments: Record<string, RuntimeAttachmentRecord>;
	writtenAt: string;
	runtimeProducer?: ProducerMetadata;
}): RuntimeAttachmentsRegistry {
	return {
		...createSchemaMetadata("omo", args.writtenAt),
		attachments: args.attachments,
		runtime:
			args.runtimeProducer ?? getArtifactsProducerMetadata("oh-my-openagent"),
	};
}
