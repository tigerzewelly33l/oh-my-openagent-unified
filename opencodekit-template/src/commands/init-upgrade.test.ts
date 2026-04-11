import {
	chmodSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashContent, loadManifest, MANIFEST_FILE } from "../utils/manifest";
import { canonicalizeBridgePluginEntries } from "./bridge/runtime-contract";
import { copyOpenCodeOnly } from "./init/files";
import { finalizeInstalledFiles, findOrphans, preserveUserFiles } from "./init";
import {
	emitCanonicalBridgeArtifactsScaffold,
	installEmbeddedDependencies,
} from "./init/runtime";
import { copyDirWithPreserve, findUpgradeOrphans } from "./upgrade";
import { handleUpgradeOrphans } from "./upgrade/orphans";
import { refreshBridgeArtifactsScaffold } from "./upgrade/bridge";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

function createFakeNpmBin(exitCode: number): string {
	const binDir = makeTempDir(`ock-fake-npm-${exitCode}-`);
	const npmPath = join(binDir, "npm");
	writeFileSync(npmPath, `#!/bin/sh\nexit ${exitCode}\n`);
	chmodSync(npmPath, 0o755);
	return binDir;
}

function withPrependedPath(pathEntry: string, run: () => void): void {
	const originalPath = process.env.PATH;
	process.env.PATH = originalPath ? `${pathEntry}:${originalPath}` : pathEntry;

	try {
		run();
	} finally {
		if (originalPath === undefined) {
			delete process.env.PATH;
		} else {
			process.env.PATH = originalPath;
		}
	}
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

describe("init/upgrade regression helpers", () => {
	it("preserveUserFiles captures nested files recursively", () => {
		const targetDir = makeTempDir("ock-init-");
		mkdirSync(join(targetDir, ".opencode", "context", "architecture"), {
			recursive: true,
		});
		mkdirSync(join(targetDir, ".opencode", "memory", "project"), {
			recursive: true,
		});

		writeFileSync(
			join(targetDir, ".opencode", "context", "architecture", "api.md"),
			"nested context",
		);
		writeFileSync(
			join(targetDir, ".opencode", "memory", "project", "user.md"),
			"user profile",
		);

		const preserved = preserveUserFiles(targetDir);

		expect(preserved.get(join("context", "architecture", "api.md"))).toBe(
			"nested context",
		);
		expect(preserved.get(join("memory", "project", "user.md"))).toBe(
			"user profile",
		);
	});

	it("finalizeInstalledFiles records template baseline before restoring preserved files", () => {
		const targetDir = makeTempDir("ock-finalize-");
		const opencodeDir = join(targetDir, ".opencode");
		mkdirSync(join(opencodeDir, "memory", "project"), { recursive: true });

		const templatePath = join(opencodeDir, "memory", "project", "user.md");
		const templateContent = "template baseline";
		const userContent = "restored user content";
		writeFileSync(templatePath, templateContent);

		const preserved = new Map<string, string>([
			[join("memory", "project", "user.md"), userContent],
		]);

		const restoredCount = finalizeInstalledFiles(targetDir, "1.2.3", preserved);
		const manifest = loadManifest(opencodeDir);

		expect(restoredCount).toBe(1);
		expect(readFileSync(templatePath, "utf-8")).toBe(userContent);
		expect(manifest?.files[join("memory", "project", "user.md")]).toBe(
			hashContent(templateContent),
		);
	});

	it("findOrphans ignores generated manifest files", () => {
		const targetDir = makeTempDir("ock-orphans-");
		const opencodeDir = join(targetDir, ".opencode");
		mkdirSync(opencodeDir, { recursive: true });

		writeFileSync(join(opencodeDir, MANIFEST_FILE), "{}");
		writeFileSync(join(opencodeDir, "custom.md"), "orphan");

		const orphans = findOrphans(targetDir, new Set());

		expect(orphans).toEqual(["custom.md"]);
	});

	it("findUpgradeOrphans ignores generated manifest files", () => {
		const orphans = findUpgradeOrphans(
			[MANIFEST_FILE, ".version", ".env", "custom.md"],
			[],
		);

		expect(orphans).toEqual(["custom.md"]);
	});

	it("copyDirWithPreserve reports nested relative paths consistently", () => {
		const srcDir = makeTempDir("ock-upgrade-src-");
		const destDir = makeTempDir("ock-upgrade-dest-");

		mkdirSync(join(srcDir, "nested"), { recursive: true });
		mkdirSync(join(destDir, "nested"), { recursive: true });

		writeFileSync(join(srcDir, "root.txt"), "new root");
		writeFileSync(join(srcDir, "nested", "child.txt"), "updated child");
		writeFileSync(join(destDir, "nested", "child.txt"), "old child");

		const result = copyDirWithPreserve(srcDir, destDir, [], [], null);

		expect(result.added).toContain("root.txt");
		expect(result.updated).toContain(join("nested", "child.txt"));
		expect(result.updated).not.toContain("child.txt");
	});

	it("emitCanonicalBridgeArtifactsScaffold writes canonical bridge config and plugin registration", () => {
		const targetDir = makeTempDir("ock-bridge-init-");
		const opencodeDir = join(targetDir, ".opencode");
		const templateRoot = process.cwd();
		mkdirSync(opencodeDir, { recursive: true });
		writeFileSync(
			join(opencodeDir, "opencode.json"),
			JSON.stringify({ plugin: ["oh-my-opencode", "other-plugin"] }, null, 2),
		);

		const result = emitCanonicalBridgeArtifactsScaffold(templateRoot, targetDir);
		const bridgeConfig = readFileSync(
			join(opencodeDir, "oh-my-openagent.jsonc"),
			"utf-8",
		);
		const opencodeConfig = JSON.parse(
			readFileSync(join(opencodeDir, "opencode.json"), "utf-8"),
		) as { plugin: string[] };

		expect(result.emitted).toContain(join(".opencode", "oh-my-openagent.jsonc"));
		expect(JSON.parse(bridgeConfig)).toEqual({
			experimental: {
				beads_runtime: false,
				task_system: false,
			},
		});
		expect(opencodeConfig.plugin).toEqual(["oh-my-openagent", "other-plugin"]);
	});

	it("emitCanonicalBridgeArtifactsScaffold enables beads runtime for fresh beads init", () => {
		const targetDir = makeTempDir("ock-bridge-init-beads-");
		const opencodeDir = join(targetDir, ".opencode");
		const templateRoot = process.cwd();
		mkdirSync(opencodeDir, { recursive: true });
		writeFileSync(join(opencodeDir, "opencode.json"), JSON.stringify({ plugin: [] }, null, 2));

		emitCanonicalBridgeArtifactsScaffold(templateRoot, targetDir, {
			beadsRuntimeEnabled: true,
		});

		const bridgeConfig = JSON.parse(
			readFileSync(join(opencodeDir, "oh-my-openagent.jsonc"), "utf-8"),
		) as { experimental: { beads_runtime: boolean; task_system: boolean } };

		expect(bridgeConfig.experimental).toEqual({
			beads_runtime: true,
			task_system: false,
		});
	});

	it("emitCanonicalBridgeArtifactsScaffold canonicalizes versioned legacy plugin entries", () => {
		const targetDir = makeTempDir("ock-bridge-versioned-");
		const opencodeDir = join(targetDir, ".opencode");
		const templateRoot = process.cwd();
		mkdirSync(opencodeDir, { recursive: true });
		writeFileSync(
			join(opencodeDir, "opencode.json"),
			JSON.stringify({ plugin: ["oh-my-opencode@latest", "oh-my-opencode@1.0.0"] }, null, 2),
		);

		emitCanonicalBridgeArtifactsScaffold(templateRoot, targetDir);
		const opencodeConfig = JSON.parse(
			readFileSync(join(opencodeDir, "opencode.json"), "utf-8"),
		) as { plugin: string[] };

		expect(opencodeConfig.plugin).toContain("oh-my-openagent@latest");
		expect(opencodeConfig.plugin).toContain("oh-my-openagent@1.0.0");
		expect(opencodeConfig.plugin).not.toContain("oh-my-opencode");
	});

	it("canonicalizeBridgePluginEntries deduplicates exact and versioned legacy entries while preserving non-bridge plugins", () => {
		expect(
			canonicalizeBridgePluginEntries([
				"oh-my-opencode",
				"oh-my-openagent",
				"oh-my-opencode@latest",
				"oh-my-openagent@latest",
				"other-plugin",
				"other-plugin",
			]),
		).toEqual([
			"oh-my-openagent",
			"oh-my-openagent@latest",
			"other-plugin",
		]);
	});

	it("refreshBridgeArtifactsScaffold canonicalizes versioned legacy plugin entries during upgrade", () => {
		const opencodeDir = makeTempDir("ock-bridge-versioned-upgrade-");
		const templateOpencode = join(process.cwd(), ".opencode");
		writeFileSync(
			join(opencodeDir, "opencode.json"),
			JSON.stringify({ plugin: ["oh-my-opencode@latest"] }, null, 2),
		);

		refreshBridgeArtifactsScaffold({
			opencodeDir,
			templateOpencode,
			copyResult: { added: [], updated: [], preserved: [] },
		});

		const opencodeConfig = JSON.parse(
			readFileSync(join(opencodeDir, "opencode.json"), "utf-8"),
		) as { plugin: string[] };

		expect(opencodeConfig.plugin).toEqual(["oh-my-openagent@latest"]);
	});

	it("refreshBridgeArtifactsScaffold deduplicates bridge plugin entries while preserving non-bridge plugins", () => {
		const opencodeDir = makeTempDir("ock-bridge-dedupe-upgrade-");
		const templateOpencode = join(process.cwd(), ".opencode");
		writeFileSync(
			join(opencodeDir, "opencode.json"),
			JSON.stringify(
				{
					plugin: [
						"oh-my-opencode",
						"oh-my-openagent",
						"other-plugin",
						"oh-my-opencode@latest",
						"oh-my-openagent@latest",
						"other-plugin",
					],
				},
				null,
				2,
			),
		);

		refreshBridgeArtifactsScaffold({
			opencodeDir,
			templateOpencode,
			copyResult: { added: [], updated: [], preserved: [] },
		});

		const opencodeConfig = JSON.parse(
			readFileSync(join(opencodeDir, "opencode.json"), "utf-8"),
		) as { plugin: string[] };

		expect(opencodeConfig.plugin).toEqual([
			"oh-my-openagent",
			"other-plugin",
			"oh-my-openagent@latest",
		]);
	});

	it("project-only init keeps the canonical bridge config local when shared dirs are skipped", async () => {
		const targetDir = makeTempDir("ock-bridge-project-only-");
		const templateRoot = process.cwd();
		const opencodeDir = join(targetDir, ".opencode");
		const bridgeConfigPath = join(opencodeDir, "oh-my-openagent.jsonc");

		const copied = await copyOpenCodeOnly(templateRoot, targetDir, [
			"agent",
			"command",
			"skill",
			"tool",
		]);
		writeFileSync(bridgeConfigPath, "// stale bridge config\n{\n}\n");

		const emitted = emitCanonicalBridgeArtifactsScaffold(templateRoot, targetDir);

		expect(copied).toBe(true);
		expect(existsSync(join(opencodeDir, "agent"))).toBe(false);
		expect(existsSync(join(opencodeDir, "command"))).toBe(false);
		expect(existsSync(join(opencodeDir, "skill"))).toBe(false);
		expect(existsSync(join(opencodeDir, "tool"))).toBe(false);
		expect(emitted.emitted).toContain(join(".opencode", "oh-my-openagent.jsonc"));
		expect(JSON.parse(readFileSync(bridgeConfigPath, "utf-8"))).toEqual({
			experimental: {
				beads_runtime: false,
				task_system: false,
			},
		});
	});

	it("refreshBridgeArtifactsScaffold restores canonical bridge config during upgrade", () => {
		const opencodeDir = makeTempDir("ock-bridge-upgrade-");
		const templateOpencode = join(process.cwd(), ".opencode");
		writeFileSync(
			join(opencodeDir, "oh-my-openagent.jsonc"),
			JSON.stringify(
				{
					experimental: {
						beads_runtime: true,
						task_system: true,
					},
				},
				null,
				2,
			),
		);
		writeFileSync(
			join(opencodeDir, "opencode.json"),
			JSON.stringify({ plugin: ["oh-my-opencode"] }, null, 2),
		);

		refreshBridgeArtifactsScaffold({
			opencodeDir,
			templateOpencode,
			copyResult: { added: [], updated: [], preserved: [] },
		});

		const bridgeConfig = readFileSync(
			join(opencodeDir, "oh-my-openagent.jsonc"),
			"utf-8",
		);
		const opencodeConfig = JSON.parse(
			readFileSync(join(opencodeDir, "opencode.json"), "utf-8"),
		) as { plugin: string[] };

		expect(JSON.parse(bridgeConfig)).toEqual({
			experimental: {
				beads_runtime: true,
				task_system: false,
			},
		});
		expect(opencodeConfig.plugin).toEqual(["oh-my-openagent"]);
	});

	it("refreshBridgeArtifactsScaffold leaves managed config unchanged for projects without explicit beads runtime enablement", () => {
		const opencodeDir = makeTempDir("ock-bridge-upgrade-no-beads-");
		const templateOpencode = join(process.cwd(), ".opencode");
		const existingBridgeConfig = JSON.stringify(
			{
				experimental: {
					beads_runtime: false,
					task_system: true,
				},
			},
			null,
			2,
		);
		writeFileSync(join(opencodeDir, "oh-my-openagent.jsonc"), `${existingBridgeConfig}\n`);
		writeFileSync(
			join(opencodeDir, "opencode.json"),
			JSON.stringify({ plugin: ["oh-my-opencode"] }, null, 2),
		);

		refreshBridgeArtifactsScaffold({
			opencodeDir,
			templateOpencode,
			copyResult: { added: [], updated: [], preserved: [] },
		});

		expect(readFileSync(join(opencodeDir, "oh-my-openagent.jsonc"), "utf-8")).toBe(
			`${existingBridgeConfig}\n`,
		);
	});

	it("upgrade prune removes obsolete bridge files but keeps the canonical bridge config", async () => {
		const opencodeDir = makeTempDir("ock-prune-installed-");
		const templateOpencode = makeTempDir("ock-prune-template-");
		const templateBridgeConfig = readFileSync(
			join(process.cwd(), ".opencode", "oh-my-openagent.jsonc"),
			"utf-8",
		);
		const bridgeConfigPath = join(opencodeDir, "oh-my-openagent.jsonc");
		const obsoleteBridgeFilePath = join(opencodeDir, "obsolete-bridge-file.txt");

		writeFileSync(bridgeConfigPath, templateBridgeConfig);
		writeFileSync(obsoleteBridgeFilePath, "obsolete bridge file");
		writeFileSync(
			join(templateOpencode, "oh-my-openagent.jsonc"),
			templateBridgeConfig,
		);

		await handleUpgradeOrphans(opencodeDir, templateOpencode, {
			prune: false,
			pruneAll: true,
		});

		expect(existsSync(obsoleteBridgeFilePath)).toBe(false);
		expect(readFileSync(bridgeConfigPath, "utf-8")).toBe(templateBridgeConfig);
	});

	it("installEmbeddedDependencies reports skipped installs when no embedded package exists", () => {
		const targetDir = makeTempDir("ock-install-skipped-");
		mkdirSync(join(targetDir, ".opencode"), { recursive: true });

		expect(installEmbeddedDependencies(targetDir)).toEqual({
			attempted: false,
			installed: false,
		});
	});

	it.each([
		{ exitCode: 0, expected: { attempted: true, installed: true } },
		{ exitCode: 1, expected: { attempted: true, installed: false } },
	])(
		"installEmbeddedDependencies reports install results when npm exits with $exitCode",
		({ exitCode, expected }) => {
			const targetDir = makeTempDir(`ock-install-${exitCode}-`);
			const opencodeDir = join(targetDir, ".opencode");
			const fakeNpmBin = createFakeNpmBin(exitCode);

			mkdirSync(opencodeDir, { recursive: true });
			writeFileSync(
				join(opencodeDir, "package.json"),
				JSON.stringify({ name: "embedded-opencode", private: true }, null, 2),
			);

			withPrependedPath(fakeNpmBin, () => {
				expect(installEmbeddedDependencies(targetDir)).toEqual(expected);
			});
		},
	);
});
