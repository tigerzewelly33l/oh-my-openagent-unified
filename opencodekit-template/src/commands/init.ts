import { existsSync } from "node:fs";
import { basename, join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import {
	type InitOptions,
	InitOptionsSchema,
	parseOptions,
} from "../utils/schemas.js";
import { copyDir, copyOpenCodeOnly } from "./init/files.js";
import { applyModelPreset, promptCustomModels, type ModelPreset } from "./init/models.js";
import {
	detectGlobalConfig,
	detectMode,
	getGlobalConfigDir,
	getPackageVersion,
	getTemplateRoot,
	type InitMode,
} from "./init/paths.js";
import {
	announceBackupResult,
	backupOpenCode,
	confirmForceReinitialize,
	finalizeInstalledFiles,
	findOrphans,
	getForceReinitializePreview,
	handleOrphanFiles,
	preserveUserFiles,
	promptForBackupPreference,
} from "./init/reinit.js";
import {
	describeGlobalInstallTarget,
	emitCanonicalBridgeArtifactsScaffold,
	ensureScaffoldDirectory,
	initializeBeads,
	installEmbeddedDependencies,
	logProjectOnlySkip,
	resolveProjectOnlySkipDirs,
	startInitSpinner,
} from "./init/runtime.js";

async function resolveProjectName(
	targetDir: string,
	mode: InitMode,
	yes: boolean,
): Promise<string> {
	let projectName = basename(targetDir);

	if (mode !== "scaffold" || yes) {
		return projectName;
	}

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
	return projectName;
}

async function maybePrepareReinitialize(
	targetDir: string,
	mode: InitMode,
	options: InitOptions,
): Promise<Map<string, string> | undefined> {
	if (mode !== "already-initialized" || !options.force) {
		return undefined;
	}

	const affected = getForceReinitializePreview(targetDir);

	if (affected.length > 0 && !options.yes) {
		const backupChoice = await promptForBackupPreference({ backup: options.backup });
		if (backupChoice === null) {
			process.exit(0);
		}
		options.backup = backupChoice;

		const confirmed = await confirmForceReinitialize(targetDir, {
			yes: options.yes,
			backup: options.backup,
		});
		if (!confirmed) {
			process.exit(0);
		}
	}

	const preservedFiles = preserveUserFiles(targetDir);
	if (options.backup) {
		const backupPath = backupOpenCode(targetDir);
		announceBackupResult(backupPath);
	}

	return preservedFiles;
}

async function installGlobalConfig(
	templateRoot: string,
	globalDir: string,
	options: InitOptions,
): Promise<void> {
	describeGlobalInstallTarget(globalDir);

	if (existsSync(globalDir) && !options.force) {
		p.log.warn(`Global config already exists at ${globalDir}`);
		p.log.info(`Use ${color.cyan("--force")} to overwrite`);
		p.outro("Nothing to do");
		return;
	}

	const spinner = p.spinner();
	spinner.start("Copying to global config");

	const opencodeSrc = join(templateRoot, ".opencode");
	if (!existsSync(opencodeSrc)) {
		spinner.stop("Failed");
		p.log.error("Template .opencode/ not found");
		p.outro(color.red("Failed"));
		process.exit(1);
	}

	await copyDir(opencodeSrc, globalDir);
	spinner.stop("Done");

	p.note(
		`Global config installed at:\n${globalDir}\n\nThis provides default agents, skills, and tools\nfor all OpenCode projects on this machine.`,
		"Global Installation Complete",
	);

	p.outro(color.green("Ready!"));
}

export { finalizeInstalledFiles, findOrphans, preserveUserFiles };

export async function initCommand(rawOptions: Partial<InitOptions> = {}) {
	const options = parseOptions(InitOptionsSchema, rawOptions);

	if (process.argv.includes("--quiet")) return;

	p.intro(color.bgCyan(color.black(" OpenCodeKit ")));

	const templateRoot = getTemplateRoot();
	if (!templateRoot) {
		p.log.error("Template not found. Please reinstall opencodekit.");
		p.outro(color.red("Failed"));
		process.exit(1);
	}

	if (options.global) {
		await installGlobalConfig(templateRoot, getGlobalConfigDir(), options);
		return;
	}

	const targetDir = process.cwd();
	const mode = detectMode(targetDir);

	if (mode === "already-initialized" && !options.force) {
		p.log.warn("Already initialized (.opencode/ exists)");
		p.log.info(`Use ${color.cyan("--force")} to reinitialize`);
		p.outro("Nothing to do");
		return;
	}

	const preservedFiles = await maybePrepareReinitialize(targetDir, mode, options);
	await resolveProjectName(targetDir, mode, options.yes);

	const skipDirs = await resolveProjectOnlySkipDirs(detectGlobalConfig(), {
		projectOnly: options.projectOnly,
		yes: options.yes,
	});

	const spinner = startInitSpinner(mode);
	ensureScaffoldDirectory(targetDir, mode);

	const success = await copyOpenCodeOnly(templateRoot, targetDir, skipDirs);
	if (!success) {
		spinner.stop("Failed");
		p.outro(color.red("Template copy failed"));
		process.exit(1);
	}

	spinner.stop("Done");
	logProjectOnlySkip(skipDirs);

	const restoredFileCount = finalizeInstalledFiles(
		targetDir,
		getPackageVersion(),
		preservedFiles,
	);

	if (restoredFileCount > 0) {
		p.log.info(`Preserved ${restoredFileCount} user memory files (memory/project/)`);
	}

	emitCanonicalBridgeArtifactsScaffold(templateRoot, targetDir, {
		beadsRuntimeEnabled: options.beads,
	});

	if (options.free) {
		applyModelPreset(targetDir, "free");
		p.log.info("Applied free model preset");
	} else if (options.recommend) {
		applyModelPreset(targetDir, "recommend");
		p.log.info("Applied recommended model preset");
	} else if (options.yes) {
		applyModelPreset(targetDir, "free");
		p.log.info("Applied free model preset (default)");
	} else {
		const preset = await p.select({
			message: "Choose model preset",
			options: [
				{ value: "free", label: "Free models", hint: "minimax, glm, grok (no API costs)" },
				{ value: "recommend", label: "Recommended models", hint: "gpt-5.4, opus-4.6, sonnet-4.6, gemini-3.1" },
				{ value: "custom", label: "Custom", hint: "configure each agent individually" },
				{ value: "skip", label: "Skip", hint: "keep template defaults" },
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

	initializeBeads(targetDir, options.beads);
	installEmbeddedDependencies(targetDir);

	await handleOrphanFiles({
		targetDir,
		templateRoot,
		mode,
		force: options.force,
		backup: options.backup,
		pruneAll: options.pruneAll,
		prune: options.prune,
		yes: options.yes,
	});

	p.outro(color.green("Ready to code!"));
}
