import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	BOULDER_STATE_FILE,
	RUNTIME_ATTACHMENTS_FILE,
	readJsonObject,
} from "./beads-runtime-artifact-files.js";
import type { BeadsRuntimeCheck } from "./beads-runtime-health-types.js";

export function createRuntimeArtifactsCheck(
	projectDir: string,
): BeadsRuntimeCheck {
	const registryPath = join(projectDir, RUNTIME_ATTACHMENTS_FILE);
	if (!existsSync(registryPath)) {
		return {
			name: "runtime attachments",
			level: "OK",
			message: "no runtime attachment artifacts detected",
		};
	}

	const registry = readJsonObject(registryPath);
	if (!registry) {
		return {
			name: "runtime attachments",
			level: "WARN",
			message: "runtime attachment registry is malformed",
			details: [registryPath],
		};
	}

	const issues = collectRuntimeAttachmentIssues(registry);
	return issues.length === 0
		? {
				name: "runtime attachments",
				level: "OK",
				message: `runtime attachment registry is consistent (${Object.keys(registry).length} attachment${Object.keys(registry).length === 1 ? "" : "s"})`,
				details: [registryPath],
			}
		: {
				name: "runtime attachments",
				level: "WARN",
				message: "stale attach/reconcile artifacts detected",
				details: [registryPath, ...issues],
			};
}

function collectRuntimeAttachmentIssues(
	registry: Record<string, unknown>,
): string[] {
	const issues: string[] = [];

	for (const [key, value] of Object.entries(registry)) {
		collectRuntimeAttachmentIssue(key, value, issues);
	}

	return issues;
}

function collectRuntimeAttachmentIssue(
	key: string,
	value: unknown,
	issues: string[],
): void {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		issues.push(`attachment ${key} is malformed`);
		return;
	}

	const record = value as Record<string, unknown>;
	const beadID = typeof record.beadID === "string" ? record.beadID : key;
	const continuationDirectory =
		typeof record.continuationDirectory === "string"
			? record.continuationDirectory
			: "";
	if (
		!continuationDirectory ||
		typeof record.activePlan !== "string" ||
		typeof record.startedAt !== "string"
	) {
		issues.push(`attachment ${key} is malformed`);
		return;
	}

	const boulderPath = join(continuationDirectory, BOULDER_STATE_FILE);
	const boulderState = existsSync(boulderPath)
		? readJsonObject(boulderPath)
		: null;
	if (!boulderState) {
		issues.push(
			`attachment ${key} for bead ${beadID} points to missing continuation state`,
		);
		return;
	}

	if (
		boulderState.active_plan !== record.activePlan ||
		boulderState.started_at !== record.startedAt ||
		boulderState.bead_id !== record.beadID
	) {
		issues.push(
			`attachment ${key} for bead ${beadID} is stale against the current continuation state`,
		);
	}

	const reconciledAt =
		typeof boulderState.bead_last_reconciled_at === "string"
			? boulderState.bead_last_reconciled_at.trim()
			: "";
	if (!reconciledAt) {
		issues.push(
			`attachment ${key} for bead ${beadID} has no bead_last_reconciled_at reconcile timestamp`,
		);
	}
}
