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
	let result = "";
	let inString = false;
	let isEscaped = false;
	let inLineComment = false;
	let inBlockComment = false;

	for (let index = 0; index < content.length; index += 1) {
		const character = content[index];
		const nextCharacter = content[index + 1];

		if (inLineComment) {
			if (character === "\n") {
				inLineComment = false;
				result += character;
			}
			continue;
		}

		if (inBlockComment) {
			if (character === "*" && nextCharacter === "/") {
				inBlockComment = false;
				index += 1;
			}
			continue;
		}

		if (!inString && character === "/" && nextCharacter === "/") {
			inLineComment = true;
			index += 1;
			continue;
		}

		if (!inString && character === "/" && nextCharacter === "*") {
			inBlockComment = true;
			index += 1;
			continue;
		}

		result += character;

		if (inString) {
			if (isEscaped) {
				isEscaped = false;
				continue;
			}
			if (character === "\\") {
				isEscaped = true;
				continue;
			}
			if (character === '"') {
				inString = false;
			}
			continue;
		}

		if (character === '"') {
			inString = true;
		}
	}

	return result;
}

function stripTrailingCommas(content: string): string {
	let result = "";
	let inString = false;
	let isEscaped = false;

	for (let index = 0; index < content.length; index += 1) {
		const character = content[index];

		if (inString) {
			result += character;
			if (isEscaped) {
				isEscaped = false;
				continue;
			}
			if (character === "\\") {
				isEscaped = true;
				continue;
			}
			if (character === '"') {
				inString = false;
			}
			continue;
		}

		if (character === '"') {
			inString = true;
			result += character;
			continue;
		}

		if (character === ",") {
			let lookahead = index + 1;
			while (lookahead < content.length && /\s/.test(content[lookahead])) {
				lookahead += 1;
			}
			if (content[lookahead] === "}" || content[lookahead] === "]") {
				continue;
			}
		}

		result += character;
	}

	return result;
}

function normalizeJsonc(content: string): string {
	return stripTrailingCommas(stripJsonComments(content)).trim();
}

function parseBridgeConfig(content: string): BridgeExperimentalConfig {
	const normalizedContent = normalizeJsonc(content);
	if (normalizedContent.length === 0) {
		return {};
	}

	return JSON.parse(normalizedContent) as BridgeExperimentalConfig;
}

function withBeadsRuntimeManagedConfig(
	content: string,
	enabled: boolean,
): string {
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

export function canonicalizeBridgePluginEntries(
	existingPlugins: string[],
): string[] {
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

	if (!hasCanonicalPluginEntry(canonicalPlugins)) {
		canonicalPlugins.push(PLUGIN_NAME);
	}

	return canonicalPlugins;
}

export function ensureCanonicalPluginRegistration(
	opencodeConfigPath: string,
): boolean {
	const config = JSON.parse(
		normalizeJsonc(readFileSync(opencodeConfigPath, "utf-8")),
	) as {
		plugin?: unknown;
	};
	const existingPlugins = Array.isArray(config.plugin)
		? config.plugin.filter(
				(value): value is string => typeof value === "string",
			)
		: [];
	const canonicalPlugins = canonicalizeBridgePluginEntries(existingPlugins);

	if (
		existingPlugins.length === canonicalPlugins.length &&
		existingPlugins.every(
			(pluginName, index) => pluginName === canonicalPlugins[index],
		)
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
	const templateBridgeConfigPath =
		getCanonicalBridgeConfigPath(templateOpencodeDir);
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
