/**
 * Patch utilities for saving/applying user modifications to template files.
 * Uses unified diff format for git-friendly, human-readable patches.
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	applyPatch as diffApplyPatch,
	createPatch as diffCreatePatch,
} from "diff";

// --- Types ---

export interface PatchEntry {
	/** SHA-256 hash of original template file */
	originalHash: string;
	/** SHA-256 hash of user's modified file */
	currentHash: string;
	/** Filename of the patch file (e.g., "skill-beads-skill.md.patch") */
	patchFile: string;
	/** ISO timestamp when patch was created */
	createdAt: string;
	/** OpenCodeKit version when patch was created */
	templateVersion: string;
	/** Human-readable description of what this patch does */
	description?: string;
	/** When true, patch is skipped during upgrade apply */
	disabled?: boolean;
}

export interface PatchMetadata {
	/** Schema version */
	version: string;
	/** Map of relative file paths to patch entries */
	patches: Record<string, PatchEntry>;
}

export interface ApplyResult {
	success: boolean;
	file: string;
	message: string;
	/** True if there was a conflict */
	conflict?: boolean;
}

// --- Constants ---

const PATCHES_DIR = "patches";
const PATCHES_JSON = ".patches.json";
const METADATA_VERSION = "1.0.0";

// --- Hash Utilities ---

/**
 * Calculate SHA-256 hash of content.
 */
export function calculateHash(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

// --- Path Utilities ---

/**
 * Convert a relative file path to a safe patch filename.
 * e.g., "skill/beads/skill.md" -> "skill-beads-skill.md.patch"
 */
export function pathToPatchFilename(relativePath: string): string {
	return `${relativePath.replace(/\//g, "-")}.patch`;
}

/**
 * Convert a patch filename back to a relative path.
 * e.g., "skill-beads-skill.md.patch" -> Need to match against known paths
 */
export function patchFilenameToPath(
	patchFilename: string,
	metadata: PatchMetadata,
): string | null {
	for (const [path, entry] of Object.entries(metadata.patches)) {
		if (entry.patchFile === patchFilename) {
			return path;
		}
	}
	return null;
}

/**
 * Get the patches directory path.
 */
export function getPatchesDir(opencodeDir: string): string {
	return join(opencodeDir, PATCHES_DIR);
}

/**
 * Get the template root directory (from dist/template or dev mode).
 */
export function getTemplateRoot(): string | null {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const possiblePaths = [
		join(__dirname, "template"),
		join(__dirname, "..", "..", ".opencode"),
		join(__dirname, "..", "template"),
	];

	for (const path of possiblePaths) {
		const opencodeDir = join(path, ".opencode");
		if (existsSync(opencodeDir)) {
			return path;
		}
		// Also check if path itself contains the template files
		if (existsSync(join(path, "opencode.json"))) {
			return dirname(path); // Return parent so .opencode is the child
		}
	}

	return null;
}

// --- Metadata Management ---

/**
 * Load patch metadata from .patches.json.
 */
export function loadPatchMetadata(opencodeDir: string): PatchMetadata {
	const patchesDir = getPatchesDir(opencodeDir);
	const metadataPath = join(patchesDir, PATCHES_JSON);

	if (!existsSync(metadataPath)) {
		return { version: METADATA_VERSION, patches: {} };
	}

	try {
		const content = readFileSync(metadataPath, "utf-8");
		return JSON.parse(content) as PatchMetadata;
	} catch {
		return { version: METADATA_VERSION, patches: {} };
	}
}

/**
 * Save patch metadata to .patches.json.
 */
export function savePatchMetadata(
	opencodeDir: string,
	metadata: PatchMetadata,
): void {
	const patchesDir = getPatchesDir(opencodeDir);

	if (!existsSync(patchesDir)) {
		mkdirSync(patchesDir, { recursive: true });
	}

	const metadataPath = join(patchesDir, PATCHES_JSON);
	writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
}

// --- Version Utilities ---

/**
 * Get the current OpenCodeKit version from package.json.
 */
export function getPackageVersion(): string {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const pkgPaths = [
		join(__dirname, "..", "..", "package.json"),
		join(__dirname, "..", "package.json"),
	];

	for (const pkgPath of pkgPaths) {
		if (existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
				return pkg.version || "unknown";
			} catch {
				// Try next path
			}
		}
	}

	return "unknown";
}

// --- Patch Generation ---

/**
 * Generate a unified diff patch between template and user file.
 */
export function generatePatch(
	templateContent: string,
	userContent: string,
	relativePath: string,
): string {
	return diffCreatePatch(
		relativePath,
		templateContent,
		userContent,
		"template",
		"modified",
	);
}

/**
 * Save a patch for a modified template file.
 * @returns The patch entry that was saved.
 */
export function savePatch(
	opencodeDir: string,
	relativePath: string,
	templateContent: string,
	userContent: string,
): PatchEntry {
	const metadata = loadPatchMetadata(opencodeDir);
	const patchesDir = getPatchesDir(opencodeDir);

	// Ensure patches directory exists
	if (!existsSync(patchesDir)) {
		mkdirSync(patchesDir, { recursive: true });
	}

	// Generate patch
	const patchContent = generatePatch(
		templateContent,
		userContent,
		relativePath,
	);
	const patchFilename = pathToPatchFilename(relativePath);
	const patchPath = join(patchesDir, patchFilename);

	// Write patch file
	writeFileSync(patchPath, patchContent);

	// Create entry
	const entry: PatchEntry = {
		originalHash: calculateHash(templateContent),
		currentHash: calculateHash(userContent),
		patchFile: patchFilename,
		createdAt: new Date().toISOString(),
		templateVersion: getPackageVersion(),
	};

	// Update metadata
	metadata.patches[relativePath] = entry;
	savePatchMetadata(opencodeDir, metadata);

	return entry;
}

