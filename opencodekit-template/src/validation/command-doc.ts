import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface ValidationIssue {
	file: string;
	line: number;
	rule: string;
	message: string;
	suggestion?: string;
}

export interface ValidationResult {
	ok: boolean;
	issues: ValidationIssue[];
}

interface ParsedFrontmatter {
	frontmatter: Record<string, string>;
	body: string;
	hasFrontmatter: boolean;
}

const REQUIRED_FRONTMATTER_FIELDS = ["description", "agent"] as const;

const DEFAULT_COMMAND_DIR = join(process.cwd(), ".opencode", "command");
const DEFAULT_AGENT_DIR = join(process.cwd(), ".opencode", "agent");

const INVALID_TOOL_ALIASES: Record<string, string> = {
	memory_admin: "memory-admin",
	memory_get: "memory-get",
	memory_read: "memory-read",
	memory_search: "memory-search",
	memory_timeline: "memory-timeline",
	memory_update: "memory-update",
};

const TOOL_CALL_RE = /\b([A-Za-z][A-Za-z0-9_-]*)\s*\(/g;

export function parseFrontmatter(content: string): ParsedFrontmatter {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) {
		return {
			frontmatter: {},
			body: content,
			hasFrontmatter: false,
		};
	}

	const frontmatter: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const colonIndex = line.indexOf(":");
		if (colonIndex <= 0) continue;

		const key = line.slice(0, colonIndex).trim();
		let value = line.slice(colonIndex + 1).trim();

		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		frontmatter[key] = value;
	}

	return {
		frontmatter,
		body: match[2],
		hasFrontmatter: true,
	};
}

function getLineNumber(content: string, index: number): number {
	let line = 1;
	for (let i = 0; i < index; i++) {
		if (content[i] === "\n") line += 1;
	}
	return line;
}

function readAgentNames(agentDir: string): Set<string> {
	const fallback = new Set([
		"build",
		"explore",
		"general",
		"looker",
		"painter",
		"plan",
		"review",
		"scout",
		"vision",
	]);

	if (!existsSync(agentDir)) return fallback;

	for (const name of readdirSync(agentDir)) {
		if (name.endsWith(".md")) {
			fallback.add(name.slice(0, -3));
		}
	}

	return fallback;
}

export function validateCommandContent(
	filePath: string,
	content: string,
	knownAgents: Set<string>,
): ValidationIssue[] {
	const issues: ValidationIssue[] = [];
	const parsed = parseFrontmatter(content);

	if (!parsed.hasFrontmatter) {
		issues.push({
			file: filePath,
			line: 1,
			rule: "missing-frontmatter",
			message: "Command file must include YAML frontmatter.",
			suggestion: "Add a frontmatter block with description and agent.",
		});
	} else {
		for (const field of REQUIRED_FRONTMATTER_FIELDS) {
			if (!parsed.frontmatter[field]) {
				issues.push({
					file: filePath,
					line: 1,
					rule: "missing-frontmatter-field",
					message: `Missing required frontmatter field: ${field}`,
				});
			}
		}

		const agent = parsed.frontmatter.agent;
		if (agent && !knownAgents.has(agent)) {
			issues.push({
				file: filePath,
				line: 1,
				rule: "invalid-agent",
				message: `Unknown agent in frontmatter: ${agent}`,
				suggestion: `Use one of: ${Array.from(knownAgents).sort().join(", ")}`,
			});
		}
	}

	const matches = content.matchAll(TOOL_CALL_RE);
	for (const match of matches) {
		const callName = match[1];
		if (!(callName in INVALID_TOOL_ALIASES)) continue;

		const index = match.index ?? 0;
		issues.push({
			file: filePath,
			line: getLineNumber(content, index),
			rule: "tool-name-format",
			message: `Invalid tool name '${callName}'.`,
			suggestion: `Use '${INVALID_TOOL_ALIASES[callName]}' instead.`,
		});
	}

	return issues;
}

