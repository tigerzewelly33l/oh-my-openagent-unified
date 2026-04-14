import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

	writeFileSync(join(root, "README.md"), "")
	writeFileSync(join(root, "CLI.md"), "")
	writeFileSync(join(root, ".opencode", "README.md"), "")
	writeFileSync(join(root, ".opencode", "AGENTS.md"), "")
	writeFileSync(join(root, ".opencode", "plugin", "README.md"), "")

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
});
