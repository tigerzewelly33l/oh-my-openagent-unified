import {
	getLatestCheckpointPath,
	readJsonObject,
} from "./beads-runtime-artifact-files.js";
import type { BeadsRuntimeCheck } from "./beads-runtime-health-types.js";

export function createCheckpointCheck(projectDir: string): BeadsRuntimeCheck {
	const checkpointPath = getLatestCheckpointPath(projectDir);
	if (!checkpointPath) {
		return {
			name: "checkpoint payload",
			level: "OK",
			message: "no runtime checkpoint artifacts detected",
		};
	}

	const checkpoint = readJsonObject(checkpointPath);
	if (!checkpoint) {
		return {
			name: "checkpoint payload",
			level: "WARN",
			message: "active checkpoint artifact is malformed",
			details: [checkpointPath],
		};
	}

	const beadID =
		typeof checkpoint.bead_id === "string" ? checkpoint.bead_id.trim() : "";
	return beadID
		? {
				name: "checkpoint payload",
				level: "OK",
				message: `active checkpoint includes bead_id ${beadID}`,
				details: [checkpointPath],
			}
		: {
				name: "checkpoint payload",
				level: "WARN",
				message: "active checkpoint payload missing bead_id",
				details: [checkpointPath],
			};
}
