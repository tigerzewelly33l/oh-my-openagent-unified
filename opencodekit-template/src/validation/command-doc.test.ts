import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	parseFrontmatter,
	validateCommandContent,
	validateCommandDirectory,
} from "./command-doc";

const tempDirs: string[] = [];

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

describe("parseFrontmatter", () => {
	it("parses command frontmatter and body", () => {
		const input = `---
description: example
agent: build
---

# Example: $ARGUMENTS
`;

		const parsed = parseFrontmatter(input);

		expect(parsed.hasFrontmatter).toBe(true);
		expect(parsed.frontmatter.description).toBe("example");
		expect(parsed.frontmatter.agent).toBe("build");
		expect(parsed.body.includes("# Example")).toBe(true);
	});
});

describe("validateCommandContent", () => {
	const knownAgents = new Set(["build", "review"]);

	it("flags underscored memory tool aliases with fixes", () => {
		const content = `---
description: test
agent: build
---

# Test: $ARGUMENTS

memory_search({ query: "x" });
memory_update({ file: "x", content: "y", mode: "replace" });
`;

		const issues = validateCommandContent("design.md", content, knownAgents);

		expect(issues.length).toBe(2);
		expect(issues[0].suggestion).toContain("memory-search");
		expect(issues[1].suggestion).toContain("memory-update");
	});

	it("flags missing frontmatter and invalid agent", () => {
		const noFrontmatter = "# Title\nBody\n";
		const issueA = validateCommandContent(
			"missing.md",
			noFrontmatter,
			knownAgents,
		);
		expect(issueA.some((item) => item.rule === "missing-frontmatter")).toBe(
			true,
		);

		const invalidAgent = `---
description: test
agent: unknown
---

# Test
`;
		const issueB = validateCommandContent(
			"bad-agent.md",
			invalidAgent,
			knownAgents,
		);
		expect(issueB.some((item) => item.rule === "invalid-agent")).toBe(true);
	});
});

describe("validateCommandDirectory", () => {
	it("validates all markdown files in command directory", () => {
		const root = mkdtempSync(join(tmpdir(), "command-doc-"));
		tempDirs.push(root);

		const commandDir = join(root, "command");
		const agentDir = join(root, "agent");
		mkdirSync(commandDir, { recursive: true });
		mkdirSync(agentDir, { recursive: true });

		writeFileSync(join(agentDir, "build.md"), "# build\n");

		writeFileSync(
			join(commandDir, "valid.md"),
			`---
description: valid command
agent: build
---

# Valid: $ARGUMENTS

skill({ name: "beads" });
`,
		);

		writeFileSync(
			join(commandDir, "invalid.md"),
			`---
description: invalid command
agent: build
---

# Invalid: $ARGUMENTS

memory_search({ query: "oops" });
`,
		);

		const result = validateCommandDirectory(commandDir, agentDir);

		expect(result.ok).toBe(false);
		expect(result.issues.length).toBe(1);
		expect(result.issues[0].rule).toBe("tool-name-format");
	});
});
