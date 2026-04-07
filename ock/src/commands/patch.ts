import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import {
	notFound,
	requireOpencodePath,
	showEmpty,
	unknownAction,
} from "../utils/errors.js";
import {
	applyAllPatches,
	applyPatch,
	calculateHash,
	checkPatchStatus,
	getPatchesDir,
	getTemplateRoot,
	loadPatchMetadata,
	type PatchEntry,
	removePatch,
	savePatch,
	savePatchMetadata,
} from "../utils/patch.js";
import { PatchActionSchema, parseAction } from "../utils/schemas.js";
// --- List ---

function listPatches(opencodeDir: string): void {
	const metadata = loadPatchMetadata(opencodeDir);
	const entries = Object.entries(metadata.patches);

	if (entries.length === 0) {
		showEmpty("patches", "ock patch create <file>");
		return;
	}

	const templateRoot = getTemplateRoot();
	const statuses = checkPatchStatus(opencodeDir, templateRoot);
	const statusMap = new Map(statuses.map((s) => [s.relativePath, s]));

	p.intro(
		color.bgCyan(
			color.black(
				` ${entries.length} patch${entries.length === 1 ? "" : "es"} `,
			),
		),
	);

	for (const [relativePath, entry] of entries) {
		const ps = statusMap.get(relativePath);
		const statusLabel = ps ? formatStatus(ps.status) : color.dim("unknown");
		const disabledLabel = entry.disabled ? color.yellow(" [disabled]") : "";
		const descLabel = entry.description
			? color.dim(` — ${entry.description}`)
			: "";

		p.log.info(
			`${color.cyan(relativePath)}${disabledLabel}${descLabel}\n` +
				`  Status: ${statusLabel}  Created: ${color.dim(entry.createdAt.slice(0, 10))}  Version: ${color.dim(entry.templateVersion)}`,
		);
	}

	p.outro(color.dim("Use 'ock patch diff <file>' to view changes"));
}

function formatStatus(status: string): string {
	switch (status) {
		case "clean":
			return color.green("clean");
		case "stale":
			return color.yellow("stale");
		case "conflict":
			return color.red("conflict");
		case "missing":
			return color.red("missing");
		default:
			return color.dim(status);
	}
}

// --- Create ---

async function createPatch(opencodeDir: string): Promise<void> {
	const fileArg = process.argv[4];

	if (!fileArg) {
		p.log.error("Usage: ock patch create <file>");
		p.log.info(
			color.dim(
				"File path is relative to .opencode/ (e.g., skill/beads/SKILL.md)",
			),
		);
		return;
	}

	const relativePath = fileArg;
	const userFilePath = join(opencodeDir, relativePath);

	if (!existsSync(userFilePath)) {
		notFound("file", relativePath);
		return;
	}

	// Find template root to get original content
	const templateRoot = getTemplateRoot();
	if (!templateRoot) {
		p.log.error("Cannot find template root — unable to compute diff");
		p.log.info(color.dim("Make sure ock is installed correctly"));
		return;
	}

	const templateFilePath = join(templateRoot, ".opencode", relativePath);
	if (!existsSync(templateFilePath)) {
		p.log.error(`No template file for ${color.cyan(relativePath)}`);
		p.log.info(color.dim("Only template-originated files can be patched"));
		return;
	}

	const templateContent = readFileSync(templateFilePath, "utf-8");
	const userContent = readFileSync(userFilePath, "utf-8");

	if (calculateHash(templateContent) === calculateHash(userContent)) {
		p.log.warn(
			`${color.cyan(relativePath)} is identical to template — nothing to patch`,
		);
		return;
	}

	// Check if patch already exists
	const metadata = loadPatchMetadata(opencodeDir);
	if (metadata.patches[relativePath]) {
		const overwrite = await p.confirm({
			message: `Patch already exists for ${color.cyan(relativePath)}. Overwrite?`,
			initialValue: false,
		});
		if (p.isCancel(overwrite) || !overwrite) {
			p.cancel("Cancelled");
			return;
		}
	}

	// Ask for description
	const description = await p.text({
		message: "Description (optional)",
		placeholder: "e.g., Custom agent prompt for our team",
	});

	if (p.isCancel(description)) {
		p.cancel("Cancelled");
		return;
	}

	const entry = savePatch(
		opencodeDir,
		relativePath,
		templateContent,
		userContent,
	);

	// Save description if provided
	if (description && typeof description === "string" && description.trim()) {
		entry.description = description.trim();
		const updatedMetadata = loadPatchMetadata(opencodeDir);
		updatedMetadata.patches[relativePath] = entry;
		savePatchMetadata(opencodeDir, updatedMetadata);
	}

	p.log.success(`Created patch for ${color.cyan(relativePath)}`);
	p.log.info(color.dim(`Patch file: ${entry.patchFile}`));
}

