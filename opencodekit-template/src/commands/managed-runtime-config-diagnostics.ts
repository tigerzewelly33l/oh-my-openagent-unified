import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type {
	BeadsRuntimeCheck,
	ManagedRuntimeConfig,
} from "./beads-runtime-health-types.js";
import {
	createUnificationDiagnosticCheck,
	DIAGNOSTIC_CODES,
} from "./diagnostic-codes.js";

const MANAGED_CONFIG_CANDIDATES = [
	"oh-my-openagent.jsonc",
	"oh-my-openagent.json",
];

export interface ManagedConfigDiagnosticResult {
	check: BeadsRuntimeCheck;
	managedConfig: ManagedRuntimeConfig | null;
	error: string | null;
}

export function createManagedConfigCheck(
	opencodeDir: string,
): ManagedConfigDiagnosticResult {
	const managedConfigPath = findManagedConfigPath(opencodeDir);
	if (!managedConfigPath) {
		return {
			check: createUnificationDiagnosticCheck({
				name: "managed config",
				level: "WARN",
				code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
				owner: "ock",
				canonicalStore: ".sisyphus",
				repairable: true,
				message: "managed config missing (.opencode/oh-my-openagent.jsonc)",
			}),
			managedConfig: null,
			error: null,
		};
	}

	const { config, error } = readManagedConfig(managedConfigPath);
	if (error) {
		return {
			check: createUnificationDiagnosticCheck({
				name: "managed config",
				level: "ERROR",
				code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
				owner: "ock",
				canonicalStore: ".sisyphus",
				repairable: false,
				message: "managed config could not be parsed as JSONC",
				details: [managedConfigPath, error],
			}),
			managedConfig: null,
			error,
		};
	}

	return {
		check: createUnificationDiagnosticCheck({
			name: "managed config",
			level: "OK",
			code: DIAGNOSTIC_CODES.OK,
			owner: "ock",
			canonicalStore: ".sisyphus",
			repairable: false,
			message: `managed config present (${managedConfigPath})`,
		}),
		managedConfig: config,
		error: null,
	};
}

export function createBeadsRuntimeFlagCheck(
	managedConfig: ManagedRuntimeConfig | null,
	managedConfigError: string | null,
): BeadsRuntimeCheck {
	if (managedConfigError) {
		return createUnificationDiagnosticCheck({
			name: "beads_runtime flag",
			level: "WARN",
			code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
			owner: "ock",
			canonicalStore: ".sisyphus",
			repairable: true,
			message:
				"experimental.beads_runtime could not be inspected because managed config parsing failed",
		});
	}

	return managedConfig?.experimental?.beads_runtime === true
		? createUnificationDiagnosticCheck({
				name: "beads_runtime flag",
				level: "OK",
				code: DIAGNOSTIC_CODES.OK,
				owner: "ock",
				canonicalStore: ".sisyphus",
				repairable: false,
				message: "experimental.beads_runtime is enabled",
			})
		: createUnificationDiagnosticCheck({
				name: "beads_runtime flag",
				level: "OK",
				code: DIAGNOSTIC_CODES.OK,
				owner: "ock",
				canonicalStore: ".sisyphus",
				repairable: false,
				message: "experimental.beads_runtime is disabled",
			});
}

export function createTaskSystemCollisionCheck(
	managedConfig: ManagedRuntimeConfig | null,
	managedConfigError: string | null,
): BeadsRuntimeCheck {
	if (managedConfigError) {
		return createUnificationDiagnosticCheck({
			name: "task_system collision",
			level: "WARN",
			code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
			owner: "ock",
			canonicalStore: ".sisyphus",
			repairable: true,
			message:
				"experimental.task_system collision could not be inspected because managed config parsing failed",
		});
	}

	return managedConfig?.experimental?.beads_runtime === true &&
		managedConfig.experimental?.task_system === true
		? createUnificationDiagnosticCheck({
				name: "task_system collision",
				level: "ERROR",
				code: DIAGNOSTIC_CODES.SPLIT_BRAIN,
				owner: "ock",
				canonicalStore: ".sisyphus",
				repairable: true,
				message:
					"experimental.task_system collides with experimental.beads_runtime in managed runtime config",
			})
		: createUnificationDiagnosticCheck({
				name: "task_system collision",
				level: "OK",
				code: DIAGNOSTIC_CODES.OK,
				owner: "ock",
				canonicalStore: ".sisyphus",
				repairable: false,
				message: "no experimental.task_system collision detected",
			});
}

function findManagedConfigPath(opencodeDir: string): string | null {
	for (const candidate of MANAGED_CONFIG_CANDIDATES) {
		const filePath = join(opencodeDir, candidate);
		if (existsSync(filePath)) {
			return filePath;
		}
	}

	return null;
}

function readManagedConfig(filePath: string): {
	config: ManagedRuntimeConfig | null;
	error: string | null;
} {
	try {
		return {
			config: JSON.parse(
				stripJsonComments(readFileSync(filePath, "utf-8")),
			) as ManagedRuntimeConfig,
			error: null,
		};
	} catch (error) {
		return {
			config: null,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function stripJsonComments(content: string): string {
	return content.replace(/^\s*\/\/.*$/gm, "").trim();
}
