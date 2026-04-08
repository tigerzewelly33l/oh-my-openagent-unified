import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export interface TemplateManifest {
	version: string;
	createdAt: string;
	files: Record<string, string>; // relative path -> SHA-256 hash
}

export const MANIFEST_FILE = ".template-manifest.json";

/**
 * Compute SHA-256 hash of file content.
 */
export function hashFile(filePath: string): string {
	const content = readFileSync(filePath, "utf-8");
	return createHash("sha256").update(content).digest("hex");
}

/**
 * Compute SHA-256 hash of string content.
 */
export function hashContent(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

/**
 * Scan a directory recursively and build a hash map of all files.
 * Returns record of relative paths to SHA-256 hashes.
 */
export function buildManifestFromDir(
	dir: string,
	skipDirs: string[] = ["node_modules", ".git", "dist", "coverage"],
): Record<string, string> {
	const files: Record<string, string> = {};

	function walk(currentDir: string) {
		for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (skipDirs.includes(entry.name)) continue;
				walk(join(currentDir, entry.name));
			} else if (entry.isFile()) {
				if (entry.name === MANIFEST_FILE) continue;
				const fullPath = join(currentDir, entry.name);
				const relPath = relative(dir, fullPath);
				files[relPath] = hashFile(fullPath);
			}
		}
	}

	walk(dir);
	return files;
}

/**
 * Generate and save a template manifest after installation.
 */
export function generateManifest(
	opencodeDir: string,
	version: string,
): TemplateManifest {
	const manifest: TemplateManifest = {
		version,
		createdAt: new Date().toISOString(),
		files: buildManifestFromDir(opencodeDir),
	};

	const manifestPath = join(opencodeDir, MANIFEST_FILE);
	writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
	return manifest;
}

/**
 * Load existing manifest from .opencode/ directory.
 * Returns null if no manifest exists.
 */
export function loadManifest(opencodeDir: string): TemplateManifest | null {
	const manifestPath = join(opencodeDir, MANIFEST_FILE);
	if (!existsSync(manifestPath)) return null;

	try {
		return JSON.parse(readFileSync(manifestPath, "utf-8"));
	} catch {
		return null;
	}
}

/**
 * Determine if a file has been modified by the user.
 * Compares current file hash against the manifest's recorded hash.
 *
 * Returns:
 * - "unmodified" — file matches template, safe to update
 * - "modified" — user changed it, should preserve
 * - "unknown" — not in manifest (new user file or missing manifest)
 */
export function fileModificationStatus(
	filePath: string,
	relativePath: string,
	manifest: TemplateManifest | null,
): "unmodified" | "modified" | "unknown" {
	if (!manifest) return "unknown";

	const templateHash = manifest.files[relativePath];
	if (!templateHash) return "unknown"; // Not a template file

	if (!existsSync(filePath)) return "unmodified"; // File was deleted, treat as unmodified

	const currentHash = hashFile(filePath);
	return currentHash === templateHash ? "unmodified" : "modified";
}
