import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
	BEADS_ARTIFACTS_DIR,
	BEADS_ARTIFACTS_SCHEMA_LABEL,
	getRuntimeAttachmentsRegistryPath,
	LEGACY_RUNTIME_ATTACHMENTS_FILE,
	RUNTIME_CHECKPOINTS_DIR,
} from "./beads-runtime-artifact-paths.js";
import type {
	RuntimeAttachmentsRegistry,
	RuntimeCheckpointArtifact,
} from "./beads-runtime-artifact-schema.js";

export type LegacyArtifactKind = "runtime-attachments" | "runtime-checkpoint";

export interface LocatedArtifact<T> {
	path: string;
	payload: T;
	isLegacy: boolean;
	legacyKind?: LegacyArtifactKind;
}

export function readJsonObject(
	filePath: string,
): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

export function findRuntimeAttachmentsRegistry(
	projectDir: string,
): LocatedArtifact<
	RuntimeAttachmentsRegistry | Record<string, unknown>
> | null {
	const canonicalPath = join(projectDir, getRuntimeAttachmentsRegistryPath());
	if (existsSync(canonicalPath)) {
		return {
			path: canonicalPath,
			payload: readJsonObject(canonicalPath) ?? {},
			isLegacy: false,
		};
	}

	const legacyPath = join(projectDir, LEGACY_RUNTIME_ATTACHMENTS_FILE);
	if (!existsSync(legacyPath)) {
		return null;
	}

	return {
		path: legacyPath,
		payload: readJsonObject(legacyPath) ?? {},
		isLegacy: true,
		legacyKind: "runtime-attachments",
	};
}

export function findLatestRuntimeCheckpoint(
	projectDir: string,
): LocatedArtifact<RuntimeCheckpointArtifact | Record<string, unknown>> | null {
	const canonicalDir = join(projectDir, RUNTIME_CHECKPOINTS_DIR);
	if (existsSync(canonicalDir)) {
		const checkpoints = readdirSync(canonicalDir)
			.filter(
				(entry) =>
					entry.startsWith("checkpoint-") &&
					entry.endsWith(`.${BEADS_ARTIFACTS_SCHEMA_LABEL}.json`),
			)
			.map((entry) => join(canonicalDir, entry))
			.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

		const checkpointPath = checkpoints[0];
		if (checkpointPath) {
			return {
				path: checkpointPath,
				payload: readJsonObject(checkpointPath) ?? {},
				isLegacy: false,
			};
		}
	}

	const legacyDir = join(projectDir, BEADS_ARTIFACTS_DIR);
	if (!existsSync(legacyDir)) {
		return null;
	}

	const checkpoints = readdirSync(legacyDir)
		.filter(
			(entry) => entry.startsWith("checkpoint-") && entry.endsWith(".json"),
		)
		.map((entry) => join(legacyDir, entry))
		.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

	const checkpointPath = checkpoints[0];
	if (!checkpointPath) {
		return null;
	}

	return {
		path: checkpointPath,
		payload: readJsonObject(checkpointPath) ?? {},
		isLegacy: true,
		legacyKind: "runtime-checkpoint",
	};
}

export function detectArtifactNamespaceCollisions(
	projectDir: string,
): string[] {
	const collisions: string[] = [];
	const canonicalAttachments = join(
		projectDir,
		getRuntimeAttachmentsRegistryPath(),
	);
	const legacyAttachments = join(projectDir, LEGACY_RUNTIME_ATTACHMENTS_FILE);
	if (existsSync(canonicalAttachments) && existsSync(legacyAttachments)) {
		collisions.push(
			`runtime attachments exist in both canonical and legacy namespaces (${canonicalAttachments}, ${legacyAttachments})`,
		);
	}

	const canonicalCheckpointDir = join(projectDir, RUNTIME_CHECKPOINTS_DIR);
	const legacyArtifactsDir = join(projectDir, BEADS_ARTIFACTS_DIR);
	if (!existsSync(canonicalCheckpointDir) || !existsSync(legacyArtifactsDir)) {
		return collisions;
	}

	const canonicalNames = new Set(readdirSync(canonicalCheckpointDir));
	for (const entry of readdirSync(legacyArtifactsDir)) {
		if (!entry.startsWith("checkpoint-") || !entry.endsWith(".json")) {
			continue;
		}
		const canonicalName = entry.replace(
			/\.json$/,
			`.${BEADS_ARTIFACTS_SCHEMA_LABEL}.json`,
		);
		if (canonicalNames.has(canonicalName)) {
			collisions.push(
				`runtime checkpoint exists in both canonical and legacy namespaces (${join(canonicalCheckpointDir, canonicalName)}, ${join(legacyArtifactsDir, entry)})`,
			);
		}
	}

	return collisions;
}

export function getLatestCheckpointPath(projectDir: string): string | null {
	return findLatestRuntimeCheckpoint(projectDir)?.path ?? null;
}
