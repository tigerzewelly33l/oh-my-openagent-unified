import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXCLUDED_DIRS, SHARED_CONFIG_DIRS } from "./constants.js";

export interface GlobalConfigInfo {
	dir: string;
	coveredDirs: string[];
}

export type InitMode = "scaffold" | "add-config" | "already-initialized";

/**
 * Get the global OpenCode config directory based on OS.
 * - macOS/Linux: ~/.config/opencode/ (respects XDG_CONFIG_HOME)
 * - Windows: %APPDATA%\opencode\ or %LOCALAPPDATA%\opencode\
 */
export function getGlobalConfigDir(): string {
	const os = platform();

	if (os === "win32") {
		const appData =
			process.env.APPDATA ||
			process.env.LOCALAPPDATA ||
			join(homedir(), "AppData", "Roaming");
		return join(appData, "opencode");
	}

	const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	return join(xdgConfig, "opencode");
}

/**
 * Detect if global config has any of the shared dirs populated.
 * Returns null if no global config or no shared dirs found.
 */
export function detectGlobalConfig(): GlobalConfigInfo | null {
	const globalDir = getGlobalConfigDir();
	if (!existsSync(globalDir)) return null;

	const coveredDirs = SHARED_CONFIG_DIRS.filter((dirName) => {
		const dirPath = join(globalDir, dirName);
		if (!existsSync(dirPath)) return false;
		try {
			const entries = readdirSync(dirPath).filter((entry) => !entry.startsWith("."));
			return entries.length > 0;
		} catch {
			return false;
		}
	});

	if (coveredDirs.length === 0) return null;
	return { dir: globalDir, coveredDirs: [...coveredDirs] };
}

export function detectMode(targetDir: string): InitMode {
	const opencodeDir = join(targetDir, ".opencode");

	if (existsSync(opencodeDir)) {
		return "already-initialized";
	}

	if (existsSync(targetDir)) {
		const entries = readdirSync(targetDir);
		const hasCode = entries.some(
			(entry) =>
				!entry.startsWith(".") &&
				!EXCLUDED_DIRS.includes(entry as (typeof EXCLUDED_DIRS)[number]) &&
				entry !== "node_modules",
		);
		if (hasCode) {
			return "add-config";
		}
	}

	return "scaffold";
}

export function getTemplateRoot(): string | null {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const possiblePaths = [join(__dirname, "template"), join(__dirname, "..", "..", "..", ".opencode")];

	for (const candidatePath of possiblePaths) {
		const opencodeDir = join(candidatePath, ".opencode");
		if (existsSync(opencodeDir)) {
			return candidatePath;
		}
	}

	return null;
}

export function getPackageVersion(): string {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const pkgPaths = [
		join(__dirname, "..", "..", "..", "package.json"),
		join(__dirname, "..", "..", "package.json"),
	];

	for (const pkgPath of pkgPaths) {
		if (!existsSync(pkgPath)) continue;
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		return pkg.version;
	}

	return "unknown";
}
