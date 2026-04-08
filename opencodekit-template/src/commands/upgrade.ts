import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import color from "picocolors";
import { requireOpencodePath, showError } from "../utils/errors.js";
import {
	generateManifest,
	loadManifest,
} from "../utils/manifest.js";
import { applyAllPatches, loadPatchMetadata } from "../utils/patch.js";
import {
	parseOptions,
	type UpgradeOptions,
	UpgradeOptionsSchema,
} from "../utils/schemas.js";
import { refreshBridgeArtifactsScaffold } from "./upgrade/bridge.js";
import { PRESERVE_DIRS, PRESERVE_FILES } from "./upgrade/constants.js";
import { copyDirWithPreserve } from "./upgrade/files.js";
import { findUpgradeOrphans, handleUpgradeOrphans } from "./upgrade/orphans.js";

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

export { copyDirWithPreserve, findUpgradeOrphans };

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
		[...PRESERVE_FILES],
		[...PRESERVE_DIRS],
		manifest,
	);

	refreshBridgeArtifactsScaffold({
		opencodeDir,
		templateOpencode,
		copyResult: result,
	});

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

	await handleUpgradeOrphans(opencodeDir, templateOpencode, options);

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
