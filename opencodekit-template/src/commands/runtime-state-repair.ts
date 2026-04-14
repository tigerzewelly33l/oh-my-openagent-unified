import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { PlanSnapshotIndex } from "./beads-runtime-artifact-files.js";
import {
	findLatestRuntimeCheckpoint,
	findRuntimeAttachmentsRegistry,
	getArtifactsIndexPath,
	getPlanSnapshotManifestPath,
	getRuntimeAttachmentsRegistryPath,
	isPlanSnapshotIndex,
	isPlanSnapshotManifest,
	isRuntimeAttachmentsRegistry,
	isRuntimeCheckpointArtifact,
	readJsonObject,
} from "./beads-runtime-artifact-files.js";
import {
	createUnificationDiagnosticCheck,
	DIAGNOSTIC_CODES,
	type DiagnosticLevel,
	type UnificationDiagnosticCheck,
} from "./diagnostic-codes.js";
import { getPackageVersion } from "./init/paths.js";

type RepairLevel = DiagnosticLevel;

export interface RuntimeStateRepairDiagnostic
	extends UnificationDiagnosticCheck {}

export interface RuntimeStateRepairResult {
	level: RepairLevel;
	beadId: string;
	boulderPath?: string;
	restoredPlanPath?: string;
	diagnostics: RuntimeStateRepairDiagnostic[];
}

export interface RuntimeStateRepairOptions {
	projectDir: string;
	beadId?: string;
}

function createDiagnostic(
	diagnostic: RuntimeStateRepairDiagnostic,
): RuntimeStateRepairResult {
	return {
		level: "ERROR",
		beadId: "",
		diagnostics: [diagnostic],
	};
}

function isWorkspaceRoot(projectDir: string) {
	return (
		projectDir === "/work/ock-omo-system" ||
		(existsSync(join(projectDir, "opencodekit-template")) &&
			existsSync(join(projectDir, "oh-my-openagent")))
	);
}

function loadPlanIndex(projectDir: string) {
	const indexPath = join(projectDir, getArtifactsIndexPath());
	if (!existsSync(indexPath)) {
		return {
			indexPath,
			payload: null as PlanSnapshotIndex | null,
		};
	}

	const payload = readJsonObject(indexPath);
	if (!payload || !isPlanSnapshotIndex(payload)) {
		throw createDiagnostic({
			name: "durable plan inventory",
			code: DIAGNOSTIC_CODES.SCHEMA_SKEW,
			level: "ERROR",
			owner: "ock",
			canonicalStore: ".beads",
			message: "Durable plan inventory is malformed.",
			repairable: false,
			details: [indexPath],
		});
	}

	return { indexPath, payload };
}

function selectBeadId(args: {
	requestedBeadId?: string;
	checkpointBeadId: string;
	indexedBeadIds: string[];
	indexPath: string;
}) {
	if (args.requestedBeadId && args.requestedBeadId.trim().length > 0) {
		return args.requestedBeadId.trim();
	}

	if (args.indexedBeadIds.length > 1) {
		throw createDiagnostic({
			name: "durable plan selection",
			code: DIAGNOSTIC_CODES.AMBIGUOUS_DURABLE_PLAN,
			level: "ERROR",
			owner: "ock",
			canonicalStore: ".beads",
			message:
				"Multiple durable published plan manifests exist; pass --bead to choose which plan to restore.",
			repairable: true,
			details: [args.indexPath, ...args.indexedBeadIds],
		});
	}

	return args.indexedBeadIds[0] ?? args.checkpointBeadId;
}