// --- Apply ---

function applyPatches(opencodeDir: string): void {
	const fileArg = process.argv[4];
	const metadata = loadPatchMetadata(opencodeDir);
	const entries = Object.entries(metadata.patches);

	if (entries.length === 0) {
		showEmpty("patches", "ock patch create <file>");
		return;
	}

	// If a specific file is given, apply only that patch
	if (fileArg) {
		const entry = metadata.patches[fileArg];
		if (!entry) {
			notFound("patch", fileArg);
			return;
		}
		if (entry.disabled) {
			p.log.warn(
				`Patch for ${color.cyan(fileArg)} is disabled — enable it first`,
			);
			return;
		}
		applySinglePatch(opencodeDir, fileArg, entry);
		return;
	}

	// Apply all enabled patches
	// applyAllPatches already handles disabled
	const results = applyAllPatches(opencodeDir);

	const success = results.filter(
		(r) => r.success && r.message !== "Skipped (disabled)",
	).length;
	const skipped = results.filter(
		(r) => r.message === "Skipped (disabled)",
	).length;
	const conflicts = results.filter((r) => r.conflict).length;

	if (success > 0) {
		p.log.success(`Applied ${success} patch${success === 1 ? "" : "es"}`);
	}
	if (skipped > 0) {
		p.log.info(
			color.dim(
				`Skipped ${skipped} disabled patch${skipped === 1 ? "" : "es"}`,
			),
		);
	}
	if (conflicts > 0) {
		p.log.warn(
			`${conflicts} conflict${conflicts === 1 ? "" : "s"} — see .rej files in ${color.cyan(".opencode/patches/")}`,
		);
	}
	if (success === 0 && conflicts === 0 && skipped === 0) {
		p.log.info("No patches to apply");
	}
}

function applySinglePatch(
	opencodeDir: string,
	relativePath: string,
	entry: PatchEntry,
): void {
	const filePath = join(opencodeDir, relativePath);
	const patchPath = join(getPatchesDir(opencodeDir), entry.patchFile);

	if (!existsSync(filePath)) {
		p.log.error(`Target file missing: ${color.cyan(relativePath)}`);
		return;
	}

	if (!existsSync(patchPath)) {
		p.log.error(`Patch file missing: ${color.cyan(entry.patchFile)}`);
		return;
	}

	const currentContent = readFileSync(filePath, "utf-8");
	const patchContent = readFileSync(patchPath, "utf-8");

	const result = applyPatch(currentContent, patchContent);
	if (result === false) {
		p.log.error(`Conflict applying patch to ${color.cyan(relativePath)}`);
		p.log.info(
			color.dim(
				"Template may have changed — try 'ock patch create' to recreate",
			),
		);
		return;
	}

	writeFileSync(filePath, result, "utf-8");
	p.log.success(`Applied patch to ${color.cyan(relativePath)}`);
}

// --- Diff ---

function showDiff(opencodeDir: string): void {
	const fileArg = process.argv[4];

	if (!fileArg) {
		// Show all diffs
		const metadata = loadPatchMetadata(opencodeDir);
		const entries = Object.entries(metadata.patches);

		if (entries.length === 0) {
			showEmpty("patches", "ock patch create <file>");
			return;
		}

		for (const [relativePath, entry] of entries) {
			showSingleDiff(opencodeDir, relativePath, entry);
		}
		return;
	}

	const metadata = loadPatchMetadata(opencodeDir);
	const entry = metadata.patches[fileArg];

	if (!entry) {
		notFound("patch", fileArg);
		return;
	}

	showSingleDiff(opencodeDir, fileArg, entry);
}

