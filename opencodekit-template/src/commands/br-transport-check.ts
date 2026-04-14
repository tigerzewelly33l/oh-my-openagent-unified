import { spawnSync } from "node:child_process";

import type { BeadsRuntimeCheck } from "./beads-runtime-health-types.js";
import {
	createUnificationDiagnosticCheck,
	DIAGNOSTIC_CODES,
} from "./diagnostic-codes.js";

export function createBrAvailabilityCheck(
	projectDir: string,
	beadsRuntimeEnabled: boolean,
): BeadsRuntimeCheck {
	if (!beadsRuntimeEnabled) {
		return createUnificationDiagnosticCheck({
			name: "br transport",
			level: "OK",
			code: DIAGNOSTIC_CODES.OK,
			owner: "br",
			canonicalStore: ".beads",
			repairable: false,
			message: "br availability not required while beads runtime is disabled",
		});
	}

	const result = spawnSync("br", ["ready", "--json"], {
		cwd: projectDir,
		encoding: "utf-8",
	});
	if (!result.error && result.status === 0) {
		return createUnificationDiagnosticCheck({
			name: "br transport",
			level: "OK",
			code: DIAGNOSTIC_CODES.OK,
			owner: "br",
			canonicalStore: ".beads",
			repairable: false,
			message: "br ready --json succeeded in the current repo",
		});
	}

	const failureReason =
		result.error?.message ??
		result.stderr?.trim() ??
		result.stdout?.trim() ??
		`br exited with status ${result.status ?? "unknown"}`;
	return createUnificationDiagnosticCheck({
		name: "br transport",
		level: "ERROR",
		code: DIAGNOSTIC_CODES.WRONG_SCOPE,
		owner: "br",
		canonicalStore: ".beads",
		repairable: true,
		message: "br is unavailable for beads-runtime reads in the current repo",
		details: [failureReason],
	});
}
