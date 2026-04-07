import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import color from "picocolors";
import { requireOpencodePath, showError } from "../utils/errors.js";
import {
	fileModificationStatus,
	generateManifest,
	loadManifest,
	MANIFEST_FILE,
	type TemplateManifest,
} from "../utils/manifest.js";
import { applyAllPatches, loadPatchMetadata } from "../utils/patch.js";
import {
	parseOptions,
	type UpgradeOptions,
	UpgradeOptionsSchema,
} from "../utils/schemas.js";

// Files that should be preserved during upgrade (user customizations)
const PRESERVE_FILES = [
	"opencode.json", // User config
	".env", // Secrets (should not be here but just in case)
];

// Directories where user files should be preserved
// We generally assume these are user-owned or hybrid
const PRESERVE_DIRS = [
	"agent", // User-created agents
	"command", // User-created commands
	"context", // User project context files
	"memory", // User memory files
	"skill", // Hybrid (system + user skills)
	"tool", // Hybrid (system + user tools)
];

// Directories to skip entirely during upgrade
const SKIP_DIRS = ["node_modules", ".git", "dist", "coverage"];

interface VersionInfo {
	current: string | null;
	latest: string | null;
	needsUpdate: boolean;
}

function getTemplateRoot(): string | null {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const possiblePaths = [
		join(__dirname, "template"),
		join(__dirname, "..", "..", ".opencode"),
	];

	for (const path of possiblePaths) {
		const opencodeDir = join(path, ".opencode");
		if (existsSync(opencodeDir)) {
			return path;
		}
	}

	return null;
}

function getCurrentVersion(opencodeDir: string): string | null {
	const versionFile = join(opencodeDir, ".version");
	if (existsSync(versionFile)) {
		return readFileSync(versionFile, "utf-8").trim();
	}
	return null;
}

function getPackageVersion(): string {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	// Try to read from package.json
	const pkgPaths = [
		join(__dirname, "..", "..", "package.json"),
		join(__dirname, "..", "package.json"),
	];

	for (const pkgPath of pkgPaths) {
		if (existsSync(pkgPath)) {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			return pkg.version;
		}
	}

	return "unknown";
}

async function checkVersion(opencodeDir: string): Promise<VersionInfo> {
	const current = getCurrentVersion(opencodeDir);
	const latest = getPackageVersion();

	return {
		current,
		latest,
		needsUpdate: current !== latest,
	};
}

export function copyDirWithPreserve(
	src: string,
	dest: string,
	preserveFiles: string[],
	preserveDirs: string[],
	manifest: TemplateManifest | null,
	basePath = "",
): {
	added: string[];
	updated: string[];
	preserved: string[];
} {
	const added: string[] = [];
	const updated: string[] = [];
	const preserved: string[] = [];

	if (!existsSync(dest)) {
		mkdirSync(dest, { recursive: true });
	}

	const entries = readdirSync(src, { withFileTypes: true });

	for (const entry of entries) {
		if (SKIP_DIRS.includes(entry.name)) continue;

		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);

		if (entry.isDirectory()) {
			// Check if this is a preserve directory
			if (preserveDirs.includes(entry.name)) {
				// Only copy new files, don't overwrite existing
				if (!existsSync(destPath)) {
					mkdirSync(destPath, { recursive: true });
				}
				// dest is the opencodeDir (top-level .opencode/)
				const subResult = copyDirPreserveExisting(
					srcPath,
					destPath,
					manifest,
					dest,
					entry.name,
				);
				added.push(...subResult.added);
				updated.push(...subResult.updated);
				preserved.push(...subResult.preserved);
			} else {
				// Normal copy for non-preserve directories
				const subResult = copyDirWithPreserve(
					srcPath,
					destPath,
					[],
					[],
					manifest,
					join(basePath, entry.name),
				);
				added.push(...subResult.added);
				updated.push(...subResult.updated);
				preserved.push(...subResult.preserved);
			}
		} else {
			const relativePath = join(basePath, entry.name);
			// Check if this file should be preserved
			if (preserveFiles.includes(entry.name) && existsSync(destPath)) {
				preserved.push(relativePath);
			} else {
				if (!existsSync(destPath)) {
					added.push(relativePath);
				} else {
					updated.push(relativePath);
				}
				copyFileSync(srcPath, destPath);
			}
		}
	}

	return { added, updated, preserved };
}

