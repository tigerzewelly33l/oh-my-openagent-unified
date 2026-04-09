import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { applyEdits, modify, parse } from "jsonc-parser";
import { z } from "zod";

export const PLUGIN_NAME = "oh-my-openagent";
export const LEGACY_PLUGIN_NAME = "oh-my-opencode";
export const CONFIG_BASENAME = "oh-my-openagent";

const ConfigSchema = z.object({
	plugin: z.array(z.string()).optional(),
});

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
	const canonicalPlugins: string[] = [];
	let canonicalBridgeIndex = -1;

	for (const pluginName of existingPlugins.map(toCanonicalPluginEntry)) {
		const isBridgeEntry =
			pluginName === PLUGIN_NAME || pluginName.startsWith(`${PLUGIN_NAME}@`);

		if (isBridgeEntry) {
			if (canonicalBridgeIndex === -1) {
				canonicalPlugins.push(pluginName);
				canonicalBridgeIndex = canonicalPlugins.length - 1;
				continue;
			}

			const existingBridgeEntry = canonicalPlugins[canonicalBridgeIndex];
			if (!existingBridgeEntry.includes("@") && pluginName.includes("@")) {
				canonicalPlugins[canonicalBridgeIndex] = pluginName;
			}
			continue;
		}

		if (!canonicalPlugins.includes(pluginName)) {
			canonicalPlugins.push(pluginName);
		}
	}

	if (canonicalBridgeIndex === -1) {
		canonicalPlugins.push(PLUGIN_NAME);
	}

	return canonicalPlugins;
}

export function ensureCanonicalPluginRegistration(opencodeConfigPath: string): boolean {
	const originalContent = readFileSync(opencodeConfigPath, "utf-8");
	const parseErrors: NonNullable<Parameters<typeof parse>[1]> = [];
	const parsedContent = ConfigSchema.parse(parse(originalContent, parseErrors));
	if (parseErrors.length > 0) {
		throw new Error(`Invalid JSONC in ${opencodeConfigPath}`);
	}
	const existingPlugins = parsedContent.plugin ?? [];
	const canonicalPlugins = canonicalizeBridgePluginEntries(existingPlugins);

	if (
		existingPlugins.length === canonicalPlugins.length &&
		existingPlugins.every((pluginName, index) => pluginName === canonicalPlugins[index])
	) {
		return false;
	}

	const edits = modify(
		originalContent,
		["plugin"],
		canonicalPlugins,
		{ formattingOptions: { insertSpaces: true, tabSize: 2 } },
	);
	const updatedContent = applyEdits(originalContent, edits);
	writeFileSync(opencodeConfigPath, updatedContent.endsWith("\n") ? updatedContent : `${updatedContent}\n`);
	return true;
}

export function getCanonicalBridgeConfigPath(opencodeDir: string): string {
	return join(opencodeDir, `${CONFIG_BASENAME}.jsonc`);
}

export function refreshCanonicalBridgeConfigFromTemplate(
	templateOpencodeDir: string,
	opencodeDir: string,
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

	if (existingContent === templateContent) {
		return false;
	}

	writeFileSync(bridgeConfigPath, templateContent);
	return true;
}
