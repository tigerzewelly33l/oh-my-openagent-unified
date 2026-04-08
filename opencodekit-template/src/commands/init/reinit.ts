import { basename, dirname, join } from "node:path";
import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync, existsSync } from "node:fs";
import * as p from "@clack/prompts";
import color from "picocolors";
import { generateManifest, MANIFEST_FILE } from "../../utils/manifest.js";
import { savePatch } from "../../utils/patch.js";
import { EXCLUDED_DIRS, PRESERVE_USER_DIRS } from "./constants.js";

export function getAffectedFiles(dir: string, prefix = ""): string[] {
	if (!existsSync(dir)) return [];

	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (EXCLUDED_DIRS.includes(entry.name as (typeof EXCLUDED_DIRS)[number])) {
			continue;
		}
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			files.push(...getAffectedFiles(join(dir, entry.name), path));
		} else {
			files.push(path);
		}
	}
	return files;
}

export function backupOpenCode(targetDir: string): string | null {
	const opencodeDir = join(targetDir, ".opencode");
	if (!existsSync(opencodeDir)) return null;

	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const backupDir = join(targetDir, `.opencode.bak-${timestamp}`);
	renameSync(opencodeDir, backupDir);
	return backupDir;
}

export function getTemplateFiles(templateRoot: string): Set<string> {
	const opencodeSrc = join(templateRoot, ".opencode");
	if (!existsSync(opencodeSrc)) return new Set();
	return new Set(getAffectedFiles(opencodeSrc));
}

export function findOrphans(
	targetDir: string,
	templateFiles: Set<string>,
): string[] {
	const opencodeDir = join(targetDir, ".opencode");
	if (!existsSync(opencodeDir)) return [];

	const existingFiles = getAffectedFiles(opencodeDir);
	return existingFiles.filter((file) => file !== MANIFEST_FILE && !templateFiles.has(file));
}

function getModifiedTemplateContent(
	templateRoot: string,
	orphanPath: string,
): string | null {
	const templateFilePath = join(templateRoot, ".opencode", orphanPath);
	if (!existsSync(templateFilePath)) return null;
	return readFileSync(templateFilePath, "utf-8");
}

export async function autoSavePatchesForOrphans(
	targetDir: string,
	templateRoot: string,
	orphans: string[],
): Promise<{ savedPatches: string[]; trueOrphans: string[] }> {
	const opencodeDir = join(targetDir, ".opencode");
	const savedPatches: string[] = [];
	const trueOrphans: string[] = [];

	for (const orphan of orphans) {
		const templateContent = getModifiedTemplateContent(templateRoot, orphan);
		if (!templateContent) {
			trueOrphans.push(orphan);
			continue;
		}

		const userFilePath = join(opencodeDir, orphan);
		const userContent = readFileSync(userFilePath, "utf-8");

		if (templateContent === userContent) {
			trueOrphans.push(orphan);
			continue;
		}

		try {
			savePatch(opencodeDir, orphan, templateContent, userContent);
			savedPatches.push(orphan);
		} catch {
			trueOrphans.push(orphan);
		}
	}

	return { savedPatches, trueOrphans };
}

export function preserveUserFiles(targetDir: string): Map<string, string> {
	const opencodeDir = join(targetDir, ".opencode");
	const preserved = new Map<string, string>();

	function collectFiles(currentDir: string, relativeDir: string) {
		for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
			const filePath = join(currentDir, entry.name);
			const relativePath = join(relativeDir, entry.name);

			if (entry.isDirectory()) {
				collectFiles(filePath, relativePath);
				continue;
			}

			if (!entry.isFile()) continue;
			preserved.set(relativePath, readFileSync(filePath, "utf-8"));
		}
	}

	for (const relDir of PRESERVE_USER_DIRS) {
		const dirPath = join(opencodeDir, relDir);
		if (!existsSync(dirPath)) continue;
		collectFiles(dirPath, relDir);
	}

	return preserved;
}

export function restoreUserFiles(
	targetDir: string,
	preserved: Map<string, string>,
): void {
	const opencodeDir = join(targetDir, ".opencode");

	for (const [relativePath, content] of preserved) {
		const filePath = join(opencodeDir, relativePath);
		mkdirSync(dirname(filePath), { recursive: true });
		writeFileSync(filePath, content);
	}
}

export function finalizeInstalledFiles(
	targetDir: string,
	version: string,
	preservedFiles?: Map<string, string>,
): number {
	generateManifest(join(targetDir, ".opencode"), version);

	if (!preservedFiles || preservedFiles.size === 0) {
		return 0;
	}

	restoreUserFiles(targetDir, preservedFiles);
	return preservedFiles.size;
}

export function getForceReinitializePreview(targetDir: string): string[] {
	const opencodeDir = join(targetDir, ".opencode");
	return getAffectedFiles(opencodeDir);
}

