import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runDocsDriftCheck } from "./docs-drift";

const tempDirs: string[] = [];

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

function createDocsDriftFixture(): string {
	const root = mkdtempSync(join(tmpdir(), "docs-drift-skill-mcp-"));
	tempDirs.push(root);

	mkdirSync(join(root, ".opencode", "command"), { recursive: true });
	mkdirSync(join(root, ".opencode", "skill", "example-skill"), {
		recursive: true,
	});
	mkdirSync(join(root, ".opencode", "plugin"), { recursive: true });
	mkdirSync(join(root, ".opencode", "agent"), { recursive: true });

	writeFileSync(join(root, "README.md"), "");
	writeFileSync(join(root, "CLI.md"), "");
	writeFileSync(join(root, ".opencode", "README.md"), "");
	writeFileSync(join(root, ".opencode", "AGENTS.md"), "");
	writeFileSync(join(root, ".opencode", "plugin", "README.md"), "");

	return root;
}

describe("runDocsDriftCheck skill_mcp guidance", () => {
	it("flags legacy skill_mcp skill_name syntax in markdown docs", () => {
		const root = createDocsDriftFixture();
		writeFileSync(
			join(root, ".opencode", "skill", "example-skill", "SKILL.md"),
			'skill_mcp(skill_name="figma", tool_name="get_figma_data")\n',
		);

		const result = runDocsDriftCheck(root);

		expect(result.ok).toBe(false);
		expect(
			result.issues.some((issue) => issue.rule === "legacy-skill-mcp-syntax"),
		).toBe(true);
	});

	it("flags legacy object-style skill_name syntax in markdown docs", () => {
		const root = createDocsDriftFixture();
		writeFileSync(
			join(root, ".opencode", "skill", "example-skill", "SKILL.md"),
			'skill_mcp({ skill_name: "obsidian", tool_name: "read_note" })\n',
		);

		const result = runDocsDriftCheck(root);

		expect(result.ok).toBe(false);
		expect(
			result.issues.some((issue) => issue.rule === "legacy-skill-mcp-syntax"),
		).toBe(true);
	});

	it("does not flag plain skill_name prose outside skill_mcp examples", () => {
		const root = createDocsDriftFixture();
		writeFileSync(
			join(root, ".opencode", "skill", "example-skill", "SKILL.md"),
			"---\nexample:\n  skill_name: figma\n---\n\nUse mcp_name when documenting skill_mcp examples.\n",
		);

		const result = runDocsDriftCheck(root);

		expect(
			result.issues.some((issue) => issue.rule === "legacy-skill-mcp-syntax"),
		).toBe(false);
	});

	it("allows deprecated status/disconnect mentions when explicitly marked unsupported", () => {
		const root = createDocsDriftFixture();
		writeFileSync(
			join(root, ".opencode", "plugin", "README.md"),
			"skill_mcp_status is deprecated and unsupported in canonical OMO runtime guidance.\nskill_mcp_disconnect is deprecated and unsupported in canonical OMO runtime guidance.\n",
		);

		const result = runDocsDriftCheck(root);

		expect(
			result.issues.some((issue) => issue.rule === "legacy-skill-mcp-surface"),
		).toBe(false);
	});

	it("flags live repeated legacy surface mentions even when an earlier one is deprecated", () => {
		const root = createDocsDriftFixture();
		writeFileSync(
			join(root, ".opencode", "plugin", "README.md"),
			"skill_mcp_status is deprecated and unsupported in canonical guidance.\n\nUse skill_mcp_status to check whether a session is connected.\n",
		);

		const result = runDocsDriftCheck(root);

		expect(
			result.issues.some((issue) => issue.rule === "legacy-skill-mcp-surface"),
		).toBe(true);
	});

	it("ignores symlinked markdown directories during recursive scans", () => {
		const root = createDocsDriftFixture();
		const externalDir = mkdtempSync(
			join(tmpdir(), "docs-drift-symlink-target-"),
		);
		tempDirs.push(externalDir);
		mkdirSync(join(externalDir, "nested"), { recursive: true });
		writeFileSync(
			join(externalDir, "nested", "external.md"),
			'skill_mcp(skill_name="external", tool_name="bad")\n',
		);
		symlinkSync(
			externalDir,
			join(root, ".opencode", "skill", "external-link"),
			process.platform === "win32" ? "junction" : "dir",
		);

		const result = runDocsDriftCheck(root);

		expect(
			result.issues.some((issue) => issue.rule === "legacy-skill-mcp-syntax"),
		).toBe(false);
	});
});
