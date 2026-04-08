import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import { MANIFEST_FILE } from "../../utils/manifest.js";
import type { UpgradeOptions } from "../../utils/schemas.js";
import { PRESERVE_FILES, SKIP_DIRS } from "./constants.js";

function shouldIgnoreUpgradeOrphan(file: string): boolean {
	if (file === ".version") return true;
	if (file === MANIFEST_FILE) return true;
	if (PRESERVE_FILES.includes(file as (typeof PRESERVE_FILES)[number])) return true;
	if (file === ".env" || file.endsWith(".env")) return true;

	return false;
}

function getAllFiles(dir: string, base = ""): string[] {
	const files: string[] = [];
	const entries = readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		if (SKIP_DIRS.includes(entry.name as (typeof SKIP_DIRS)[number])) {
			continue;
		}

		const relativePath = join(base, entry.name);
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...getAllFiles(fullPath, relativePath));
			continue;
		}

		files.push(relativePath);
	}

	return files;
}

export function findUpgradeOrphans(
	installedFiles: string[],
	templateFiles: string[],
): string[] {
	return installedFiles.filter((file) => {
		if (shouldIgnoreUpgradeOrphan(file)) {
			return false;
		}

		return !templateFiles.includes(file);
	});
}

export async function handleUpgradeOrphans(
	opencodeDir: string,
	templateOpencode: string,
	options: Pick<UpgradeOptions, "prune" | "pruneAll">,
): Promise<void> {
	const installedFiles = getAllFiles(opencodeDir);
	const templateFiles = getAllFiles(templateOpencode);
	const orphans = findUpgradeOrphans(installedFiles, templateFiles);

	if (orphans.length === 0) {
		return;
	}

	p.log.info(
		`${color.yellow(orphans.length.toString())} files found that are not in the template (orphans).`,
	);

	if (options.pruneAll) {
		const spinner = p.spinner();
		spinner.start("Pruning orphans");
		for (const orphan of orphans) {
			rmSync(join(opencodeDir, orphan));
		}
		spinner.stop(`Removed ${orphans.length} files`);
		return;
	}

	if (options.prune) {
		const selected = await p.multiselect({
			message: "Select files to delete",
			options: orphans.map((orphan) => ({ value: orphan, label: orphan })),
			required: false,
		});

		if (!p.isCancel(selected) && selected.length > 0) {
			const spinner = p.spinner();
			spinner.start("Deleting files");
			for (const file of selected as string[]) {
				rmSync(join(opencodeDir, file));
			}
			spinner.stop(`Deleted ${selected.length} files`);
		}
		return;
	}

	p.log.info(
		`Run with ${color.cyan("--prune")} to select files or ${color.cyan("--prune-all")} to delete all`,
	);
}