export async function confirmForceReinitialize(
	targetDir: string,
	options: { yes: boolean; backup: boolean },
): Promise<boolean> {
	const affected = getForceReinitializePreview(targetDir);

	if (affected.length === 0 || options.yes) {
		return true;
	}

	p.log.warn(`${affected.length} files will be overwritten:`);
	const preview = affected.slice(0, 10);
	for (const file of preview) {
		p.log.info(color.dim(`  .opencode/${file}`));
	}
	if (affected.length > 10) {
		p.log.info(color.dim(`  ... and ${affected.length - 10} more`));
	}

	const proceed = await p.confirm({
		message: options.backup
			? "Proceed? (existing config will be backed up)"
			: "Proceed without backup?",
		initialValue: options.backup,
	});

	if (p.isCancel(proceed) || !proceed) {
		p.cancel("Cancelled");
		return false;
	}

	return true;
}

export async function promptForBackupPreference(options: { backup: boolean }): Promise<boolean | null> {
	if (options.backup) {
		return true;
	}

	const shouldBackup = await p.confirm({
		message: "Backup existing .opencode before overwriting?",
		initialValue: true,
	});

	if (p.isCancel(shouldBackup)) {
		p.cancel("Cancelled");
		return null;
	}

	return shouldBackup;
}

export function announceBackupResult(backupPath: string | null): void {
	if (backupPath) {
		p.log.info(`Backed up to ${color.cyan(basename(backupPath))}`);
	}
}

export async function handleOrphanFiles(options: {
	targetDir: string;
	templateRoot: string;
	mode: string;
	force: boolean;
	backup: boolean;
	pruneAll: boolean;
	prune: boolean;
	yes: boolean;
}): Promise<void> {
	if (options.mode !== "already-initialized" || !options.force || options.backup) {
		return;
	}

	const opencodeDir = join(options.targetDir, ".opencode");
	const templateFiles = getTemplateFiles(options.templateRoot);
	const orphans = findOrphans(options.targetDir, templateFiles);

	if (orphans.length === 0) {
		return;
	}

	p.log.warn(`Found ${orphans.length} orphan files not in template`);

	const { savedPatches, trueOrphans } = await autoSavePatchesForOrphans(
		options.targetDir,
		options.templateRoot,
		orphans,
	);

	if (savedPatches.length > 0) {
		p.log.success(
			`Auto-saved ${savedPatches.length} patches for modified template files`,
		);
		for (const patch of savedPatches) {
			p.log.info(`  ${color.green("✓")} ${patch}`);
		}
		p.log.info(
			color.dim(
				"These patches will be reapplied after template files are updated.",
			),
		);
	}

	if (trueOrphans.length === 0) {
		return;
	}

	if (options.pruneAll) {
		const pruneSpinner = p.spinner();
		pruneSpinner.start("Removing orphan files");
		for (const orphan of trueOrphans) {
			rmSync(join(opencodeDir, orphan));
		}
		pruneSpinner.stop(`Removed ${trueOrphans.length} orphan files`);
		return;
	}

	if (options.prune) {
		const selected = await p.multiselect({
			message: "Select orphan files to delete",
			options: trueOrphans.map((orphan) => ({ value: orphan, label: orphan })),
			required: false,
		});

		if (!p.isCancel(selected) && selected.length > 0) {
			const pruneSpinner = p.spinner();
			pruneSpinner.start("Deleting files");
			for (const file of selected as string[]) {
				rmSync(join(opencodeDir, file));
			}
			pruneSpinner.stop(`Deleted ${selected.length} files`);
		}
		return;
	}

	if (options.yes) {
		return;
	}

	const preview = trueOrphans.slice(0, 5);
	for (const file of preview) {
		p.log.info(color.dim(`  .opencode/${file}`));
	}
	if (trueOrphans.length > 5) {
		p.log.info(color.dim(`  ... and ${trueOrphans.length - 5} more`));
	}

	const orphanAction = await p.select({
		message: "How to handle orphan files?",
		options: [
			{ value: "keep", label: "Keep all", hint: "leave orphan files" },
			{ value: "select", label: "Select", hint: "choose which to delete" },
			{ value: "delete", label: "Delete all", hint: "remove all orphans" },
		],
	});

	if (p.isCancel(orphanAction)) {
		return;
	}

	if (orphanAction === "delete") {
		const pruneSpinner = p.spinner();
		pruneSpinner.start("Removing orphan files");
		for (const orphan of trueOrphans) {
			rmSync(join(opencodeDir, orphan));
		}
		pruneSpinner.stop(`Removed ${trueOrphans.length} orphan files`);
		return;
	}

	if (orphanAction === "select") {
		const selected = await p.multiselect({
			message: "Select orphan files to delete",
			options: trueOrphans.map((orphan) => ({ value: orphan, label: orphan })),
			required: false,
		});

		if (!p.isCancel(selected) && selected.length > 0) {
			const pruneSpinner = p.spinner();
			pruneSpinner.start("Deleting files");
			for (const file of selected as string[]) {
				rmSync(join(opencodeDir, file));
			}
			pruneSpinner.stop(`Deleted ${selected.length} files`);
		}
	}
}