function showSingleDiff(
	opencodeDir: string,
	relativePath: string,
	entry: PatchEntry,
): void {
	const patchPath = join(getPatchesDir(opencodeDir), entry.patchFile);

	if (!existsSync(patchPath)) {
		p.log.error(`Patch file missing: ${color.cyan(entry.patchFile)}`);
		return;
	}

	const patchContent = readFileSync(patchPath, "utf-8");
	const disabledLabel = entry.disabled ? color.yellow(" [disabled]") : "";

	console.log(`\n${color.bold(color.cyan(relativePath))}${disabledLabel}`);
	if (entry.description) {
		console.log(color.dim(`  ${entry.description}`));
	}
	console.log(color.dim("─".repeat(60)));

	// Colorize diff output
	for (const line of patchContent.split("\n")) {
		if (line.startsWith("+++") || line.startsWith("---")) {
			console.log(color.bold(line));
		} else if (line.startsWith("+")) {
			console.log(color.green(line));
		} else if (line.startsWith("-")) {
			console.log(color.red(line));
		} else if (line.startsWith("@@")) {
			console.log(color.cyan(line));
		} else {
			console.log(color.dim(line));
		}
	}
	console.log();
}

// --- Remove ---

async function removePatchCmd(opencodeDir: string): Promise<void> {
	const fileArg = process.argv[4];

	if (!fileArg) {
		p.log.error("Usage: ock patch remove <file>");
		p.log.info(color.dim("Use 'ock patch list' to see available patches"));
		return;
	}

	const metadata = loadPatchMetadata(opencodeDir);
	if (!metadata.patches[fileArg]) {
		notFound("patch", fileArg);
		return;
	}

	const confirm = await p.confirm({
		message: `Remove patch for ${color.cyan(fileArg)}?`,
		initialValue: false,
	});

	if (p.isCancel(confirm) || !confirm) {
		p.cancel("Cancelled");
		return;
	}

	const removed = removePatch(opencodeDir, fileArg);
	if (removed) {
		p.log.success(`Removed patch for ${color.cyan(fileArg)}`);
	} else {
		p.log.error(`Failed to remove patch for ${color.cyan(fileArg)}`);
	}
}

// --- Disable / Enable ---

function togglePatch(opencodeDir: string, disable: boolean): void {
	const fileArg = process.argv[4];

	if (!fileArg) {
		p.log.error(`Usage: ock patch ${disable ? "disable" : "enable"} <file>`);
		p.log.info(color.dim("Use 'ock patch list' to see available patches"));
		return;
	}

	const metadata = loadPatchMetadata(opencodeDir);
	const entry = metadata.patches[fileArg];

	if (!entry) {
		notFound("patch", fileArg);
		return;
	}

	if (disable && entry.disabled) {
		p.log.warn(`Patch for ${color.cyan(fileArg)} is already disabled`);
		return;
	}

	if (!disable && !entry.disabled) {
		p.log.warn(`Patch for ${color.cyan(fileArg)} is already enabled`);
		return;
	}

	entry.disabled = disable || undefined; // Remove field entirely when enabling
	metadata.patches[fileArg] = entry;
	savePatchMetadata(opencodeDir, metadata);

	if (disable) {
		p.log.success(`Disabled patch for ${color.cyan(fileArg)}`);
		p.log.info(color.dim("This patch will be skipped during upgrades"));
	} else {
		p.log.success(`Enabled patch for ${color.cyan(fileArg)}`);
		p.log.info(color.dim("This patch will be applied during upgrades"));
	}
}

// --- Main ---

export async function patchCommand(action?: string): Promise<void> {
	const opencodeDir = requireOpencodePath();
	if (!opencodeDir) return;

	const validatedAction = parseAction(PatchActionSchema, action);

	if (!validatedAction) {
		// Default to list
		listPatches(opencodeDir);
		return;
	}

	switch (validatedAction) {
		case "list":
			listPatches(opencodeDir);
			break;
		case "create":
			await createPatch(opencodeDir);
			break;
		case "apply":
			applyPatches(opencodeDir);
			break;
		case "diff":
			showDiff(opencodeDir);
			break;
		case "remove":
			await removePatchCmd(opencodeDir);
			break;
		case "disable":
			togglePatch(opencodeDir, true);
			break;
		case "enable":
			togglePatch(opencodeDir, false);
			break;
		default:
			unknownAction(action ?? "", [
				"list",
				"create",
				"apply",
				"diff",
				"remove",
				"disable",
				"enable",
			]);
	}
}
