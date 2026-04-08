import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
} from "node:fs";
import { join } from "node:path";
import {
	fileModificationStatus,
	type TemplateManifest,
} from "../../utils/manifest.js";
import { loadPatchMetadata } from "../../utils/patch.js";
import { shouldPreserveUpgradeFile, shouldUsePreserveDirStrategy } from "./bridge.js";
import { SKIP_DIRS } from "./constants.js";

export interface UpgradeCopyResult {
	added: string[];
	updated: string[];
	preserved: string[];
}

function createUpgradeCopyResult(): UpgradeCopyResult {
	return {
		added: [],
		updated: [],
		preserved: [],
	};
}

function copyDirPreserveExisting(
	src: string,
	dest: string,
	manifest: TemplateManifest | null,
	opencodeDir: string,
	basePath = "",
): UpgradeCopyResult {
	const result = createUpgradeCopyResult();

	const entries = readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);

		if (entry.isDirectory()) {
			if (!existsSync(destPath)) {
				mkdirSync(destPath, { recursive: true });
			}

			const subResult = copyDirPreserveExisting(
				srcPath,
				destPath,
				manifest,
				opencodeDir,
				join(basePath, entry.name),
			);
			result.added.push(...subResult.added);
			result.updated.push(...subResult.updated);
			result.preserved.push(...subResult.preserved);
			continue;
		}

		const relativePath = join(basePath, entry.name);
		if (!existsSync(destPath)) {
			copyFileSync(srcPath, destPath);
			result.added.push(relativePath);
			continue;
		}

		const status = fileModificationStatus(destPath, relativePath, manifest);
		if (status === "unmodified") {
			copyFileSync(srcPath, destPath);
			result.updated.push(relativePath);
			continue;
		}

		const patchMeta = loadPatchMetadata(opencodeDir);
		if (patchMeta.patches[relativePath]) {
			copyFileSync(srcPath, destPath);
			result.updated.push(relativePath);
			continue;
		}

		result.preserved.push(relativePath);
	}

	return result;
}

export function copyDirWithPreserve(
	src: string,
	dest: string,
	preserveFiles: readonly string[],
	preserveDirs: readonly string[],
	manifest: TemplateManifest | null,
	basePath = "",
): UpgradeCopyResult {
	const result = createUpgradeCopyResult();

	if (!existsSync(dest)) {
		mkdirSync(dest, { recursive: true });
	}

	const entries = readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		if (SKIP_DIRS.includes(entry.name as (typeof SKIP_DIRS)[number])) {
			continue;
		}

		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);

		if (entry.isDirectory()) {
			if (shouldUsePreserveDirStrategy(entry.name, basePath, preserveDirs)) {
				if (!existsSync(destPath)) {
					mkdirSync(destPath, { recursive: true });
				}

				const subResult = copyDirPreserveExisting(
					srcPath,
					destPath,
					manifest,
					dest,
					entry.name,
				);
				result.added.push(...subResult.added);
				result.updated.push(...subResult.updated);
				result.preserved.push(...subResult.preserved);
				continue;
			}

			const subResult = copyDirWithPreserve(
				srcPath,
				destPath,
				preserveFiles,
				preserveDirs,
				manifest,
				join(basePath, entry.name),
			);
			result.added.push(...subResult.added);
			result.updated.push(...subResult.updated);
			result.preserved.push(...subResult.preserved);
			continue;
		}

		const relativePath = join(basePath, entry.name);
		if (
			shouldPreserveUpgradeFile(entry.name, relativePath, preserveFiles) &&
			existsSync(destPath)
		) {
			result.preserved.push(relativePath);
			continue;
		}

		if (!existsSync(destPath)) {
			result.added.push(relativePath);
		} else {
			result.updated.push(relativePath);
		}

		copyFileSync(srcPath, destPath);
	}

	return result;
}