function copyDirPreserveExisting(
	src: string,
	dest: string,
	manifest: TemplateManifest | null,
	opencodeDir: string,
	basePath = "",
): {
	added: string[];
	updated: string[];
	preserved: string[];
} {
	const added: string[] = [];
	const updated: string[] = [];
	const preserved: string[] = [];

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
			added.push(...subResult.added);
			updated.push(...subResult.updated);
			preserved.push(...subResult.preserved);
		} else {
			const relativePath = join(basePath, entry.name);
			if (!existsSync(destPath)) {
				copyFileSync(srcPath, destPath);
				added.push(relativePath);
			} else {
				const status = fileModificationStatus(destPath, relativePath, manifest);
				if (status === "unmodified") {
					copyFileSync(srcPath, destPath);
					updated.push(relativePath);
				} else {
					// File was modified by user.
					// Check if a patch already exists — if so, overwrite and
					// let applyAllPatches reapply it (existing patches have
					// the correct diff base from when they were created).
					const patchMeta = loadPatchMetadata(opencodeDir);
					if (patchMeta.patches[relativePath]) {
						copyFileSync(srcPath, destPath);
						updated.push(relativePath);
					} else {
						// No existing patch — preserve user's version.
						// We can't auto-create a correct patch because we'd
						// need the old template content as diff base, but the
						// manifest only stores hashes, not content.
						preserved.push(relativePath);
					}
				}
			}
		}
	}

	return { added, updated, preserved };
}

function getAllFiles(dir: string, base = ""): string[] {
	const files: string[] = [];
	const entries = readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		if (SKIP_DIRS.includes(entry.name)) continue;
		const relativePath = join(base, entry.name);
		const fullPath = join(dir, entry.name);

		if (entry.isDirectory()) {
			files.push(...getAllFiles(fullPath, relativePath));
		} else {
			files.push(relativePath);
		}
	}

	return files;
}

export function findUpgradeOrphans(
	installedFiles: string[],
	templateFiles: string[],
): string[] {
	return installedFiles.filter((file) => {
		if (file === ".version") return false;
		if (file === MANIFEST_FILE) return false;
		if (PRESERVE_FILES.includes(file)) return false;
		if (file === ".env" || file.endsWith(".env")) return false;

		return !templateFiles.includes(file);
	});
}

