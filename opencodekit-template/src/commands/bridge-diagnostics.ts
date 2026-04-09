import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CANONICAL_PLUGIN_NAME = "oh-my-openagent";
const LEGACY_PLUGIN_NAME = "oh-my-opencode";
const CANONICAL_CONFIG_BASENAME = "oh-my-openagent";
const LEGACY_CONFIG_BASENAME = "oh-my-opencode";

const LEGACY_SESSION_PATTERN = /\b(find_sessions|read_session)\b/;
const LEGACY_SKILL_MCP_PATTERN = /skill_mcp\(skill_name=|\(skill_name\s*=|skill_name\s*:/;
const DEPRECATED_SKILL_MCP_SURFACE_PATTERN = /skill_mcp_status|skill_mcp_disconnect/;

export type BridgeHealthLevel = "OK" | "WARN" | "ERROR";

export interface BridgeDiagnostic {
	level: Exclude<BridgeHealthLevel, "OK">;
	message: string;
	details?: string[];
}

export interface BridgeHealthReport {
	level: BridgeHealthLevel;
	diagnostics: BridgeDiagnostic[];
}

function hasPluginEntry(plugins: string[], pluginName: string): boolean {
	return plugins.some(
		(entry) => entry === pluginName || entry.startsWith(`${pluginName}@`),
	);
}

function readPluginEntries(opencodeDir: string): string[] {
	const configPath = join(opencodeDir, "opencode.json");
	if (!existsSync(configPath)) {
		return [];
	}

	try {
		const parsed = JSON.parse(readFileSync(configPath, "utf-8")) as {
			plugin?: unknown;
		};
		return Array.isArray(parsed.plugin)
			? parsed.plugin.filter((value): value is string => typeof value === "string")
			: [];
	} catch {
		return [];
	}
}

function detectConfigBasenameState(opencodeDir: string): {
	canonical: string[];
	legacy: string[];
} {
	const canonical = [
		join(opencodeDir, `${CANONICAL_CONFIG_BASENAME}.jsonc`),
		join(opencodeDir, `${CANONICAL_CONFIG_BASENAME}.json`),
	].filter((filePath) => existsSync(filePath));
	const legacy = [
		join(opencodeDir, `${LEGACY_CONFIG_BASENAME}.jsonc`),
		join(opencodeDir, `${LEGACY_CONFIG_BASENAME}.json`),
	].filter((filePath) => existsSync(filePath));

	return { canonical, legacy };
}

function collectMarkdownFilesRecursive(dir: string): string[] {
	if (!existsSync(dir)) {
		return [];
	}

	const results: string[] = [];
	for (const entry of readdirSync(dir).sort()) {
		const fullPath = join(dir, entry);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			results.push(...collectMarkdownFilesRecursive(fullPath));
			continue;
		}
		if (entry.endsWith(".md")) {
			results.push(fullPath);
		}
	}

	return results;
}

function findLegacyAuthoredContent(opencodeDir: string): string[] {
	const candidateFiles = [
		join(opencodeDir, "AGENTS.md"),
		...collectMarkdownFilesRecursive(join(opencodeDir, "command")),
		...collectMarkdownFilesRecursive(join(opencodeDir, "skill")),
		...collectMarkdownFilesRecursive(join(opencodeDir, "tool")),
	];

	return candidateFiles.filter((filePath, index, values) => {
		if (values.indexOf(filePath) !== index || !existsSync(filePath)) {
			return false;
		}
		const content = readFileSync(filePath, "utf-8");
		return (
			LEGACY_SESSION_PATTERN.test(content) ||
			LEGACY_SKILL_MCP_PATTERN.test(content) ||
			DEPRECATED_SKILL_MCP_SURFACE_PATTERN.test(content)
		);
	});
}

export function getBridgeHealthReport(opencodeDir: string): BridgeHealthReport {
	const diagnostics: BridgeDiagnostic[] = [];
	const pluginEntries = readPluginEntries(opencodeDir);
	const { canonical, legacy } = detectConfigBasenameState(opencodeDir);

	if (!hasPluginEntry(pluginEntries, CANONICAL_PLUGIN_NAME)) {
		diagnostics.push({
			level: "ERROR",
			message: 'BRIDGE ERROR: canonical plugin entry "oh-my-openagent" missing from .opencode/opencode.json',
		});
	}

	if (legacy.length > 0 && canonical.length > 0) {
		diagnostics.push({
			level: "WARN",
			message: "BRIDGE WARNING: both canonical and legacy runtime config basenames exist; OMO currently loads canonical first",
			details: [...canonical, ...legacy],
		});
	}

	if (hasPluginEntry(pluginEntries, LEGACY_PLUGIN_NAME)) {
		diagnostics.push({
			level: "WARN",
			message: "BRIDGE WARNING: legacy runtime plugin entries remain in .opencode/opencode.json",
			details: pluginEntries.filter(
				(entry) => entry === LEGACY_PLUGIN_NAME || entry.startsWith(`${LEGACY_PLUGIN_NAME}@`),
			),
		});
	}

	const legacyAuthoredFiles = findLegacyAuthoredContent(opencodeDir);
	if (legacyAuthoredFiles.length > 0) {
		diagnostics.push({
			level: "WARN",
			message: "BRIDGE WARNING: preserved project content still references legacy runtime surfaces",
			details: legacyAuthoredFiles,
		});
	}

	const level: BridgeHealthLevel = diagnostics.some((diagnostic) => diagnostic.level === "ERROR")
		? "ERROR"
		: diagnostics.length > 0
			? "WARN"
			: "OK";

	return { level, diagnostics };
}
