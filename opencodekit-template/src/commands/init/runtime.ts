import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { platform } from "node:os";
import { join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import type { InitOptions } from "../../utils/schemas.js";
import {
	createPlanSnapshotIndex,
	createRuntimeAttachmentsRegistry,
	getArtifactsIndexPath,
	getRuntimeAttachmentsRegistryPath,
} from "../beads-runtime-artifact-files.js";
import {
	CONFIG_BASENAME,
	ensureCanonicalPluginRegistration,
	refreshCanonicalBridgeConfigFromTemplate,
} from "../bridge/runtime-contract.js";
import type { GlobalConfigInfo, InitMode } from "./paths.js";

export interface BridgeArtifactEmissionResult {
	emitted: string[];
}

export function describeGlobalInstallTarget(globalDir: string): void {
	const os = platform();
	const osName =
		os === "win32" ? "Windows" : os === "darwin" ? "macOS" : "Linux";

	p.log.info(`Installing to global config (${osName})`);
	p.log.info(`Target: ${color.cyan(globalDir)}`);
}

export async function resolveProjectOnlySkipDirs(
	globalConfig: GlobalConfigInfo | null,
	options: Pick<InitOptions, "projectOnly" | "yes">,
): Promise<string[]> {
	if (!globalConfig) {
		return [];
	}

	if (options.projectOnly) {
		p.log.info(`Using global config from ${color.cyan(globalConfig.dir)}`);
		p.log.info(
			`Skipping: ${globalConfig.coveredDirs.map((dirName) => color.dim(dirName)).join(", ")}`,
		);
		return [...globalConfig.coveredDirs];
	}

	if (options.yes) {
		p.log.info(
			`Global config found at ${color.cyan(globalConfig.dir)} — use ${color.bold("--project-only")} to skip shared dirs`,
		);
		return [];
	}

	p.log.info(`Global config found at ${color.cyan(globalConfig.dir)}`);
	p.log.info(
		`Available globally: ${globalConfig.coveredDirs.map((dirName) => color.green(dirName)).join(", ")}`,
	);

	const useGlobal = await p.confirm({
		message:
			"Skip these (use global config)? Only project-scope files will be created locally.",
		initialValue: true,
	});

	if (!p.isCancel(useGlobal) && useGlobal) {
		return [...globalConfig.coveredDirs];
	}

	return [];
}

export function logProjectOnlySkip(skipDirs: string[]): void {
	if (skipDirs.length === 0) {
		return;
	}

	p.log.info(
		`Project-only init: skipped ${skipDirs.map((dirName) => color.dim(dirName)).join(", ")} (using global config)`,
	);
}

export function startInitSpinner(mode: InitMode): ReturnType<typeof p.spinner> {
	const spinner = p.spinner();

	if (mode === "scaffold") {
		spinner.start("Scaffolding project");
		return spinner;
	}

	if (mode === "add-config") {
		spinner.start("Adding OpenCodeKit");
		return spinner;
	}

	spinner.start("Reinitializing");
	return spinner;
}

export function ensureScaffoldDirectory(
	targetDir: string,
	mode: InitMode,
): void {
	if (mode === "scaffold") {
		mkdirSync(targetDir, { recursive: true });
	}
}

export function emitCanonicalBridgeArtifactsScaffold(
	templateRoot: string,
	targetDir: string,
	options?: {
		beadsRuntimeEnabled?: boolean;
	},
): BridgeArtifactEmissionResult {
	const opencodeDir = join(targetDir, ".opencode");
	const emitted: string[] = [];
	const opencodeConfigPath = join(opencodeDir, "opencode.json");

	if (
		refreshCanonicalBridgeConfigFromTemplate(
			join(templateRoot, ".opencode"),
			opencodeDir,
			{
				beadsRuntimeEnabled: options?.beadsRuntimeEnabled ?? false,
			},
		)
	) {
		emitted.push(join(".opencode", `${CONFIG_BASENAME}.jsonc`));
	}

	if (
		existsSync(opencodeConfigPath) &&
		ensureCanonicalPluginRegistration(opencodeConfigPath)
	) {
		emitted.push(join(".opencode", "opencode.json"));
	}

	return { emitted };
}

export function initializeBeads(targetDir: string, enabled: boolean): void {
	if (!enabled) {
		return;
	}

	const beadsDir = join(targetDir, ".beads");
	if (!existsSync(beadsDir)) {
		const spinner = p.spinner();
		spinner.start("Initializing .beads/");
		try {
			execSync("br init", { cwd: targetDir, stdio: "ignore" });
			spinner.stop("Beads initialized");
		} catch {
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
			spinner.stop("Beads initialized (manual)");
		}
	} else {
		p.log.info(".beads/ already exists");
	}

	ensureSchema1ArtifactScaffold(targetDir);
}

export function ensureSchema1ArtifactScaffold(targetDir: string): string[] {
	const now = new Date().toISOString();
	const emitted: string[] = [];
	const artifactsDir = join(targetDir, ".beads", "artifacts");
	mkdirSync(join(artifactsDir, "manifests"), { recursive: true });
	mkdirSync(join(artifactsDir, "plan-snapshots"), { recursive: true });
	mkdirSync(join(artifactsDir, "runtime-attachments"), { recursive: true });
	mkdirSync(join(artifactsDir, "runtime-checkpoints"), { recursive: true });

	const indexPath = join(targetDir, getArtifactsIndexPath());
	if (!existsSync(indexPath)) {
		writeFileSync(
			indexPath,
			`${JSON.stringify(createPlanSnapshotIndex({ writtenAt: now }), null, 2)}\n`,
		);
		emitted.push(getArtifactsIndexPath());
	}

	const registryPath = join(targetDir, getRuntimeAttachmentsRegistryPath());
	if (!existsSync(registryPath)) {
		writeFileSync(
			registryPath,
			`${JSON.stringify(
				createRuntimeAttachmentsRegistry({
					attachments: {},
					writtenAt: now,
				}),
				null,
				2,
			)}\n`,
		);
		emitted.push(getRuntimeAttachmentsRegistryPath());
	}

	return emitted;
}

export function installEmbeddedDependencies(targetDir: string): {
	attempted: boolean;
	installed: boolean;
} {
	const opencodeDir = join(targetDir, ".opencode");
	if (!existsSync(join(opencodeDir, "package.json"))) {
		return { attempted: false, installed: false };
	}

	const installSpinner = p.spinner();
	installSpinner.start("Installing dependencies");
	try {
		execSync("npm install --no-fund --no-audit", {
			cwd: opencodeDir,
			stdio: "ignore",
		});
		installSpinner.stop("Dependencies installed");
		return { attempted: true, installed: true };
	} catch {
		installSpinner.stop(
			"Failed to install (run manually: cd .opencode && npm install)",
		);
		return { attempted: true, installed: false };
	}
}
