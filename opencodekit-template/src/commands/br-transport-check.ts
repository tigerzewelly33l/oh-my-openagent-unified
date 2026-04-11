import { spawnSync } from "node:child_process";

import type { BeadsRuntimeCheck } from "./beads-runtime-health-types.js";

export function createBrAvailabilityCheck(
	projectDir: string,
	beadsRuntimeEnabled: boolean,
): BeadsRuntimeCheck {
	if (!beadsRuntimeEnabled) {
		return {
			name: "br transport",
			level: "OK",
			message: "br availability not required while beads runtime is disabled",
		};
	}

	const result = spawnSync("br", ["ready", "--json"], {
		cwd: projectDir,
		encoding: "utf-8",
	});
	if (!result.error && result.status === 0) {
		return {
			name: "br transport",
			level: "OK",
			message: "br ready --json succeeded in the current repo",
		};
	}

	const failureReason =
		result.error?.message ??
		result.stderr?.trim() ??
		result.stdout?.trim() ??
		`br exited with status ${result.status ?? "unknown"}`;
	return {
		name: "br transport",
		level: "ERROR",
		message: "br is unavailable for beads-runtime reads in the current repo",
		details: [failureReason],
	};
}