export async function upgradeCommand(rawOptions: Partial<UpgradeOptions> = {}) {
	const options = parseOptions(UpgradeOptionsSchema, rawOptions);

	if (process.argv.includes("--quiet")) return;

	const opencodeDir = requireOpencodePath();

	if (!opencodeDir) {
		return;
	}

	const manifest = loadManifest(opencodeDir);

	p.intro(color.bgCyan(color.black(" Upgrade ")));

	// Check versions
	const versionInfo = await checkVersion(opencodeDir);

	console.log();
	console.log(
		`  ${color.bold("Installed")}  ${color.cyan(versionInfo.current || "unknown")}`,
	);
	console.log(
		`  ${color.bold("Latest")}     ${color.cyan(versionInfo.latest || "unknown")}`,
	);
	console.log();

	// Check-only mode
	if (options.check) {
		if (versionInfo.needsUpdate) {
			p.log.info(`Update available: ${color.cyan(versionInfo.latest)}`);
			p.outro(`Run ${color.cyan("ock upgrade")} to update`);
		} else {
			p.outro(color.green("Already up to date"));
		}
		return;
	}

	// Already up to date
	if (!versionInfo.needsUpdate && !options.force) {
		p.outro(color.green("Already up to date"));
		return;
	}

	// Find template
	const templateRoot = getTemplateRoot();
	if (!templateRoot) {
		showError("Template not found", "Reinstall opencodekit");
		return;
	}

	const templateOpencode = join(templateRoot, ".opencode");
	if (!existsSync(templateOpencode)) {
		showError("Template .opencode not found");
		return;
	}

	// Confirm upgrade
	if (!options.force) {
		const confirm = await p.confirm({
			message: `Upgrade to ${versionInfo.latest}?`,
		});

		if (p.isCancel(confirm) || !confirm) {
			p.cancel("Cancelled");
			return;
		}
	}

	// Perform upgrade
	const s = p.spinner();
	s.start("Upgrading");

	const result = copyDirWithPreserve(
		templateOpencode,
		opencodeDir,
		PRESERVE_FILES,
		PRESERVE_DIRS,
		manifest,
	);

	// Update version file
	if (versionInfo.latest) {
		writeFileSync(join(opencodeDir, ".version"), versionInfo.latest);
		// Regenerate manifest from upgraded template baseline (before reapplying user patches)
		generateManifest(opencodeDir, versionInfo.latest);
	}

	s.stop("Done");

	// Apply patches (user modifications to template files)
	const patchMetadata = loadPatchMetadata(opencodeDir);
	const patchCount = Object.keys(patchMetadata.patches).length;
	let patchResults: { success: number; conflicts: number } = {
		success: 0,
		conflicts: 0,
	};

	if (patchCount > 0) {
		const ps = p.spinner();
		ps.start(`Reapplying ${patchCount} patches`);

		const results = applyAllPatches(opencodeDir);
		patchResults = {
			success: results.filter((r) => r.success).length,
			conflicts: results.filter((r) => r.conflict).length,
		};

		ps.stop("Patches applied");

		if (patchResults.conflicts > 0) {
			p.log.warn(
				`${patchResults.conflicts} patch conflicts (see .opencode/patches/*.rej files)`,
			);
		}
	}

	// Summary
	if (result.updated.length > 0) {
		p.log.success(`Updated ${result.updated.length} files`);
	}

	if (result.added.length > 0) {
		p.log.success(`Added ${result.added.length} files`);
	}

	if (result.preserved.length > 0) {
		p.log.info(`Preserved ${result.preserved.length} user files`);
		p.log.info(
			color.dim(
				"  Tip: Run 'ock patch create <file>' to save customizations as reapplyable patches",
			),
		);
	}

	if (patchResults.success > 0) {
		p.log.success(`Reapplied ${patchResults.success} patches`);
	}

	// Cleanup orphans (files in destination that are not in template)
	// We only check directories that are NOT strictly user-owned to be safe,
	// or we check everything but respect PRESERVE_DIRS logic?
	// Actually, simpler: Find files in .opencode that are NOT in template.
	// Ask user to delete them.

	const installedFiles = getAllFiles(opencodeDir);
	const templateFiles = getAllFiles(templateOpencode);

	// Find orphans: files present in installed but not in template
	// Filter out files in PRESERVE_DIRS/PRESERVE_FILES as "safe to keep" usually?
	// No, if I have tool/old-tool.ts and template removed it, it's an orphan.
	// But if it's tool/my-custom-tool.ts, it's also an orphan.
	// We must ask the user.

	const orphans = findUpgradeOrphans(installedFiles, templateFiles);

	if (orphans.length > 0) {
		p.log.info(
			`${color.yellow(orphans.length.toString())} files found that are not in the template (orphans).`,
		);

		if (options.pruneAll) {
			// Auto-delete all
			const s = p.spinner();
			s.start("Pruning orphans");
			for (const orphan of orphans) {
				rmSync(join(opencodeDir, orphan));
			}
			s.stop(`Removed ${orphans.length} files`);
		} else if (options.prune) {
			// Manual selection via multiselect
			const selected = await p.multiselect({
				message: "Select files to delete",
				options: orphans.map((o) => ({ value: o, label: o })),
				required: false,
			});

			if (!p.isCancel(selected) && selected.length > 0) {
				const s = p.spinner();
				s.start("Deleting files");
				for (const file of selected as string[]) {
					rmSync(join(opencodeDir, file));
				}
				s.stop(`Deleted ${selected.length} files`);
			}
		} else {
			// No flag - just inform user
			p.log.info(
				`Run with ${color.cyan("--prune")} to select files or ${color.cyan("--prune-all")} to delete all`,
			);
		}
	}

	// Install dependencies
	if (existsSync(join(opencodeDir, "package.json"))) {
		const installSpinner = p.spinner();
		installSpinner.start("Installing dependencies");
		try {
			const { execSync } = await import("node:child_process");
			execSync("npm install --no-fund --no-audit", {
				cwd: opencodeDir,
				stdio: "ignore",
			});
			installSpinner.stop("Dependencies installed");
		} catch {
			installSpinner.stop(
				"Failed to install (run manually: cd .opencode && npm install)",
			);
		}
	}

	p.outro(color.green(`Upgraded to ${versionInfo.latest}`));
}
