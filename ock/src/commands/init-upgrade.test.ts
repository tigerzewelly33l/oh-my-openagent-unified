import {
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
import { finalizeInstalledFiles, findOrphans, preserveUserFiles } from "./init";
import { copyDirWithPreserve, findUpgradeOrphans } from "./upgrade";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
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
});
