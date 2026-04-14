import {
	detectArtifactNamespaceCollisions,
	findLatestRuntimeCheckpoint,
	getUnsupportedSchemaVersion,
	isRuntimeCheckpointArtifact,
} from "./beads-runtime-artifact-files.js";
import type { BeadsRuntimeCheck } from "./beads-runtime-health-types.js";
import {
	createUnificationDiagnosticCheck,
	DIAGNOSTIC_CODES,
} from "./diagnostic-codes.js";

export function createCheckpointCheck(projectDir: string): BeadsRuntimeCheck {
	const collisions = detectArtifactNamespaceCollisions(projectDir);
	if (collisions.length > 0) {
		return createUnificationDiagnosticCheck({
			name: "checkpoint payload",
			level: "ERROR",
			code: DIAGNOSTIC_CODES.NAMESPACE_COLLISION,
			owner: "omo",
			canonicalStore: ".beads",
			repairable: true,
			message: "runtime checkpoint namespace collision detected",
			details: collisions,
		});
	}

	const locatedCheckpoint = findLatestRuntimeCheckpoint(projectDir);
	if (!locatedCheckpoint) {
		return createUnificationDiagnosticCheck({
			name: "checkpoint payload",
			level: "OK",
			code: DIAGNOSTIC_CODES.OK,
			owner: "omo",
			canonicalStore: ".beads",
			repairable: false,
			message: "no runtime checkpoint artifacts detected",
		});
	}

	const checkpoint = locatedCheckpoint.payload;
	const unsupportedVersion = getUnsupportedSchemaVersion(checkpoint);
	if (unsupportedVersion !== null) {
		return createUnificationDiagnosticCheck({
			name: "checkpoint payload",
			level: "ERROR",
			code: DIAGNOSTIC_CODES.SCHEMA_SKEW,
			owner: "omo",
			canonicalStore: ".beads",
			repairable: false,
			message: `runtime checkpoint uses unsupported schema version ${unsupportedVersion}`,
			details: [locatedCheckpoint.path],
		});
	}

	if (!locatedCheckpoint.isLegacy && !isRuntimeCheckpointArtifact(checkpoint)) {
		return createUnificationDiagnosticCheck({
			name: "checkpoint payload",
			level: "WARN",
			code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
			owner: "omo",
			canonicalStore: ".beads",
			repairable: true,
			message: "active checkpoint artifact is malformed",
			details: [locatedCheckpoint.path],
		});
	}

	const beadID =
		typeof checkpoint.bead_id === "string" ? checkpoint.bead_id.trim() : "";
	const details = [locatedCheckpoint.path];
	if (locatedCheckpoint.isLegacy) {
		details.unshift(
			"legacy flat checkpoint artifact detected; migrate to .beads/artifacts/runtime-checkpoints/checkpoint-<session-id>.schema-1.json",
		);
	}

	return beadID
		? createUnificationDiagnosticCheck({
				name: "checkpoint payload",
				level: locatedCheckpoint.isLegacy ? "WARN" : "OK",
				code: locatedCheckpoint.isLegacy
					? DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE
					: DIAGNOSTIC_CODES.OK,
				owner: "omo",
				canonicalStore: ".beads",
				repairable: locatedCheckpoint.isLegacy,
				message: locatedCheckpoint.isLegacy
					? `legacy runtime checkpoint remains readable with bead_id ${beadID}`
					: `active checkpoint includes bead_id ${beadID}`,
				details,
			})
		: createUnificationDiagnosticCheck({
				name: "checkpoint payload",
				level: "WARN",
				code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
				owner: "omo",
				canonicalStore: ".beads",
				repairable: true,
				message: "active checkpoint payload missing bead_id",
				details,
			});
}
