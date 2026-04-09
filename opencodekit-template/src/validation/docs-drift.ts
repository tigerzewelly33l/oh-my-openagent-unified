import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

interface DriftIssue {
	rule: string;
	message: string;
	fix?: string;
}

interface DriftResult {
	ok: boolean;
	issues: DriftIssue[];
}

function read(filePath: string): string {
	return readFileSync(filePath, "utf-8");
}

function listFiles(dir: string, suffix: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir)
		.filter((name) => name.endsWith(suffix))
		.sort();
}

function collectMarkdownFilesRecursive(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const files: string[] = [];
	for (const entry of readdirSync(dir).sort()) {
		const fullPath = join(dir, entry);
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			files.push(...collectMarkdownFilesRecursive(fullPath));
			continue;
		}
		if (entry.endsWith(".md")) {
			files.push(fullPath);
		}
	}

	return files;
}

function getActualSlashCommands(projectRoot: string): string[] {
	return listFiles(join(projectRoot, ".opencode", "command"), ".md").map((f) =>
		f.replace(/\.md$/, ""),
	);
}

function getActualCliCommands(projectRoot: string): string[] {
	const indexPath = join(projectRoot, "src", "index.ts");
	if (!existsSync(indexPath)) return [];

	const content = read(indexPath);
	const matches = content.matchAll(/\.command\(\s*"([^"]+)"/g);
	const names = new Set<string>();
	for (const match of matches) {
		const token = match[1].split(" ")[0];
		if (token) names.add(token);
	}
	return Array.from(names).sort();
}

function getActualPluginSources(projectRoot: string): string[] {
	const pluginDir = join(projectRoot, ".opencode", "plugin");
	if (!existsSync(pluginDir)) return [];

	return readdirSync(pluginDir)
		.filter((name) => name.endsWith(".ts") && !name.endsWith(".bak.ts"))
		.filter((name) => !name.endsWith(".d.ts"))
		.sort();
}

function checkSlashCommandsInReadme(
	readme: string,
	actualSlashCommands: string[],
): DriftIssue[] {
	const issues: DriftIssue[] = [];
	const documented = new Set<string>();
	for (const match of readme.matchAll(/`\/([a-z0-9-]+)`/g)) {
		documented.add(match[1]);
	}

	for (const command of actualSlashCommands) {
		if (!documented.has(command)) {
			issues.push({
				rule: "readme-missing-slash-command",
				message: `README.md is missing '/${command}'`,
				fix: "Add the command to README.md slash command list.",
			});
		}
	}

	for (const command of documented) {
		if (!actualSlashCommands.includes(command)) {
			issues.push({
				rule: "readme-unknown-slash-command",
				message: `README.md references unknown '/${command}'`,
				fix: "Remove or correct the command name.",
			});
		}
	}

	return issues;
}