function restoreWorkingPlan(args: {
	projectDir: string;
	beadId: string;
	indexPayload: PlanSnapshotIndex | null;
}) {
	if (!args.indexPayload) {
		return {
			restoredPlanPath: undefined,
			diagnostic: {
				name: "durable plan snapshot",
				code: DIAGNOSTIC_CODES.MISSING_DURABLE_PLAN,
				level: "WARN",
				owner: "ock",
				canonicalStore: ".beads",
				message:
					"No durable published plan snapshot was found; runtime state was rebuilt without restoring a working-copy plan.",
				repairable: true,
				details: [join(args.projectDir, getArtifactsIndexPath())],
			} satisfies RuntimeStateRepairDiagnostic,
		};
	}

	const entry = args.indexPayload.plans[args.beadId];
	if (!entry?.latestSnapshot) {
		return {
			restoredPlanPath: undefined,
			diagnostic: {
				name: "durable plan snapshot",
				code: DIAGNOSTIC_CODES.MISSING_DURABLE_PLAN,
				level: "WARN",
				owner: "ock",
				canonicalStore: ".beads",
				message:
					"No durable published plan snapshot was found for the selected bead; runtime state was rebuilt without restoring a working-copy plan.",
				repairable: true,
				details: [
					join(args.projectDir, getPlanSnapshotManifestPath(args.beadId)),
				],
			} satisfies RuntimeStateRepairDiagnostic,
		};
	}

	const manifestPath = join(
		args.projectDir,
		getPlanSnapshotManifestPath(args.beadId),
	);
	const manifestPayload = readJsonObject(manifestPath);
	if (!manifestPayload || !isPlanSnapshotManifest(manifestPayload)) {
		throw createDiagnostic({
			name: "durable plan manifest",
			code: DIAGNOSTIC_CODES.SCHEMA_SKEW,
			level: "ERROR",
			owner: "ock",
			canonicalStore: ".beads",
			message: "Durable plan manifest is malformed.",
			repairable: false,
			details: [manifestPath],
		});
	}

	const snapshotAbsolutePath = join(args.projectDir, entry.latestSnapshot);
	if (!existsSync(snapshotAbsolutePath)) {
		return {
			restoredPlanPath: undefined,
			diagnostic: {
				name: "durable plan snapshot",
				code: DIAGNOSTIC_CODES.MISSING_DURABLE_PLAN,
				level: "WARN",
				owner: "ock",
				canonicalStore: ".beads",
				message:
					"The latest durable plan snapshot is missing on disk; runtime state was rebuilt without restoring a working-copy plan.",
				repairable: true,
				details: [snapshotAbsolutePath],
			} satisfies RuntimeStateRepairDiagnostic,
		};
	}

	const restoredPlanPath = join(
		args.projectDir,
		manifestPayload.sourcePlanPath,
	);
	mkdirSync(join(args.projectDir, ".sisyphus", "plans"), { recursive: true });
	writeFileSync(restoredPlanPath, readFileSync(snapshotAbsolutePath, "utf-8"));
	return { restoredPlanPath, diagnostic: null };
}

