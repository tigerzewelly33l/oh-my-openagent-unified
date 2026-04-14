import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
	createPlanSnapshotIndex,
	createRuntimeAttachmentsRegistry,
	createSchemaMetadata,
	getArtifactsIndexPath,
	getArtifactsProducerMetadata,
	getRuntimeAttachmentsRegistryPath,
	getRuntimeCheckpointPath,
	isPlanSnapshotIndex,
	LEGACY_RUNTIME_ATTACHMENTS_FILE,
	type RuntimeAttachmentRecord,
	readJsonObject,
} from "../beads-runtime-artifact-files.js";
import {
	CONFIG_BASENAME,
	ensureCanonicalPluginRegistration,
	hasExplicitBeadsRuntimeManagedConfig,
	refreshCanonicalBridgeConfigFromTemplate,
} from "../bridge/runtime-contract.js";
import type { UpgradeCopyResult } from "./files.js";

const TEMPLATE_OWNED_BRIDGE_FILES = [`${CONFIG_BASENAME}.jsonc`] as const;

function normalizeRelativePath(path: string): string {
	return path.replaceAll("\\", "/");
}

export function getTemplateOwnedBridgeFiles(): readonly string[] {
	return TEMPLATE_OWNED_BRIDGE_FILES;
}

export function isTemplateOwnedBridgeFile(relativePath: string): boolean {
	return getTemplateOwnedBridgeFiles().includes(
		normalizeRelativePath(relativePath),
	);
}

export function shouldPreserveUpgradeFile(
	entryName: string,
	relativePath: string,
	preserveFiles: readonly string[],
): boolean {
	return (
		preserveFiles.includes(entryName) &&
		!isTemplateOwnedBridgeFile(relativePath)
	);
}

export function shouldUsePreserveDirStrategy(
	entryName: string,
	basePath: string,
	preserveDirs: readonly string[],
): boolean {
	if (basePath.length > 0) {
		return false;
	}

	return (
		preserveDirs.includes(entryName) && !isTemplateOwnedBridgeFile(entryName)
	);
}

export function refreshBridgeArtifactsScaffold(_options: {
	opencodeDir: string;
	templateOpencode: string;
	copyResult: UpgradeCopyResult;
}): void {
	const managedConfigPath = `${_options.opencodeDir}/oh-my-openagent.jsonc`;
	const managedConfigContent = existsSync(managedConfigPath)
		? readFileSync(managedConfigPath, "utf-8")
		: null;
	const beadsRuntimeEnabled =
		managedConfigContent !== null &&
		hasExplicitBeadsRuntimeManagedConfig(managedConfigContent);

	refreshCanonicalBridgeConfigFromTemplate(
		_options.templateOpencode,
		_options.opencodeDir,
		{
			beadsRuntimeEnabled,
			refreshOnlyIfBeadsRuntimeEnabled: true,
		},
	);
	ensureCanonicalPluginRegistration(`${_options.opencodeDir}/opencode.json`);

	if (beadsRuntimeEnabled) {
		migrateLegacyBeadsArtifacts(_options.opencodeDir);
	}
}

function migrateLegacyBeadsArtifacts(opencodeDir: string): void {
	const projectDir = join(opencodeDir, "..");
	const now = new Date().toISOString();
	const artifactsDir = join(projectDir, ".beads", "artifacts");
	mkdirSync(join(artifactsDir, "manifests"), { recursive: true });
	mkdirSync(join(artifactsDir, "plan-snapshots"), { recursive: true });
	mkdirSync(join(artifactsDir, "runtime-attachments"), { recursive: true });
	mkdirSync(join(artifactsDir, "runtime-checkpoints"), { recursive: true });

	const indexPath = join(projectDir, getArtifactsIndexPath());
	const existingIndex = readJsonObject(indexPath);
	if (!existsSync(indexPath)) {
		writeFileSync(
			indexPath,
			`${JSON.stringify(createPlanSnapshotIndex({ writtenAt: now }), null, 2)}\n`,
		);
	} else if (existingIndex && isPlanSnapshotIndex(existingIndex)) {
		// Keep existing canonical durable snapshot inventory untouched.
	} else if (!existingIndex) {
		writeFileSync(
			indexPath,
			`${JSON.stringify(createPlanSnapshotIndex({ writtenAt: now }), null, 2)}\n`,
		);
	}

	migrateLegacyRuntimeAttachments(projectDir, now);
	migrateLegacyRuntimeCheckpoints(projectDir, now);
}

