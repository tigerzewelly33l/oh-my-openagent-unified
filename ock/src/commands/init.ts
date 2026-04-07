import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { homedir, platform } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import color from "picocolors";
import { generateManifest, MANIFEST_FILE } from "../utils/manifest.js";
import { savePatch } from "../utils/patch.js";
import {
	type InitOptions,
	InitOptionsSchema,
	parseOptions,
} from "../utils/schemas.js";

const EXCLUDED_DIRS = [
	"node_modules",
	".git",
	"dist",
	".DS_Store",
	"coverage",
	".next",
	".turbo",
];
const EXCLUDED_FILES = [
	"bun.lock",
	"package-lock.json",
	"yarn.lock",
	"pnpm-lock.yaml",
];

// Directories within .opencode/ whose existing files should be preserved during reinit.
// These contain user-specific content that should not be overwritten by template defaults.
const PRESERVE_USER_DIRS = [
	"memory/project", // User's project-specific memory (user.md, tech-stack.md, etc.)
	"context", // User's project context files for AI prompt injection
];

// Dirs that can be provided by global config (shared across projects).
// If these exist at ~/.config/opencode/, they can be skipped during local init.
const SHARED_CONFIG_DIRS = ["agent", "command", "skill", "tool"];

interface GlobalConfigInfo {
	dir: string;
	coveredDirs: string[]; // Which of SHARED_CONFIG_DIRS exist in global config
}

/**
 * Detect if global config has any of the shared dirs populated.
 * Returns null if no global config or no shared dirs found.
 */
function detectGlobalConfig(): GlobalConfigInfo | null {
	const globalDir = getGlobalConfigDir();
	if (!existsSync(globalDir)) return null;

	const coveredDirs = SHARED_CONFIG_DIRS.filter((d) => {
		const dirPath = join(globalDir, d);
		if (!existsSync(dirPath)) return false;
		try {
			const entries = readdirSync(dirPath).filter((e) => !e.startsWith("."));
			return entries.length > 0;
		} catch {
			return false;
		}
	});

	if (coveredDirs.length === 0) return null;
	return { dir: globalDir, coveredDirs };
}

/**
 * Get the global OpenCode config directory based on OS.
 * - macOS/Linux: ~/.config/opencode/ (respects XDG_CONFIG_HOME)
 * - Windows: %APPDATA%\opencode\ or %LOCALAPPDATA%\opencode\
 */
function getGlobalConfigDir(): string {
	const os = platform();

	if (os === "win32") {
		// Windows: prefer APPDATA, fallback to LOCALAPPDATA, then home
		const appData =
			process.env.APPDATA ||
			process.env.LOCALAPPDATA ||
			join(homedir(), "AppData", "Roaming");
		return join(appData, "opencode");
	}

	// macOS/Linux: respect XDG_CONFIG_HOME, fallback to ~/.config
	const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
	return join(xdgConfig, "opencode");
}

type InitMode = "scaffold" | "add-config" | "already-initialized";

