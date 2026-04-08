import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { UpgradeCopyResult } from "./files.js";

const PLUGIN_NAME = "oh-my-openagent";
const LEGACY_PLUGIN_NAME = "oh-my-opencode";
const CONFIG_BASENAME = "oh-my-openagent";

const TEMPLATE_OWNED_BRIDGE_FILES = [`${CONFIG_BASENAME}.jsonc`] as const;

function getCanonicalBridgeTemplatePath(templateOpencode: string): string {
	return join(templateOpencode, `${CONFIG_BASENAME}.jsonc`);
}

function refreshCanonicalBridgeConfigFromTemplate(templateOpencode: string, opencodeDir: string): void {
	const templateBridgeConfigPath = getCanonicalBridgeTemplatePath(templateOpencode);
	if (!existsSync(templateBridgeConfigPath)) {
		return;
	}

	const bridgeConfigPath = join(opencodeDir, `${CONFIG_BASENAME}.jsonc`);
	writeFileSync(
		bridgeConfigPath,
		readFileSync(templateBridgeConfigPath, "utf-8"),
	);
}

function ensureCanonicalPluginRegistration(opencodeConfigPath: string): void {
	if (!existsSync(opencodeConfigPath)) {
		return;
	}

	const config = JSON.parse(readFileSync(opencodeConfigPath, "utf-8")) as {
		plugin?: unknown;
	};
	const existingPlugins = Array.isArray(config.plugin)
		? config.plugin.filter((value): value is string => typeof value === "string")
		: [];
	const canonicalPlugins = existingPlugins
		.map((pluginName) =>
			pluginName === LEGACY_PLUGIN_NAME ? PLUGIN_NAME : pluginName,
		)
		.filter((pluginName, index, values) => values.indexOf(pluginName) === index);

	if (!canonicalPlugins.includes(PLUGIN_NAME)) {
		canonicalPlugins.push(PLUGIN_NAME);
	}

	if (
		existingPlugins.length === canonicalPlugins.length &&
		existingPlugins.every((pluginName, index) => pluginName === canonicalPlugins[index])
	) {
		return;
	}

	config.plugin = canonicalPlugins;
	writeFileSync(opencodeConfigPath, `${JSON.stringify(config, null, 2)}\n`);
}

function normalizeRelativePath(path: string): string {
	return path.replaceAll("\\", "/");
}

export function getTemplateOwnedBridgeFiles(): readonly string[] {
	return TEMPLATE_OWNED_BRIDGE_FILES;
}

export function isTemplateOwnedBridgeFile(relativePath: string): boolean {
	return getTemplateOwnedBridgeFiles().includes(
		normalizeRelativePath(relativePath),
	);
}

export function shouldPreserveUpgradeFile(
	entryName: string,
	relativePath: string,
	preserveFiles: readonly string[],
): boolean {
	return (
		preserveFiles.includes(entryName) && !isTemplateOwnedBridgeFile(relativePath)
	);
}

export function shouldUsePreserveDirStrategy(
	entryName: string,
	basePath: string,
	preserveDirs: readonly string[],
): boolean {
	if (basePath.length > 0) {
		return false;
	}

	return (
		preserveDirs.includes(entryName) && !isTemplateOwnedBridgeFile(entryName)
	);
}

export function refreshBridgeArtifactsScaffold(_options: {
	opencodeDir: string;
	templateOpencode: string;
	copyResult: UpgradeCopyResult;
}): void {
	refreshCanonicalBridgeConfigFromTemplate(
		_options.templateOpencode,
		_options.opencodeDir,
	);
	ensureCanonicalPluginRegistration(join(_options.opencodeDir, "opencode.json"));
}