export function repairRuntimeState(
	options: RuntimeStateRepairOptions,
): RuntimeStateRepairResult {
	const { projectDir } = options;
	if (
		isWorkspaceRoot(projectDir) ||
		!existsSync(join(projectDir, ".opencode", "opencode.json")) ||
		!existsSync(join(projectDir, ".opencode", "package.json"))
	) {
		return createDiagnostic({
			name: "project scope",
			code: DIAGNOSTIC_CODES.WRONG_SCOPE,
			level: "ERROR",
			owner: "ock",
			canonicalStore: "none",
			message:
				"Runtime-state repair must run from an OCK-managed project root, not the workspace container root.",
			repairable: false,
			details: [projectDir],
		});
	}

	if (!existsSync(join(projectDir, ".beads"))) {
		return createDiagnostic({
			name: "durable inventory",
			code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
			level: "ERROR",
			owner: "br",
			canonicalStore: ".beads",
			message:
				"Runtime-state repair requires a readable .beads durable inventory.",
			repairable: false,
			details: [join(projectDir, ".beads")],
		});
	}

	const locatedCheckpoint = findLatestRuntimeCheckpoint(projectDir);
	const locatedRegistry = findRuntimeAttachmentsRegistry(projectDir);
	if (
		!locatedCheckpoint ||
		!locatedRegistry ||
		!isRuntimeCheckpointArtifact(locatedCheckpoint.payload) ||
		!isRuntimeAttachmentsRegistry(locatedRegistry.payload)
	) {
		return createDiagnostic({
			name: "durable runtime artifacts",
			code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
			level: "ERROR",
			owner: "omo",
			canonicalStore: ".beads",
			message: "Durable runtime artifacts are missing or unreadable.",
			repairable: false,
			details: [
				locatedCheckpoint?.path ?? join(projectDir, ".beads", "artifacts"),
				locatedRegistry?.path ??
					join(projectDir, getRuntimeAttachmentsRegistryPath()),
			],
		});
	}

	const checkpoint = locatedCheckpoint.payload;
	const registry = locatedRegistry.payload;
	const checkpointBeadId = checkpoint.bead_id?.trim() ?? "";
	if (!checkpointBeadId) {
		return createDiagnostic({
			name: "durable runtime checkpoint",
			code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
			level: "ERROR",
			owner: "omo",
			canonicalStore: ".beads",
			message: "Durable runtime checkpoint does not include a bead_id.",
			repairable: false,
			details: [locatedCheckpoint.path],
		});
	}

	const { indexPath, payload: indexPayload } = loadPlanIndex(projectDir);
	const beadId = selectBeadId({
		requestedBeadId: options.beadId,
		checkpointBeadId,
		indexedBeadIds: indexPayload ? Object.keys(indexPayload.plans).sort() : [],
		indexPath,
	});
	const attachment = Object.values(registry.attachments).find(
		(record) => record.beadID === beadId,
	);
	if (!attachment) {
		return createDiagnostic({
			name: "durable runtime attachment",
			code: DIAGNOSTIC_CODES.REPAIRABLE_RUNTIME_STATE,
			level: "ERROR",
			owner: "omo",
			canonicalStore: ".beads",
			message:
				"No durable runtime attachment record was found for the selected bead.",
			repairable: false,
			details: [locatedRegistry.path, beadId],
		});
	}

	mkdirSync(join(projectDir, ".sisyphus"), { recursive: true });
	const restoredPlan = restoreWorkingPlan({ projectDir, beadId, indexPayload });
	const activePlan = restoredPlan.restoredPlanPath ?? attachment.activePlan;
	const now = new Date().toISOString();
	const boulderPath = join(projectDir, ".sisyphus", "boulder.json");
	writeFileSync(
		boulderPath,
		`${JSON.stringify(
			{
				active_plan: activePlan,
				started_at: attachment.startedAt,
				session_ids: checkpoint.session_ids,
				plan_name: checkpoint.plan_name ?? basename(activePlan, ".md"),
				worktree_path: checkpoint.worktree_path ?? attachment.worktreePath,
				bead_id: beadId,
				bead_source_command:
					checkpoint.bead_source_command ?? attachment.sourceCommand,
				bead_worktree_path:
					checkpoint.bead_worktree_path ?? attachment.worktreePath,
				bead_last_reconciled_at:
					checkpoint.bead_last_reconciled_at ?? attachment.attachedAt,
				task_sessions: checkpoint.task_sessions,
				bead_runtime_state: {
					schema_version: 1,
					runtime_role: "rebuildable-runtime-state",
					authoritative_source: "durable-beads-artifacts",
					producer: { name: "ock", version: getPackageVersion() },
					runtime: checkpoint.runtime,
					compatibility: {
						durable_truth: "beads-manifest-and-runtime-artifacts",
						runtime_state_conflict_policy: "durable-wins-mark-runtime-stale",
					},
					last_rebuild_source: "doctor --repair runtime-state",
					last_durable_artifact_ref: locatedRegistry.path,
					last_durable_manifest_ref: join(
						projectDir,
						getPlanSnapshotManifestPath(beadId),
					),
					last_synced_at: now,
				},
			},
			null,
			2,
		)}\n`,
	);

	const diagnostics = restoredPlan.diagnostic ? [restoredPlan.diagnostic] : [];
	return {
		level: diagnostics.length > 0 ? "WARN" : "OK",
		beadId,
		boulderPath,
		restoredPlanPath: restoredPlan.restoredPlanPath,
		diagnostics,
	};
}

export function createRuntimeStateRepairedCheck(
	result: RuntimeStateRepairResult,
): RuntimeStateRepairDiagnostic {
	return createUnificationDiagnosticCheck({
		name: "runtime-state repair",
		code: DIAGNOSTIC_CODES.RUNTIME_REPAIRED,
		level: result.level === "ERROR" ? "ERROR" : "OK",
		owner: "ock",
		canonicalStore: ".sisyphus",
		repairable: false,
		message:
			result.level === "ERROR"
				? "Runtime state repair failed."
				: "Runtime state repair rebuilt the working runtime state from durable truth.",
		details: [
			result.boulderPath,
			result.restoredPlanPath,
			result.beadId,
		].filter(
			(value): value is string => typeof value === "string" && value.length > 0,
		),
	});
}
