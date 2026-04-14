import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import * as p from "@clack/prompts";
import color from "picocolors";

import {
	createPlanSnapshotIndex,
	createPlanSnapshotManifest,
	getArtifactsIndexPath,
	getPlanSnapshotManifestPath,
	getPlanSnapshotPath,
	isPlanSnapshotIndex,
	isPlanSnapshotManifest,
	readJsonObject,
} from "./beads-runtime-artifact-files.js";

interface BrTaskSummary {
	id: string;
	status?: string;
}

interface BrListResponse {
	issues?: unknown;
}

export interface PlanPublishOptions {
	bead?: string;
	plan?: string;
}

interface ResolvedPlanPath {
	absolutePath: string;
	relativePath: string;
}

interface PublishOutcome {
	beadId: string;
	manifestPath: string;
	indexPath: string;
	contentHash: string;
	snapshotPath: string;
	written: boolean;
	alreadyCurrent: boolean;
	createdAt: string;
	sourcePlanPath: string;
}

interface BrCommandResult {
	status: number | null;
	stdout: string;
	stderr: string;
	error?: Error;
}

function fail(message: string): never {
	throw new Error(message);
}

function ensureProjectSupportsPlanPublish(): void {
	if (!existsSync(join(process.cwd(), ".beads"))) {
		fail("This command requires a .beads directory in the current project.");
	}
}

function resolvePlanPath(planPath: string | undefined): ResolvedPlanPath {
	if (!planPath || planPath.trim().length === 0) {
		fail("Missing required --plan <absolute-or-relative-plan-path> argument.");
	}

	const absolutePath = resolve(process.cwd(), planPath);
	const relativePath = relative(process.cwd(), absolutePath);
	const normalizedRelative = relativePath.split("\\").join("/");
	const planPrefix = `.sisyphus/plans/`;

	if (
		relativePath.startsWith("..") ||
		isAbsolute(relativePath) ||
		!normalizedRelative.startsWith(planPrefix) ||
		!normalizedRelative.endsWith(".md")
	) {
		fail(
			"Plan path must point to a .sisyphus/plans/*.md file inside the current project.",
		);
	}

	if (!existsSync(absolutePath)) {
		fail(`Plan file not found: ${planPath}`);
	}

	return {
		absolutePath,
		relativePath: normalizedRelative,
	};
}

function executeBr(args: string[]): BrCommandResult {
	const result = spawnSync("br", args, {
		cwd: process.cwd(),
		encoding: "utf-8",
	});

	return {
		status: result.status,
		stdout: result.stdout,
		stderr: result.stderr,
		...(result.error instanceof Error ? { error: result.error } : {}),
	};
}

function ensureBrAvailable(result: BrCommandResult): void {
	if (!result.error) {
		return;
	}

	const reason =
		result.error.message ??
		result.stderr.trim() ??
		result.stdout.trim() ??
		`br exited with status ${result.status ?? "unknown"}`;
	fail(`Unable to read bead state through br: ${reason}`);
}

function parseBrTaskSummaries(value: unknown): BrTaskSummary[] {
	if (value && typeof value === "object" && !Array.isArray(value)) {
		const record = value as Record<string, unknown>;
		if (typeof record.id === "string") {
			return [
				{
					id: record.id,
					status: typeof record.status === "string" ? record.status : undefined,
				},
			];
		}
	}

	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((entry) => {
		if (!entry || typeof entry !== "object") {
			return [];
		}

		const task = entry as Record<string, unknown>;
		if (typeof task.id !== "string") {
			return [];
		}

		return [
			{
				id: task.id,
				status: typeof task.status === "string" ? task.status : undefined,
			},
		];
	});
}

function resolveBeadId(beadId: string | undefined): string {
	if (!beadId || beadId.trim().length === 0) {
		fail("Missing required --bead <bead-id> argument.");
	}

	const trimmedId = beadId.trim();
	const lookupCommands: string[][] = [
		["show", trimmedId, "--json"],
		["list", "--status", "in_progress", "--json"],
		["ready", "--json"],
	];
	const failureReasons: string[] = [];

	for (const command of lookupCommands) {
		const result = executeBr(command);
		ensureBrAvailable(result);
		if (result.status !== 0) {
			const reason =
				result.stderr.trim() ||
				result.stdout.trim() ||
				`br ${command.join(" ")} exited with status ${result.status ?? "unknown"}`;
			failureReasons.push(reason);
			continue;
		}

		const output = result.stdout.trim();
		if (output.length === 0) {
			continue;
		}

		let parsed: unknown;
		try {
			parsed = JSON.parse(output);
		} catch {
			failureReasons.push(`br ${command.join(" ")} returned invalid JSON`);
			continue;
		}

		if (command[0] === "list") {
			const listResponse = parsed as BrListResponse;
			const tasks = parseBrTaskSummaries(listResponse.issues);
			if (tasks.some((task) => task.id === trimmedId)) {
				return trimmedId;
			}
			continue;
		}

		const tasks = parseBrTaskSummaries(parsed);
		if (tasks.some((task) => task.id === trimmedId)) {
			return trimmedId;
		}
	}

	const details =
		failureReasons.length > 0 ? ` (${failureReasons.join("; ")})` : "";
	fail(`Bead not visible through supported br lookups: ${trimmedId}${details}`);
}

function hashPlanContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

function getSnapshotFileName(snapshotPath: string): string {
	return snapshotPath.split(sep).join("/").split("/").at(-1) ?? snapshotPath;
}

function loadExistingManifest(projectDir: string, beadId: string) {
	const manifestPath = join(projectDir, getPlanSnapshotManifestPath(beadId));
	if (!existsSync(manifestPath)) {
		return null;
	}

	const payload = readJsonObject(manifestPath);
	if (!payload || !isPlanSnapshotManifest(payload)) {
		fail(`Malformed plan snapshot manifest: ${manifestPath}`);
	}

	return {
		manifestPath,
		payload,
	};
}

function loadExistingIndex(projectDir: string) {
	const indexPath = join(projectDir, getArtifactsIndexPath());
	if (!existsSync(indexPath)) {
		return null;
	}

	const payload = readJsonObject(indexPath);
	if (!payload || !isPlanSnapshotIndex(payload)) {
		fail(`Malformed artifacts index: ${indexPath}`);
	}

	return {
		indexPath,
		payload,
	};
}

export function publishPlanSnapshot(args: {
	projectDir: string;
	beadId: string;
	sourcePlanPath: string;
	planContent: string;
	now?: Date;
}): PublishOutcome {
	const contentHash = hashPlanContent(args.planContent);
	const existingManifest = loadExistingManifest(args.projectDir, args.beadId);
	const existingIndex = loadExistingIndex(args.projectDir);
	const manifestPath = join(
		args.projectDir,
		getPlanSnapshotManifestPath(args.beadId),
	);
	const indexPath = join(args.projectDir, getArtifactsIndexPath());

	if (
		existingManifest?.payload.contentHash === contentHash &&
		existingManifest.payload.sourcePlanPath === args.sourcePlanPath &&
		existingManifest.payload.latestSnapshot
	) {
		return {
			beadId: args.beadId,
			manifestPath,
			indexPath,
			contentHash,
			snapshotPath: existingManifest.payload.latestSnapshot,
			written: false,
			alreadyCurrent: true,
			createdAt: existingManifest.payload.createdAt,
			sourcePlanPath: args.sourcePlanPath,
		};
	}

	const createdAt = (args.now ?? new Date()).toISOString();
	const timestampToken = createdAt.replace(/[:-]|\.\d{3}/g, "");
	const hashToken = contentHash.slice(0, 12);
	const snapshotRelativePath = getPlanSnapshotPath({
		beadId: args.beadId,
		timestamp: timestampToken,
		hash: hashToken,
	});
	const snapshotAbsolutePath = join(args.projectDir, snapshotRelativePath);

	mkdirSync(dirname(indexPath), { recursive: true });
	mkdirSync(dirname(manifestPath), { recursive: true });
	mkdirSync(dirname(snapshotAbsolutePath), { recursive: true });

	writeFileSync(snapshotAbsolutePath, args.planContent);

	const manifest = createPlanSnapshotManifest({
		beadId: args.beadId,
		sourcePlanPath: args.sourcePlanPath,
		contentHash,
		createdAt,
		latestSnapshot: snapshotRelativePath,
	});
	writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

	const priorPlans = existingIndex?.payload.plans ?? {};
	const index = createPlanSnapshotIndex({
		writtenAt: createdAt,
		plans: {
			...priorPlans,
			[args.beadId]: {
				beadId: args.beadId,
				manifestPath: getPlanSnapshotManifestPath(args.beadId),
				latestSnapshot: snapshotRelativePath,
				updatedAt: createdAt,
				sourcePlanPath: args.sourcePlanPath,
				contentHash,
			},
		},
	});
	writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);

	return {
		beadId: args.beadId,
		manifestPath,
		indexPath,
		contentHash,
		snapshotPath: snapshotRelativePath,
		written: true,
		alreadyCurrent: false,
		createdAt,
		sourcePlanPath: args.sourcePlanPath,
	};
}

export async function planPublishCommand(options: PlanPublishOptions) {
	ensureProjectSupportsPlanPublish();

	const beadId = resolveBeadId(options.bead);
	const planPath = resolvePlanPath(options.plan);
	const planContent = readFileSync(planPath.absolutePath, "utf-8");
	const outcome = publishPlanSnapshot({
		projectDir: process.cwd(),
		beadId,
		sourcePlanPath: planPath.relativePath,
		planContent,
	});

	if (process.argv.includes("--quiet")) {
		return;
	}

	if (outcome.alreadyCurrent) {
		p.outro(
			color.yellow(
				`Plan snapshot already current for ${beadId} (${getSnapshotFileName(outcome.snapshotPath)})`,
			),
		);
		return;
	}

	p.outro(
		color.green(
			`Published plan snapshot for ${beadId}: ${getSnapshotFileName(outcome.snapshotPath)}`,
		),
	);
}
