import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { EXCLUDED_DIRS, EXCLUDED_FILES } from "./constants.js";

export async function copyDir(src: string, dest: string): Promise<void> {
	const { mkdir, readdir } = await import("node:fs/promises");

	await mkdir(dest, { recursive: true });

	for (const entry of await readdir(src, { withFileTypes: true })) {
		if (EXCLUDED_DIRS.includes(entry.name as (typeof EXCLUDED_DIRS)[number])) {
			continue;
		}
		if (
			!entry.isDirectory() &&
			EXCLUDED_FILES.includes(entry.name as (typeof EXCLUDED_FILES)[number])
		) {
			continue;
		}

		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);

		if (entry.isSymbolicLink()) {
			continue;
		}

		if (entry.isDirectory()) {
			await copyDir(srcPath, destPath);
			continue;
		}

		const content = readFileSync(srcPath, "utf-8");
		writeFileSync(destPath, content);
	}
}

export async function copyOpenCodeOnly(
	templateRoot: string,
	targetDir: string,
	skipDirs: string[] = [],
): Promise<boolean> {
	const opencodeSrc = join(templateRoot, ".opencode");
	const opencodeDest = join(targetDir, ".opencode");

	if (!existsSync(opencodeSrc)) {
		return false;
	}

	if (skipDirs.length === 0) {
		await copyDir(opencodeSrc, opencodeDest);
		return true;
	}

	const skipSet = new Set(skipDirs);
	mkdirSync(opencodeDest, { recursive: true });

	for (const entry of readdirSync(opencodeSrc, { withFileTypes: true })) {
		if (EXCLUDED_DIRS.includes(entry.name as (typeof EXCLUDED_DIRS)[number])) {
			continue;
		}
		if (
			!entry.isDirectory() &&
			EXCLUDED_FILES.includes(entry.name as (typeof EXCLUDED_FILES)[number])
		) {
			continue;
		}
		if (entry.isSymbolicLink()) {
			continue;
		}
		if (entry.isDirectory() && skipSet.has(entry.name)) {
			continue;
		}

		const srcPath = join(opencodeSrc, entry.name);
		const destPath = join(opencodeDest, entry.name);

		if (entry.isDirectory()) {
			await copyDir(srcPath, destPath);
			continue;
		}

		writeFileSync(destPath, readFileSync(srcPath, "utf-8"));
	}

	return true;
}
