import type {
	BeadsRuntimeCheck,
	BeadsRuntimeHealthLevel,
	BeadsRuntimeHealthReport,
} from "./beads-runtime-health-types.js";
import { createBrAvailabilityCheck } from "./br-transport-check.js";
import { createCheckpointCheck } from "./checkpoint-payload-check.js";
import {
	createBeadsRuntimeFlagCheck,
	createManagedConfigCheck,
	createTaskSystemCollisionCheck,
} from "./managed-runtime-config-diagnostics.js";
import { createRuntimeArtifactsCheck } from "./runtime-attachment-check.js";

export type {
	BeadsRuntimeCheck,
	BeadsRuntimeHealthLevel,
	BeadsRuntimeHealthReport,
} from "./beads-runtime-health-types.js";

function getLevel(checks: BeadsRuntimeCheck[]): BeadsRuntimeHealthLevel {
	if (checks.some((check) => check.level === "ERROR")) {
		return "ERROR";
	}

	return checks.some((check) => check.level === "WARN") ? "WARN" : "OK";
}

export function getBeadsRuntimeHealthReport(args: {
	projectDir: string;
	opencodeDir: string;
}): BeadsRuntimeHealthReport {
	const managedConfigResult = createManagedConfigCheck(args.opencodeDir);
	const managedConfig = managedConfigResult.managedConfig;
	const beadsRuntimeEnabled =
		managedConfig?.experimental?.beads_runtime === true;
	const checks = [
		managedConfigResult.check,
		createBeadsRuntimeFlagCheck(managedConfig, managedConfigResult.error),
		createTaskSystemCollisionCheck(managedConfig, managedConfigResult.error),
		createBrAvailabilityCheck(args.projectDir, beadsRuntimeEnabled),
		createCheckpointCheck(args.projectDir),
		createRuntimeArtifactsCheck(args.projectDir),
	];

	return {
		level: getLevel(checks),
		checks,
	};
}