function migrateLegacyRuntimeAttachments(
	projectDir: string,
	now: string,
): void {
	const canonicalPath = join(projectDir, getRuntimeAttachmentsRegistryPath());
	if (existsSync(canonicalPath)) {
		return;
	}

	const legacyPath = join(projectDir, LEGACY_RUNTIME_ATTACHMENTS_FILE);
	if (existsSync(legacyPath)) {
		const legacyPayload = readJsonObject(legacyPath) ?? {};
		writeFileSync(
			canonicalPath,
			`${JSON.stringify(
				createRuntimeAttachmentsRegistry({
					attachments: asLegacyRuntimeAttachments(legacyPayload),
					writtenAt: now,
				}),
				null,
				2,
			)}\n`,
		);
		return;
	}

	writeFileSync(
		canonicalPath,
		`${JSON.stringify(
			createRuntimeAttachmentsRegistry({
				attachments: {},
				writtenAt: now,
			}),
			null,
			2,
		)}\n`,
	);
}

function migrateLegacyRuntimeCheckpoints(
	projectDir: string,
	now: string,
): void {
	const legacyDir = join(projectDir, ".beads", "artifacts");
	if (!existsSync(legacyDir)) {
		return;
	}

	for (const entry of safeReaddir(legacyDir)) {
		if (!entry.startsWith("checkpoint-") || !entry.endsWith(".json")) {
			continue;
		}
		if (entry.endsWith(".schema-1.json")) {
			continue;
		}

		const sessionId = entry.slice("checkpoint-".length, -".json".length);
		const canonicalPath = join(projectDir, getRuntimeCheckpointPath(sessionId));
		if (existsSync(canonicalPath)) {
			continue;
		}

		const legacyPath = join(legacyDir, entry);
		const legacyPayload = readJsonObject(legacyPath) ?? {};
		writeFileSync(
			canonicalPath,
			`${JSON.stringify(
				createRuntimeCheckpointArtifact({
					legacyPayload,
					sessionId,
					writtenAt: now,
				}),
				null,
				2,
			)}\n`,
		);
	}
}

function createRuntimeCheckpointArtifact(args: {
	legacyPayload: Record<string, unknown>;
	sessionId: string;
	writtenAt: string;
}): Record<string, unknown> {
	const payload = args.legacyPayload;
	return {
		...createSchemaMetadata("omo", args.writtenAt),
		session_id:
			typeof payload.session_id === "string" && payload.session_id.length > 0
				? payload.session_id
				: args.sessionId,
		cleared_at:
			typeof payload.cleared_at === "string"
				? payload.cleared_at
				: args.writtenAt,
		active_plan:
			typeof payload.active_plan === "string" ? payload.active_plan : null,
		plan_name: typeof payload.plan_name === "string" ? payload.plan_name : null,
		session_ids: Array.isArray(payload.session_ids) ? payload.session_ids : [],
		task_sessions:
			payload.task_sessions &&
			typeof payload.task_sessions === "object" &&
			!Array.isArray(payload.task_sessions)
				? (payload.task_sessions as Record<string, unknown>)
				: {},
		worktree_path:
			typeof payload.worktree_path === "string" ? payload.worktree_path : null,
		bead_id: typeof payload.bead_id === "string" ? payload.bead_id : null,
		bead_source_command:
			typeof payload.bead_source_command === "string"
				? payload.bead_source_command
				: null,
		bead_worktree_path:
			typeof payload.bead_worktree_path === "string"
				? payload.bead_worktree_path
				: null,
		bead_last_reconciled_at:
			typeof payload.bead_last_reconciled_at === "string"
				? payload.bead_last_reconciled_at
				: null,
		runtime: getArtifactsProducerMetadata("oh-my-openagent"),
	};
}

function asLegacyRuntimeAttachments(
	legacyPayload: Record<string, unknown>,
): Record<string, RuntimeAttachmentRecord> {
	return legacyPayload as unknown as Record<string, RuntimeAttachmentRecord>;
}

function safeReaddir(dir: string): string[] {
	try {
		return readdirSync(dir);
	} catch {
		return [];
	}
}