function checkCliCommandsInCliDoc(
	cliDoc: string,
	actualCliCommands: string[],
): DriftIssue[] {
	const issues: DriftIssue[] = [];
	const documented = new Set<string>();
	for (const match of cliDoc.matchAll(/`ock\s+([a-z-]+)/g)) {
		documented.add(match[1]);
	}

	for (const command of actualCliCommands) {
		if (!documented.has(command)) {
			issues.push({
				rule: "cli-missing-command",
				message: `CLI.md is missing 'ock ${command}'`,
				fix: "Add command to CLI.md command surface section.",
			});
		}
	}

	for (const command of documented) {
		if (!actualCliCommands.includes(command)) {
			issues.push({
				rule: "cli-unknown-command",
				message: `CLI.md references unknown 'ock ${command}'`,
				fix: "Remove or correct command reference.",
			});
		}
	}

	return issues;
}

function checkPluginReadme(
	pluginReadme: string,
	actualPluginSources: string[],
): DriftIssue[] {
	const issues: DriftIssue[] = [];
	const documented = new Set<string>();
	for (const match of pluginReadme.matchAll(/`([a-z0-9-]+\.ts)`/g)) {
		documented.add(match[1]);
	}

	for (const source of actualPluginSources) {
		if (!documented.has(source)) {
			issues.push({
				rule: "plugin-readme-missing-file",
				message: `.opencode/plugin/README.md is missing '${source}'`,
				fix: "Add file to plugin README plugin list.",
			});
		}
	}

	for (const source of documented) {
		if (!actualPluginSources.includes(source)) {
			issues.push({
				rule: "plugin-readme-unknown-file",
				message: `.opencode/plugin/README.md references unknown '${source}'`,
				fix: "Remove stale plugin file reference.",
			});
		}
	}

	return issues;
}

function checkLegacySessionToolReferences(projectRoot: string): DriftIssue[] {
	const issues: DriftIssue[] = [];
	const targetFiles = [
		...collectMarkdownFilesRecursive(join(projectRoot, ".opencode", "command")),
		...collectMarkdownFilesRecursive(join(projectRoot, ".opencode", "skill")),
		join(projectRoot, ".opencode", "AGENTS.md"),
	].filter((filePath, index, values) => values.indexOf(filePath) === index && existsSync(filePath));

	for (const filePath of targetFiles) {
		const content = read(filePath);
		const legacyMatches = content.match(/\b(find_sessions|read_session)\b/g);
		if (!legacyMatches || legacyMatches.length === 0) {
			continue;
		}

		issues.push({
			rule: "legacy-session-tool-reference",
			message: `${filePath} still references legacy session tools (${Array.from(new Set(legacyMatches)).join(", ")})`,
			fix: "Replace legacy session guidance with session_search/session_read/session_list/session_info as appropriate.",
		});
	}

	return issues;
}

function checkLegacySkillMcpDocReferences(projectRoot: string): DriftIssue[] {
	const issues: DriftIssue[] = [];
	const targetFiles = collectMarkdownFilesRecursive(join(projectRoot, ".opencode"));

	for (const filePath of targetFiles) {
		const content = read(filePath);
		const legacySkillNameMatches = content.match(/skill_mcp\(skill_name=|\(skill_name\s*=|skill_name\s*:/g);
		if (legacySkillNameMatches && legacySkillNameMatches.length > 0) {
			issues.push({
				rule: "legacy-skill-mcp-syntax",
				message: `${filePath} still contains legacy skill_mcp skill_name syntax`,
				fix: "Use canonical skill_mcp(mcp_name=...) examples with the actual MCP server name.",
			});
		}

		const deprecatedSurfaceMatches = content.match(/skill_mcp_status|skill_mcp_disconnect/g);
		if (!deprecatedSurfaceMatches || deprecatedSurfaceMatches.length === 0) {
			continue;
		}

		const mentionsAreExplicitlyDeprecated = deprecatedSurfaceMatches.every((match) => {
			const index = content.indexOf(match);
			const context = content.slice(Math.max(0, index - 120), Math.min(content.length, index + 160)).toLowerCase();
			return context.includes("deprecated") || context.includes("unsupported");
		});

		if (!mentionsAreExplicitlyDeprecated) {
			issues.push({
				rule: "legacy-skill-mcp-surface",
				message: `${filePath} still documents skill_mcp_status or skill_mcp_disconnect as live surfaces`,
				fix: "Remove those examples or mark them explicitly deprecated / unsupported.",
			});
		}
	}

	return issues;
}

function checkOpencodeReadmeCounts(
	opencodeReadme: string,
	agentCount: number,
	commandCount: number,
): DriftIssue[] {
	const issues: DriftIssue[] = [];

	const agentMatch = opencodeReadme.match(/Agent definitions \((\d+)\)/);
	if (agentMatch) {
		const documented = Number.parseInt(agentMatch[1], 10);
		if (documented !== agentCount) {
			issues.push({
				rule: "opencode-readme-agent-count",
				message: `.opencode/README.md agent count (${documented}) does not match actual (${agentCount})`,
				fix: "Update the documented agent count.",
			});
		}
	}

	const commandMatch = opencodeReadme.match(/Slash commands \((\d+)\)/);
	if (commandMatch) {
		const documented = Number.parseInt(commandMatch[1], 10);
		if (documented !== commandCount) {
			issues.push({
				rule: "opencode-readme-command-count",
				message: `.opencode/README.md command count (${documented}) does not match actual (${commandCount})`,
				fix: "Update the documented command count.",
			});
		}
	}

	if (/\bsudo\s+/m.test(opencodeReadme)) {
		issues.push({
			rule: "opencode-readme-sudo",
			message: ".opencode/README.md contains 'sudo' usage guidance",
			fix: "Remove or rewrite privileged command instructions.",
		});
	}

	return issues;
}

export function runDocsDriftCheck(projectRoot = process.cwd()): DriftResult {
	const readmePath = join(projectRoot, "README.md");
	const cliPath = join(projectRoot, "CLI.md");
	const opencodeReadmePath = join(projectRoot, ".opencode", "README.md");
	const pluginReadmePath = join(
		projectRoot,
		".opencode",
		"plugin",
		"README.md",
	);

	const issues: DriftIssue[] = [];

	const actualSlashCommands = getActualSlashCommands(projectRoot);
	const actualCliCommands = getActualCliCommands(projectRoot);
	const actualPluginSources = getActualPluginSources(projectRoot);
	const agentCount = listFiles(
		join(projectRoot, ".opencode", "agent"),
		".md",
	).length;
	const commandCount = actualSlashCommands.length;

	if (existsSync(readmePath)) {
		issues.push(
			...checkSlashCommandsInReadme(read(readmePath), actualSlashCommands),
		);
	}

	if (existsSync(cliPath)) {
		issues.push(...checkCliCommandsInCliDoc(read(cliPath), actualCliCommands));
	}

	if (existsSync(pluginReadmePath)) {
		issues.push(
			...checkPluginReadme(read(pluginReadmePath), actualPluginSources),
		);
	}

	issues.push(...checkLegacySessionToolReferences(projectRoot));
	issues.push(...checkLegacySkillMcpDocReferences(projectRoot));

	if (existsSync(opencodeReadmePath)) {
		issues.push(
			...checkOpencodeReadmeCounts(
				read(opencodeReadmePath),
				agentCount,
				commandCount,
			),
		);
	}

	return {
		ok: issues.length === 0,
		issues,
	};
}

function printResult(result: DriftResult): void {
	if (result.ok) {
		console.log("docs-drift check passed");
		return;
	}

	console.error(
		`docs-drift check failed with ${result.issues.length} issue(s):`,
	);
	for (const issue of result.issues) {
		console.error(`- [${issue.rule}] ${issue.message}`);
		if (issue.fix) {
			console.error(`    fix: ${issue.fix}`);
		}
	}
}

function runCli(): void {
	const shouldCheck = process.argv.includes("--check");
	if (!shouldCheck) {
		console.log("Usage: bun run src/validation/docs-drift.ts --check");
		process.exit(0);
	}

	const result = runDocsDriftCheck();
	printResult(result);
	if (!result.ok) {
		process.exitCode = 1;
	}
}

const invokedPath = process.argv[1] ?? "";
if (invokedPath.endsWith("src/validation/docs-drift.ts")) {
	runCli();
}
