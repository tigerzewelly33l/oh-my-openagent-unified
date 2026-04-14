import { BEADS_ARTIFACTS_SCHEMA_VERSION } from "./beads-runtime-artifact-paths.js";
import type {
	PlanSnapshotIndex,
	PlanSnapshotManifest,
	ProducerMetadata,
	RuntimeAttachmentsRegistry,
	RuntimeCheckpointArtifact,
	SchemaContractMetadata,
} from "./beads-runtime-artifact-schema.js";

function asRecord(value: unknown): Record<string, unknown> | null {
	return value && typeof value === "object" && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

export function isProducerMetadata(value: unknown): value is ProducerMetadata {
	const record = asRecord(value);
	return (
		!!record &&
		typeof record.name === "string" &&
		typeof record.version === "string"
	);
}

export function isSchemaMetadata(
	value: unknown,
): value is SchemaContractMetadata & Record<string, unknown> {
	const record = asRecord(value);
	if (!record) {
		return false;
	}

	return (
		typeof record.schemaVersion === "number" &&
		record.schemaVersion === BEADS_ARTIFACTS_SCHEMA_VERSION &&
		isProducerMetadata(record.producer) &&
		typeof record.writtenAt === "string"
	);
}

export function getUnsupportedSchemaVersion(value: unknown): number | null {
	const record = asRecord(value);
	if (!record || typeof record.schemaVersion !== "number") {
		return null;
	}

	return record.schemaVersion === BEADS_ARTIFACTS_SCHEMA_VERSION
		? null
		: record.schemaVersion;
}

export function isRuntimeAttachmentsRegistry(
	value: unknown,
): value is RuntimeAttachmentsRegistry & Record<string, unknown> {
	if (!isSchemaMetadata(value) || !isProducerMetadata(value.runtime)) {
		return false;
	}

	const attachments = asRecord(value.attachments);
	return !!attachments && typeof attachments === "object";
}

export function isPlanSnapshotManifest(
	value: unknown,
): value is PlanSnapshotManifest & Record<string, unknown> {
	return (
		isSchemaMetadata(value) &&
		typeof value.beadId === "string" &&
		typeof value.sourcePlanPath === "string" &&
		typeof value.contentHash === "string" &&
		typeof value.createdAt === "string" &&
		(value.latestSnapshot === undefined ||
			typeof value.latestSnapshot === "string")
	);
}

export function isPlanSnapshotIndex(
	value: unknown,
): value is PlanSnapshotIndex & Record<string, unknown> {
	if (!isSchemaMetadata(value)) {
		return false;
	}

	const plans = asRecord(value.plans);
	if (!plans) {
		return false;
	}

	return Object.values(plans).every((entry) => {
		const record = asRecord(entry);
		return (
			!!record &&
			typeof record.beadId === "string" &&
			typeof record.manifestPath === "string" &&
			typeof record.updatedAt === "string" &&
			typeof record.sourcePlanPath === "string" &&
			typeof record.contentHash === "string" &&
			(record.latestSnapshot === undefined ||
				typeof record.latestSnapshot === "string")
		);
	});
}

export function isRuntimeCheckpointArtifact(
	value: unknown,
): value is RuntimeCheckpointArtifact & Record<string, unknown> {
	return (
		isSchemaMetadata(value) &&
		isProducerMetadata(value.runtime) &&
		typeof value.session_id === "string"
	);
}