function detectMode(targetDir: string): InitMode {
	const opencodeDir = join(targetDir, ".opencode");

	if (existsSync(opencodeDir)) {
		return "already-initialized";
	}

	if (existsSync(targetDir)) {
		const entries = readdirSync(targetDir);
		const hasCode = entries.some(
			(e) =>
				!e.startsWith(".") &&
				!EXCLUDED_DIRS.includes(e) &&
				e !== "node_modules",
		);
		if (hasCode) {
			return "add-config";
		}
	}

	return "scaffold";
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

function getPackageVersion(): string {
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = dirname(__filename);

	const pkgPaths = [
		join(__dirname, "..", "..", "package.json"),
		join(__dirname, "..", "package.json"),
	];

	for (const pkgPath of pkgPaths) {
		if (!existsSync(pkgPath)) continue;
		const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
		return pkg.version;
	}

	return "unknown";
}

async function copyDir(src: string, dest: string): Promise<void> {
	const { mkdir, readdir } = await import("node:fs/promises");

	await mkdir(dest, { recursive: true });

	for (const entry of await readdir(src, { withFileTypes: true })) {
		if (EXCLUDED_DIRS.includes(entry.name)) continue;
		if (!entry.isDirectory() && EXCLUDED_FILES.includes(entry.name)) continue;

		const srcPath = join(src, entry.name);
		const destPath = join(dest, entry.name);

		if (entry.isSymbolicLink()) {
			// Skip symlinks
		} else if (entry.isDirectory()) {
			await copyDir(srcPath, destPath);
		} else {
			const content = readFileSync(srcPath, "utf-8");
			writeFileSync(destPath, content);
		}
	}
}

async function copyOpenCodeOnly(
	templateRoot: string,
	targetDir: string,
	skipDirs?: string[],
): Promise<boolean> {
	const opencodeSrc = join(templateRoot, ".opencode");
	const opencodeDest = join(targetDir, ".opencode");

	if (!existsSync(opencodeSrc)) {
		return false;
	}

	// If skipDirs specified, copy selectively (skip top-level dirs in global config)
	if (skipDirs && skipDirs.length > 0) {
		const skipSet = new Set(skipDirs);
		mkdirSync(opencodeDest, { recursive: true });

		for (const entry of readdirSync(opencodeSrc, { withFileTypes: true })) {
			if (EXCLUDED_DIRS.includes(entry.name)) continue;
			if (!entry.isDirectory() && EXCLUDED_FILES.includes(entry.name)) continue;
			if (entry.isSymbolicLink()) continue;

			// Skip dirs that exist in global config
			if (entry.isDirectory() && skipSet.has(entry.name)) continue;

			const srcPath = join(opencodeSrc, entry.name);
			const destPath = join(opencodeDest, entry.name);

			if (entry.isDirectory()) {
				await copyDir(srcPath, destPath);
			} else {
				writeFileSync(destPath, readFileSync(srcPath, "utf-8"));
			}
		}

		return true;
	}

	await copyDir(opencodeSrc, opencodeDest);
	return true;
}

type ModelPreset = "free" | "recommend";

const MODEL_PRESETS: Record<
	ModelPreset,
	{ model: string; agents: Record<string, string> }
> = {
	free: {
		model: "opencode/glm-5-free",
		agents: {
			build: "opencode/minimax-m2.5-free",
			plan: "opencode/minimax-m2.5-free",
			review: "opencode/minimax-m2.5-free",
			explore: "opencode/glm-5-free",
			general: "opencode/glm-5-free",
			vision: "opencode/minimax-m2.5-free",
			scout: "opencode/glm-5-free",
			painter: "opencode/minimax-m2.5-free",
		},
	},
	recommend: {
		model: "github-copilot/gpt-5.4",
		agents: {
			build: "github-copilot/claude-opus-4.6",
			plan: "github-copilot/gpt-5.4",
			review: "github-copilot/claude-opus-4.6",
			explore: "github-copilot/claude-haiku-4.5",
			general: "github-copilot/gpt-5.3-codex",
			vision: "github-copilot/gemini-3.1-pro-preview",
			scout: "github-copilot/claude-sonnet-4.6",
			painter: "proxypal/gemini-3.1-flash-image",
		},
	},
};

function applyModelPreset(targetDir: string, preset: ModelPreset): void {
	const configPath = join(targetDir, ".opencode", "opencode.json");
	if (!existsSync(configPath)) return;

	const config = JSON.parse(readFileSync(configPath, "utf-8"));
	const presetConfig = MODEL_PRESETS[preset];

	// Set root model
	config.model = presetConfig.model;

	// Set agent models
	if (config.agent) {
		for (const [agentName, model] of Object.entries(presetConfig.agents)) {
			if (config.agent[agentName]) {
				config.agent[agentName].model = model;
			}
		}
	}

	writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const AGENT_DESCRIPTIONS: Record<string, string> = {
	build: "Main coding agent (complex tasks)",
	plan: "Planning and design agent",
	review: "Code review and debugging",
	explore: "Fast codebase search",
	general: "Quick, simple tasks",
	painter: "Image generation and editing",
	vision: "Visual analysis (quality)",
	scout: "External research/docs",
	compaction: "Context summarization",
};

async function promptCustomModels(targetDir: string): Promise<void> {
	const configPath = join(targetDir, ".opencode", "opencode.json");
	if (!existsSync(configPath)) return;

	const config = JSON.parse(readFileSync(configPath, "utf-8"));

	p.log.info(
		color.dim(
			"Enter model IDs (e.g., github-copilot/gpt-5.4, proxypal/gemini-3.1-flash-image)",
		),
	);
	p.log.info(color.dim("Press Enter to keep current value\n"));

	// Prompt for main model
	const mainModel = await p.text({
		message: "Main session model",
		placeholder: config.model || "github-copilot/gpt-5.4",
		defaultValue: config.model,
	});

	if (p.isCancel(mainModel)) {
		p.log.warn("Cancelled - keeping defaults");
		return;
	}

	if (mainModel) {
		config.model = mainModel;
	}

	// Prompt for each agent
	const agents = Object.keys(AGENT_DESCRIPTIONS);
	for (const agent of agents) {
		if (!config.agent?.[agent]) continue;

		const currentModel = config.agent[agent].model || config.model;
		const agentModel = await p.text({
			message: `${agent} - ${AGENT_DESCRIPTIONS[agent]}`,
			placeholder: currentModel,
			defaultValue: currentModel,
		});

		if (p.isCancel(agentModel)) {
			p.log.warn("Cancelled - saving partial config");
			break;
		}

		if (agentModel) {
			config.agent[agent].model = agentModel;
		}
	}

	writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getAffectedFiles(dir: string, prefix = ""): string[] {
	if (!existsSync(dir)) return [];

	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (EXCLUDED_DIRS.includes(entry.name)) continue;
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;
		if (entry.isDirectory()) {
			files.push(...getAffectedFiles(join(dir, entry.name), path));
		} else {
			files.push(path);
		}
	}
	return files;
}

function backupOpenCode(targetDir: string): string | null {
	const opencodeDir = join(targetDir, ".opencode");
	if (!existsSync(opencodeDir)) return null;

	const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const backupDir = join(targetDir, `.opencode.bak-${timestamp}`);
	renameSync(opencodeDir, backupDir);
	return backupDir;
}

function getTemplateFiles(templateRoot: string): Set<string> {
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
	return existingFiles.filter(
		(f) => f !== MANIFEST_FILE && !templateFiles.has(f),
	);
}

/**
 * Check if an orphan file is a modified template file (exists in template but content differs).
 * Returns the template content if it's a modified template file, null otherwise.
 */
function getModifiedTemplateContent(
	templateRoot: string,
	orphanPath: string,
): string | null {
	const templateFilePath = join(templateRoot, ".opencode", orphanPath);
	if (!existsSync(templateFilePath)) return null;
	return readFileSync(templateFilePath, "utf-8");
}

/**
 * Auto-detect and save patches for modified template files among orphans.
 * Returns the list of orphans that were NOT saved as patches (true orphans).
 */
async function autoSavePatchesForOrphans(
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
			// Not a template file, it's a true orphan
			trueOrphans.push(orphan);
			continue;
		}

		// It's a template file - check if content differs
		const userFilePath = join(opencodeDir, orphan);
		const userContent = readFileSync(userFilePath, "utf-8");

		if (templateContent === userContent) {
			// No modifications, treat as true orphan (will be replaced by template)
			trueOrphans.push(orphan);
			continue;
		}

		// Has modifications - save as patch
		try {
			savePatch(opencodeDir, orphan, templateContent, userContent);
			savedPatches.push(orphan);
		} catch {
			// If patch save fails, treat as true orphan
			trueOrphans.push(orphan);
		}
	}

	return { savedPatches, trueOrphans };
}

