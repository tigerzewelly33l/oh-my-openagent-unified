import type { UpgradeCopyResult } from "./files.js";
import {
	CONFIG_BASENAME,
	ensureCanonicalPluginRegistration,
	refreshCanonicalBridgeConfigFromTemplate,
} from "../bridge/runtime-contract.js";

const TEMPLATE_OWNED_BRIDGE_FILES = [`${CONFIG_BASENAME}.jsonc`] as const;

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
	ensureCanonicalPluginRegistration(`${_options.opencodeDir}/opencode.json`);
}