export function validateCommandDirectory(
	commandDir = DEFAULT_COMMAND_DIR,
	agentDir = DEFAULT_AGENT_DIR,
	selectedFiles?: Set<string>,
): ValidationResult {
	if (!existsSync(commandDir)) {
		return {
			ok: false,
			issues: [
				{
					file: commandDir,
					line: 1,
					rule: "missing-directory",
					message: "Command directory does not exist.",
					suggestion: "Initialize .opencode/command before running validation.",
				},
			],
		};
	}

	const knownAgents = readAgentNames(agentDir);
	const issues: ValidationIssue[] = [];
	const files = readdirSync(commandDir)
		.filter((name) => name.endsWith(".md"))
		.sort();

	for (const file of files) {
		const filePath = join(commandDir, file);
		if (selectedFiles && !selectedFiles.has(filePath)) {
			continue;
		}
		const content = readFileSync(filePath, "utf-8");
		issues.push(...validateCommandContent(filePath, content, knownAgents));
	}

	return {
		ok: issues.length === 0,
		issues,
	};
}

function getChangedCommandFiles(projectRoot: string): string[] {
	const collected = new Set<string>();

	const collectFromGit = (args: string[]) => {
		try {
			const output = execFileSync("git", args, {
				cwd: projectRoot,
				encoding: "utf-8",
			});
			for (const line of output.split("\n")) {
				const trimmed = line.trim();
				if (!trimmed || !trimmed.endsWith(".md")) continue;
				if (!trimmed.startsWith(".opencode/command/")) continue;
				collected.add(join(projectRoot, trimmed));
			}
		} catch {
			// Ignore git diff failures and continue with available sources.
		}
	};

	collectFromGit([
		"diff",
		"--name-only",
		"--diff-filter=ACMR",
		"--",
		".opencode/command",
	]);
	collectFromGit([
		"diff",
		"--cached",
		"--name-only",
		"--diff-filter=ACMR",
		"--",
		".opencode/command",
	]);

	if (process.env.CI && process.env.GITHUB_BASE_REF) {
		collectFromGit([
			"diff",
			"--name-only",
			"--diff-filter=ACMR",
			`origin/${process.env.GITHUB_BASE_REF}...HEAD`,
			"--",
			".opencode/command",
		]);
	}

	return Array.from(collected).sort();
}

function formatIssue(issue: ValidationIssue): string {
	const location = `${issue.file}:${issue.line}`;
	const suggestion = issue.suggestion ? `\n    fix: ${issue.suggestion}` : "";
	return `[${issue.rule}] ${location}\n    ${issue.message}${suggestion}`;
}

function printResult(result: ValidationResult): void {
	if (result.ok) {
		console.log("command-doc validation passed");
		return;
	}

	console.error(
		`command-doc validation failed with ${result.issues.length} issue(s):`,
	);
	for (const issue of result.issues) {
		console.error(`- ${formatIssue(issue)}`);
	}
}

function runCli(): void {
	const shouldCheck = process.argv.includes("--check");
	const checkAll = process.argv.includes("--all");
	if (!shouldCheck) {
		console.log("Usage: bun run src/validation/command-doc.ts --check [--all]");
		process.exit(0);
	}

	if (!checkAll) {
		const changedFiles = getChangedCommandFiles(process.cwd());
		if (changedFiles.length === 0) {
			console.log("command-doc validation skipped (no changed command docs)");
			return;
		}

		const result = validateCommandDirectory(
			DEFAULT_COMMAND_DIR,
			DEFAULT_AGENT_DIR,
			new Set(changedFiles),
		);
		printResult(result);
		if (!result.ok) {
			process.exitCode = 1;
		}
		return;
	}

	const result = validateCommandDirectory(
		DEFAULT_COMMAND_DIR,
		DEFAULT_AGENT_DIR,
	);
	printResult(result);
	if (!result.ok) {
		process.exitCode = 1;
	}
}

const invokedPath = process.argv[1] ?? "";
if (invokedPath.endsWith("src/validation/command-doc.ts")) {
	runCli();
}