/**
 * Save existing user files from preserve directories before reinit.
 * Returns a map of relative paths to file contents.
 */
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

/**
 * Restore preserved user files after fresh template copy.
 */
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

export async function initCommand(rawOptions: Partial<InitOptions> = {}) {
	const options = parseOptions(InitOptionsSchema, rawOptions);

	if (process.argv.includes("--quiet")) return;

	p.intro(color.bgCyan(color.black(" OpenCodeKit ")));

	// Handle global installation
	if (options.global) {
		const globalDir = getGlobalConfigDir();
		const os = platform();
		const osName =
			os === "win32" ? "Windows" : os === "darwin" ? "macOS" : "Linux";

		p.log.info(`Installing to global config (${osName})`);
		p.log.info(`Target: ${color.cyan(globalDir)}`);

		// Find template
		const templateRoot = getTemplateRoot();
		if (!templateRoot) {
			p.log.error("Template not found. Please reinstall opencodekit.");
			p.outro(color.red("Failed"));
			process.exit(1);
		}

		// Check if already exists
		if (existsSync(globalDir) && !options.force) {
			p.log.warn(`Global config already exists at ${globalDir}`);
			p.log.info(`Use ${color.cyan("--force")} to overwrite`);
			p.outro("Nothing to do");
			return;
		}

		const s = p.spinner();
		s.start("Copying to global config");

		// Copy .opencode contents directly to global dir (not nested)
		const opencodeSrc = join(templateRoot, ".opencode");
		if (!existsSync(opencodeSrc)) {
			s.stop("Failed");
			p.log.error("Template .opencode/ not found");
			p.outro(color.red("Failed"));
			process.exit(1);
		}

		await copyDir(opencodeSrc, globalDir);
		s.stop("Done");

		p.note(
			`Global config installed at:\n${globalDir}\n\nThis provides default agents, skills, and tools\nfor all OpenCode projects on this machine.`,
			"Global Installation Complete",
		);

		p.outro(color.green("Ready!"));
		return;
	}

	// Local installation (existing behavior)
	const targetDir = process.cwd();
	const mode = detectMode(targetDir);

	// Handle already initialized
	if (mode === "already-initialized" && !options.force) {
		p.log.warn("Already initialized (.opencode/ exists)");
		p.log.info(`Use ${color.cyan("--force")} to reinitialize`);
		p.outro("Nothing to do");
		return;
	}

	// Show affected files when using --force
	let preservedFiles: Map<string, string> | undefined;
	if (mode === "already-initialized" && options.force) {
		const opencodeDir = join(targetDir, ".opencode");
		const affected = getAffectedFiles(opencodeDir);

		if (affected.length > 0 && !options.yes) {
			p.log.warn(`${affected.length} files will be overwritten:`);
			const preview = affected.slice(0, 10);
			for (const file of preview) {
				p.log.info(color.dim(`  .opencode/${file}`));
			}
			if (affected.length > 10) {
				p.log.info(color.dim(`  ... and ${affected.length - 10} more`));
			}

			// Interactive backup prompt if --backup not specified
			if (!options.backup) {
				const shouldBackup = await p.confirm({
					message: "Backup existing .opencode before overwriting?",
					initialValue: true,
				});

				if (p.isCancel(shouldBackup)) {
					p.cancel("Cancelled");
					process.exit(0);
				}

				if (shouldBackup) {
					options.backup = true;
				}
			}

			const proceed = await p.confirm({
				message: options.backup
					? "Proceed? (existing config will be backed up)"
					: "Proceed without backup?",
				initialValue: options.backup,
			});

			if (p.isCancel(proceed) || !proceed) {
				p.cancel("Cancelled");
				process.exit(0);
			}
		}

		// Backup if requested
		if (options.backup) {
			// Save user files before backup renames the directory
			preservedFiles = preserveUserFiles(targetDir);
			const backupPath = backupOpenCode(targetDir);
			if (backupPath) {
				p.log.info(`Backed up to ${color.cyan(basename(backupPath))}`);
			}
		} else {
			// Save user files before overwrite
			preservedFiles = preserveUserFiles(targetDir);
		}
	}

	// Find template
	const templateRoot = getTemplateRoot();
	if (!templateRoot) {
		p.log.error("Template not found. Please reinstall opencodekit.");
		p.outro(color.red("Failed"));
		process.exit(1);
	}

	let projectName = basename(targetDir);

	// Scaffold mode: prompt for project name
	if (mode === "scaffold") {
		const name = await p.text({
			message: "Project name",
			placeholder: projectName,
			defaultValue: projectName,
		});

		if (p.isCancel(name)) {
			p.cancel("Cancelled");
			process.exit(0);
		}

		projectName = name || projectName;
	}

	// Detect global config overlap — skip shared dirs if available globally
	let skipDirs: string[] = [];

	if (!options.global) {
		const globalConfig = detectGlobalConfig();

		if (globalConfig && options.projectOnly) {
			// --project-only flag: auto-skip without prompt
			skipDirs = globalConfig.coveredDirs;
			p.log.info(
				`Using global config from ${color.cyan(globalConfig.dir)}`,
			);
			p.log.info(
				`Skipping: ${skipDirs.map((d) => color.dim(d)).join(", ")}`,
			);
		} else if (globalConfig && !options.yes) {
			// Interactive: ask user if they want project-only init
			p.log.info(
				`Global config found at ${color.cyan(globalConfig.dir)}`,
			);
			p.log.info(
				`Available globally: ${globalConfig.coveredDirs.map((d) => color.green(d)).join(", ")}`,
			);

			const useGlobal = await p.confirm({
				message:
					"Skip these (use global config)? Only project-scope files will be created locally.",
				initialValue: true,
			});

			if (!p.isCancel(useGlobal) && useGlobal) {
				skipDirs = globalConfig.coveredDirs;
			}
		} else if (globalConfig && options.yes) {
			// --yes mode: full copy, but log that global config exists
			p.log.info(
				`Global config found at ${color.cyan(globalConfig.dir)} — use ${color.bold("--project-only")} to skip shared dirs`,
			);
		}
	}

	// Execute
	const s = p.spinner();

	if (mode === "scaffold") {
		s.start("Scaffolding project");
		mkdirSync(targetDir, { recursive: true });
	} else if (mode === "add-config") {
		s.start("Adding OpenCodeKit");
	} else {
		s.start("Reinitializing");
	}

	const success = await copyOpenCodeOnly(templateRoot, targetDir, skipDirs);

	if (!success) {
		s.stop("Failed");
		p.outro(color.red("Template copy failed"));
		process.exit(1);
	}

	s.stop("Done");

	if (skipDirs.length > 0) {
		p.log.info(
			`Project-only init: skipped ${skipDirs.map((d) => color.dim(d)).join(", ")} (using global config)`,
		);
	}

	const restoredFileCount = finalizeInstalledFiles(
		targetDir,
		getPackageVersion(),
		preservedFiles,
	);

	if (restoredFileCount > 0) {
		p.log.info(
			`Preserved ${restoredFileCount} user memory files (memory/project/)`,
		);
	}

	// Apply model preset
	if (options.free) {
		applyModelPreset(targetDir, "free");
		p.log.info("Applied free model preset");
	} else if (options.recommend) {
		applyModelPreset(targetDir, "recommend");
		p.log.info("Applied recommended model preset");
	} else if (options.yes) {
		// CI mode: use free preset by default
		applyModelPreset(targetDir, "free");
		p.log.info("Applied free model preset (default)");
	} else {
		// Interactive preset picker
		const preset = await p.select({
			message: "Choose model preset",
			options: [
				{
					value: "free",
					label: "Free models",
					hint: "minimax, glm, grok (no API costs)",
				},
				{
					value: "recommend",
					label: "Recommended models",
					hint: "gpt-5.4, opus-4.6, sonnet-4.6, gemini-3.1",
				},
				{
					value: "custom",
					label: "Custom",
					hint: "configure each agent individually",
				},
				{
					value: "skip",
					label: "Skip",
					hint: "keep template defaults",
				},
			],
		});

		if (!p.isCancel(preset)) {
			if (preset === "custom") {
				await promptCustomModels(targetDir);
				p.log.info("Applied custom model configuration");
			} else if (preset !== "skip") {
				applyModelPreset(targetDir, preset as ModelPreset);
				p.log.info(`Applied ${preset} model preset`);
			}
		}
	}

	// Initialize beads if requested
	if (options.beads) {
		const beadsDir = join(targetDir, ".beads");
		if (!existsSync(beadsDir)) {
			const bs = p.spinner();
			bs.start("Initializing .beads/");
			try {
				// Try to use br init if available (beads_rust)
				execSync("br init", { cwd: targetDir, stdio: "ignore" });
				bs.stop("Beads initialized");
			} catch {
				// Fallback: create basic .beads structure manually
				mkdirSync(beadsDir, { recursive: true });
				writeFileSync(
					join(beadsDir, "config.yaml"),
					"# Beads configuration\nversion: 1\n",
				);
				writeFileSync(join(beadsDir, "issues.jsonl"), "");
				writeFileSync(
					join(beadsDir, "metadata.json"),
					JSON.stringify({ created: new Date().toISOString() }, null, 2),
				);
				bs.stop("Beads initialized (manual)");
			}
		} else {
			p.log.info(".beads/ already exists");
		}
	}

	// Install dependencies
	const opencodeDir = join(targetDir, ".opencode");
	if (existsSync(join(opencodeDir, "package.json"))) {
		const installSpinner = p.spinner();
		installSpinner.start("Installing dependencies");
		try {
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

	// Handle orphan files when reinitializing
	if (mode === "already-initialized" && options.force && !options.backup) {
		const templateFiles = getTemplateFiles(templateRoot);
		const orphans = findOrphans(targetDir, templateFiles);

		if (orphans.length > 0) {
			p.log.warn(`Found ${orphans.length} orphan files not in template`);

			// Auto-detect and save patches for modified template files
			const { savedPatches, trueOrphans } = await autoSavePatchesForOrphans(
				targetDir,
				templateRoot,
				orphans,
			);

			if (savedPatches.length > 0) {
				p.log.success(
					`Auto-saved ${savedPatches.length} patches for modified template files`,
				);
				for (const patch of savedPatches) {
					console.log(`  ${color.green("✓")} ${patch}`);
				}
				p.log.info(
					color.dim(
						"These patches will be reapplied after template files are updated.",
					),
				);
			}

			// Only process true orphans (not modified template files)
			if (trueOrphans.length === 0) {
				// All orphans were saved as patches, nothing to delete
			} else if (options.pruneAll) {
				// Auto-delete all true orphans
				const pruneSpinner = p.spinner();
				pruneSpinner.start("Removing orphan files");
				for (const orphan of trueOrphans) {
					rmSync(join(opencodeDir, orphan));
				}
				pruneSpinner.stop(`Removed ${trueOrphans.length} orphan files`);
			} else if (options.prune) {
				// Manual selection
				const selected = await p.multiselect({
					message: "Select orphan files to delete",
					options: trueOrphans.map((o) => ({ value: o, label: o })),
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
			} else if (!options.yes && trueOrphans.length > 0) {
				// Interactive orphan handling (only for true orphans)
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
						{
							value: "select",
							label: "Select",
							hint: "choose which to delete",
						},
						{
							value: "delete",
							label: "Delete all",
							hint: "remove all orphans",
						},
					],
				});

				if (!p.isCancel(orphanAction)) {
					if (orphanAction === "delete") {
						const pruneSpinner = p.spinner();
						pruneSpinner.start("Removing orphan files");
						for (const orphan of trueOrphans) {
							rmSync(join(opencodeDir, orphan));
						}
						pruneSpinner.stop(`Removed ${trueOrphans.length} orphan files`);
					} else if (orphanAction === "select") {
						const selected = await p.multiselect({
							message: "Select orphan files to delete",
							options: trueOrphans.map((o) => ({ value: o, label: o })),
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
			}
		}
	}

	p.outro(color.green("Ready to code!"));
}
