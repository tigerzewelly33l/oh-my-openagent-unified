import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	BOULDER_STATE_FILE,
	detectArtifactNamespaceCollisions,
	findRuntimeAttachmentsRegistry,
	getUnsupportedSchemaVersion,
	isRuntimeAttachmentsRegistry,
	readJsonObject,
} from "./beads-runtime-artifact-files.js";
import type { BeadsRuntimeCheck } from "./beads-runtime-health-types.js";
import {
	createUnificationDiagnosticCheck,
	DIAGNOSTIC_CODES,
} from "./diagnostic-codes.js";

export function createRuntimeArtifactsCheck(
	projectDir: string,
): BeadsRuntimeCheck {
	const collisions = detectArtifactNamespaceCollisions(projectDir);
	if (collisions.length > 0) {
		return createUnificationDiagnosticCheck({
			name: "runtime attachments",
			level: "ERROR",
			code: DIAGNOSTIC_CODES.NAMESPACE_COLLISION,
			owner: "omo",
			canonicalStore: ".beads",
			repairable: true,
			message: "runtime attachment namespace collision detected",
			details: collisions,
		});
	}

	const locatedRegistry = findRuntimeAttachmentsRegistry(projectDir);
	if (!locatedRegistry) {
		return createUnificationDiagnosticCheck({
			name: "runtime attachments",
			level: "OK",
			code: DIAGNOSTIC_CODES.OK,
			owner: "omo",
			canonicalStore: ".beads",
			repairable: false,
			message: "no runtime attachment artifacts detected",
		});
	}

	const registry = locatedRegistry.payload;
	const unsupportedVersion = getUnsupportedSchemaVersion(registry);
	if (unsupportedVersion !== null) {
		return createUnificationDiagnosticCheck({
			name: "runtime attachments",
			level: "ERROR",
			code: DIAGNOSTIC_CODES.SCHEMA_SKEW,
			owner: "omo",
			canonicalStore: ".beads",
			repairable: false,
			message: `runtime attachment registry uses unsupported schema version ${unsupportedVersion}`,
			details: [locatedRegistry.path],
		});
	}

	if (!locatedRegistry.isLegacy && !isRuntimeAttachmentsRegistry(registry)) {
		return createUnificationDiagnosticCheck({
			name: "runtime attachments",
			level: "WARN",
			code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
			owner: "omo",
			canonicalStore: ".beads",
			repairable: true,
			message: "runtime attachment registry is malformed",
			details: [locatedRegistry.path],
		});
	}

	let attachments: Record<string, unknown>;
	if (locatedRegistry.isLegacy) {
		attachments = registry as Record<string, unknown>;
	} else {
		attachments = locatedRegistry.payload.attachments as Record<
			string,
			unknown
		>;
	}
	const issues = collectRuntimeAttachmentIssues(attachments);
	const details = [locatedRegistry.path, ...issues];
	if (locatedRegistry.isLegacy) {
		details.unshift(
			"legacy flat runtime attachment registry detected; migrate to .beads/artifacts/runtime-attachments/registry.schema-1.json",
		);
	}

	return issues.length === 0
		? createUnificationDiagnosticCheck({
				name: "runtime attachments",
				level: locatedRegistry.isLegacy ? "WARN" : "OK",
				code: locatedRegistry.isLegacy
					? DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE
					: DIAGNOSTIC_CODES.OK,
				owner: "omo",
				canonicalStore: ".beads",
				repairable: locatedRegistry.isLegacy,
				message: locatedRegistry.isLegacy
					? `legacy runtime attachment registry remains readable (${Object.keys(attachments).length} attachment${Object.keys(attachments).length === 1 ? "" : "s"})`
					: `runtime attachment registry is consistent (${Object.keys(attachments).length} attachment${Object.keys(attachments).length === 1 ? "" : "s"})`,
				details,
			})
		: createUnificationDiagnosticCheck({
				name: "runtime attachments",
				level: "WARN",
				code: DIAGNOSTIC_CODES.SPLIT_BRAIN,
				owner: "omo",
				canonicalStore: ".beads",
				repairable: true,
				message: "stale attach/reconcile artifacts detected",
				details,
			});
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
