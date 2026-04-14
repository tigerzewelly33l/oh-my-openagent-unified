import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const PLUGIN_NAME = "oh-my-openagent";
export const LEGACY_PLUGIN_NAME = "oh-my-opencode";
export const CONFIG_BASENAME = "oh-my-openagent";

interface BridgeExperimentalConfig {
	experimental?: {
		beads_runtime?: boolean;
		task_system?: boolean;
	};
}

function stripJsonComments(content: string): string {
	return content.replace(/^\s*\/\/.*$/gm, "").trim();
}

function parseBridgeConfig(content: string): BridgeExperimentalConfig {
	const normalizedContent = stripJsonComments(content);
	if (normalizedContent.length === 0) {
		return {};
	}

	return JSON.parse(normalizedContent) as BridgeExperimentalConfig;
}

function withBeadsRuntimeManagedConfig(content: string, enabled: boolean): string {
	const parsed = parseBridgeConfig(content);
	const nextConfig: BridgeExperimentalConfig = {
		...parsed,
		experimental: {
			...parsed.experimental,
			beads_runtime: enabled,
			task_system: false,
		},
	};

	return `${JSON.stringify(nextConfig, null, 2)}\n`;
}

export function hasExplicitBeadsRuntimeManagedConfig(content: string): boolean {
	return parseBridgeConfig(content).experimental?.beads_runtime === true;
}

export function toCanonicalPluginEntry(entry: string): string {
	if (entry === LEGACY_PLUGIN_NAME) {
		return PLUGIN_NAME;
	}

	if (entry.startsWith(`${LEGACY_PLUGIN_NAME}@`)) {
		return `${PLUGIN_NAME}${entry.slice(LEGACY_PLUGIN_NAME.length)}`;
	}

	return entry;
}

export function hasCanonicalPluginEntry(plugins: string[]): boolean {
	return plugins.some(
		(pluginName) =>
			pluginName === PLUGIN_NAME || pluginName.startsWith(`${PLUGIN_NAME}@`),
	);
}

export function canonicalizeBridgePluginEntries(existingPlugins: string[]): string[] {
	const canonicalPlugins = existingPlugins
		.map(toCanonicalPluginEntry)
		.filter((pluginName, index, values) => values.indexOf(pluginName) === index);

	if (!hasCanonicalPluginEntry(canonicalPlugins)) {
		canonicalPlugins.push(PLUGIN_NAME);
	}

	return canonicalPlugins;
}

export function ensureCanonicalPluginRegistration(opencodeConfigPath: string): boolean {
	const config = JSON.parse(readFileSync(opencodeConfigPath, "utf-8")) as {
		plugin?: unknown;
	};
	const existingPlugins = Array.isArray(config.plugin)
		? config.plugin.filter((value): value is string => typeof value === "string")
		: [];
	const canonicalPlugins = canonicalizeBridgePluginEntries(existingPlugins);

	if (
		existingPlugins.length === canonicalPlugins.length &&
		existingPlugins.every((pluginName, index) => pluginName === canonicalPlugins[index])
	) {
		return false;
	}

	config.plugin = canonicalPlugins;
	writeFileSync(opencodeConfigPath, `${JSON.stringify(config, null, 2)}\n`);
	return true;
}

export function getCanonicalBridgeConfigPath(opencodeDir: string): string {
	return join(opencodeDir, `${CONFIG_BASENAME}.jsonc`);
}

export function refreshCanonicalBridgeConfigFromTemplate(
	templateOpencodeDir: string,
	opencodeDir: string,
	options?: {
		beadsRuntimeEnabled?: boolean;
		refreshOnlyIfBeadsRuntimeEnabled?: boolean;
	},
): boolean {
	const templateBridgeConfigPath = getCanonicalBridgeConfigPath(templateOpencodeDir);
	if (!existsSync(templateBridgeConfigPath)) {
		return false;
	}

	const bridgeConfigPath = getCanonicalBridgeConfigPath(opencodeDir);
	const templateContent = readFileSync(templateBridgeConfigPath, "utf-8");
	const existingContent = existsSync(bridgeConfigPath)
		? readFileSync(bridgeConfigPath, "utf-8")
		: null;
	if (
		options?.refreshOnlyIfBeadsRuntimeEnabled &&
		(!existingContent || !hasExplicitBeadsRuntimeManagedConfig(existingContent))
	) {
		return false;
	}

	const nextContent = withBeadsRuntimeManagedConfig(
		templateContent,
		options?.beadsRuntimeEnabled ?? false,
	);

	if (existingContent === nextContent) {
		return false;
	}

	writeFileSync(bridgeConfigPath, nextContent);
	return true;
}