/**
 * Remove a patch for a file.
 */
export function removePatch(
	opencodeDir: string,
	relativePath: string,
): boolean {
	const metadata = loadPatchMetadata(opencodeDir);
	const entry = metadata.patches[relativePath];

	if (!entry) {
		return false;
	}

	// Remove patch file
	const patchPath = join(getPatchesDir(opencodeDir), entry.patchFile);
	if (existsSync(patchPath)) {
		const { rmSync } = require("node:fs");
		rmSync(patchPath);
	}

	// Update metadata
	delete metadata.patches[relativePath];
	savePatchMetadata(opencodeDir, metadata);

	return true;
}

// --- Patch Application ---

/**
 * Apply a patch to file content.
 * @returns The patched content, or null if patch failed.
 */
export function applyPatch(
	originalContent: string,
	patchContent: string,
): string | false {
	const result = diffApplyPatch(originalContent, patchContent);
	return result;
}

/**
 * Apply all saved patches after an upgrade.
 */
export function applyAllPatches(opencodeDir: string): ApplyResult[] {
	const metadata = loadPatchMetadata(opencodeDir);
	const patchesDir = getPatchesDir(opencodeDir);
	const results: ApplyResult[] = [];

	for (const [relativePath, entry] of Object.entries(metadata.patches)) {
		// Skip disabled patches
		if (entry.disabled) {
			results.push({
				success: true,
				file: relativePath,
				message: "Skipped (disabled)",
			});
			continue;
		}

		const filePath = join(opencodeDir, relativePath);
		const patchPath = join(patchesDir, entry.patchFile);

		// Check if files exist
		if (!existsSync(filePath)) {
			results.push({
				success: false,
				file: relativePath,
				message: "File no longer exists",
			});
			continue;
		}

		if (!existsSync(patchPath)) {
			results.push({
				success: false,
				file: relativePath,
				message: "Patch file missing",
			});
			continue;
		}

		// Read current file and patch
		const currentContent = readFileSync(filePath, "utf-8");
		const patchContent = readFileSync(patchPath, "utf-8");

		// Try to apply patch
		const patched = applyPatch(currentContent, patchContent);

		if (patched === false) {
			// Patch failed - save as .rej file
			const rejPath = `${patchPath}.rej`;
			writeFileSync(rejPath, patchContent);

			results.push({
				success: false,
				file: relativePath,
				message: "Patch conflict - saved to .rej file",
				conflict: true,
			});
		} else {
			// Apply successful
			writeFileSync(filePath, patched);

			// Update hash in metadata
			metadata.patches[relativePath].currentHash = calculateHash(patched);
			savePatchMetadata(opencodeDir, metadata);

			results.push({
				success: true,
				file: relativePath,
				message: "Patch applied successfully",
			});
		}
	}

	return results;
}

// --- Status Checking ---

export interface PatchStatus {
	relativePath: string;
	entry: PatchEntry;
	status: "clean" | "stale" | "conflict" | "missing";
	message: string;
}

/**
 * Check the status of all patches.
 */
export function checkPatchStatus(
	opencodeDir: string,
	templateRoot: string | null,
): PatchStatus[] {
	const metadata = loadPatchMetadata(opencodeDir);
	const statuses: PatchStatus[] = [];

	for (const [relativePath, entry] of Object.entries(metadata.patches)) {
		// Check if user file exists
		const userFilePath = join(opencodeDir, relativePath);
		if (!existsSync(userFilePath)) {
			statuses.push({
				relativePath,
				entry,
				status: "missing",
				message: "User file no longer exists",
			});
			continue;
		}

		// If we have template root, check if template changed
		if (templateRoot) {
			const templateFilePath = join(templateRoot, ".opencode", relativePath);
			if (existsSync(templateFilePath)) {
				const templateContent = readFileSync(templateFilePath, "utf-8");
				const templateHash = calculateHash(templateContent);

				if (templateHash !== entry.originalHash) {
					// Template changed since patch was created
					// Try to apply patch to see if it would work
					const patchPath = join(getPatchesDir(opencodeDir), entry.patchFile);
					if (existsSync(patchPath)) {
						const patchContent = readFileSync(patchPath, "utf-8");
						const result = applyPatch(templateContent, patchContent);

						if (result === false) {
							statuses.push({
								relativePath,
								entry,
								status: "conflict",
								message: "Template changed and patch cannot apply cleanly",
							});
						} else {
							statuses.push({
								relativePath,
								entry,
								status: "stale",
								message: "Template changed but patch can still apply",
							});
						}
					} else {
						statuses.push({
							relativePath,
							entry,
							status: "missing",
							message: "Patch file missing",
						});
					}
					continue;
				}
			}
		}

		// Template unchanged or no template available - patch is clean
		statuses.push({
			relativePath,
			entry,
			status: "clean",
			message: "Patch is up to date",
		});
	}

	return statuses;
}
