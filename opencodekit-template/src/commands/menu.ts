import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import { requireOpencodePath, showWarning } from "../utils/errors.js";
import { agentCommand } from "./agent.js";
import { configCommand } from "./config.js";
import { initCommand } from "./init.js";
import { skillCommand } from "./skill.js";
import { upgradeCommand } from "./upgrade.js";

export async function interactiveMenu(version: string) {
	p.intro(color.bgCyan(color.black(` OpenCodeKit v${version} `)));

	const action = await p.select({
		message: "What do you want to do?",
		options: [
			{ value: "init" as const, label: "Initialize project" },
			{ value: "config" as const, label: "Config - edit opencode.json" },
			{ value: "upgrade" as const, label: "Upgrade - update templates" },
			{ value: "agent-list" as const, label: "List agents" },
			{ value: "agent-add" as const, label: "Add agent" },
			{ value: "skill-list" as const, label: "List skills" },
			{ value: "skill-add" as const, label: "Add skill" },
			{ value: "status" as const, label: "Status - project overview" },
			{ value: "doctor" as const, label: "Doctor - check project health" },
			{ value: "exit" as const, label: "Exit" },
		],
	});

	if (p.isCancel(action) || action === "exit") {
		p.outro("Bye!");
		return;
	}

	switch (action) {
		case "init":
			console.clear();
			await initCommand({});
			break;
		case "config":
			await configCommand();
			break;
		case "upgrade":
			await upgradeCommand({});
			break;
		case "agent-list":
			await agentCommand("list");
			break;
		case "agent-add":
			await agentCommand("add");
			break;
		case "skill-list":
			await skillCommand("list");
			break;
		case "skill-add":
			await skillCommand("add");
			break;
		case "status":
			await statusCommand();
			break;
		case "doctor":
			await doctorCommand();
			break;
	}
}

interface CheckResult {
	name: string;
	ok: boolean;
	fix?: string;
	warn?: boolean;
}

// Known top-level properties from official OpenCode schema
const KNOWN_CONFIG_PROPERTIES = new Set([
	"$schema",
	"model",
	"small_model",
	"theme",
	"share",
	"autoupdate",
	"mcp",
	"permission",
	"keybinds",
	"provider",
	"agent",
	"formatter",
	"plugin",
	"tools",
	"tui",
	"command",
	"watcher",
	"snapshot",
	"disabled_providers",
	"enabled_providers",
	"username",
	"lsp",
	"instructions",
	"enterprise",
	"experimental",
	"compaction",
]);

async function doctorCommand() {
	if (process.argv.includes("--quiet")) return;

	const cwd = process.cwd();
	const opencodeDir = join(cwd, ".opencode");

	p.intro(color.bgBlue(color.white(" Doctor - Health Check ")));

	const checks: CheckResult[] = [];
	const warnings: CheckResult[] = [];

	// ═══════════════════════════════════════════════════════════
	// Basic Structure Checks
	// ═══════════════════════════════════════════════════════════

	console.log();
	console.log(color.bold("  Structure"));

	// Check .opencode/
	checks.push({
		name: ".opencode/ exists",
		ok: existsSync(opencodeDir),
		fix: "ock init",
	});

	// Check opencode.json
	const configPath = join(opencodeDir, "opencode.json");
	checks.push({
		name: "opencode.json exists",
		ok: existsSync(configPath),
		fix: "ock init --force",
	});

	// Check package.json
	checks.push({
		name: "package.json exists",
		ok: existsSync(join(opencodeDir, "package.json")),
		fix: "ock init --force",
	});

	// Check node_modules
	checks.push({
		name: "Dependencies installed",
		ok: existsSync(join(opencodeDir, "node_modules")),
		fix: "cd .opencode && bun install",
	});

	displayChecks(checks.slice(-4));

	// ═══════════════════════════════════════════════════════════
	// Config Validation
	// ═══════════════════════════════════════════════════════════

	if (existsSync(configPath)) {
		console.log();
		console.log(color.bold("  Configuration"));

		const configChecks: CheckResult[] = [];

		try {
			const configContent = readFileSync(configPath, "utf-8");
			const config = JSON.parse(configContent);

			// Check $schema
			configChecks.push({
				name: "$schema reference",
				ok: !!config.$schema,
				fix: 'Add "$schema": "https://opencode.ai/config.json"',
				warn: true,
			});

			// Check for unknown properties
			const unknownProps = Object.keys(config).filter(
				(k) => !KNOWN_CONFIG_PROPERTIES.has(k),
			);
			if (unknownProps.length > 0) {
				warnings.push({
					name: `Unknown config properties: ${unknownProps.join(", ")}`,
					ok: false,
					warn: true,
				});
			}

			// Check model is set
			configChecks.push({
				name: "Model configured",
				ok: !!config.model,
				fix: "ock config model",
				warn: true,
			});

			// Check MCP servers
			if (config.mcp) {
				const mcpServers = Object.keys(config.mcp);
				const invalidMcp = mcpServers.filter((name) => {
					const server = config.mcp[name];
					return !server.command && !server.url;
				});

				configChecks.push({
					name: `MCP servers (${mcpServers.length} configured)`,
					ok: invalidMcp.length === 0,
					fix:
						invalidMcp.length > 0
							? `Fix: ${invalidMcp.join(", ")} need command or url`
							: undefined,
				});
			}

			// Check agents in config match files
			if (config.agent) {
				const configuredAgents = Object.keys(config.agent);
				const agentDir = join(opencodeDir, "agent");
				const missingFiles = configuredAgents.filter(
					(name) => !existsSync(join(agentDir, `${name}.md`)),
				);

				if (missingFiles.length > 0) {
					warnings.push({
						name: `Agent config without files: ${missingFiles.join(", ")}`,
						ok: false,
						warn: true,
					});
				}
			}

			checks.push(...configChecks);
			displayChecks(configChecks);
		} catch {
			checks.push({
				name: "Valid JSON syntax",
				ok: false,
				fix: "Fix JSON syntax errors in opencode.json",
			});
			displayChecks([checks[checks.length - 1]]);
		}
	}

	// ═══════════════════════════════════════════════════════════
	// Agent Validation
	// ═══════════════════════════════════════════════════════════

	console.log();
	console.log(color.bold("  Agents"));

	const agentDir = join(opencodeDir, "agent");
	const agentChecks: CheckResult[] = [];

	if (existsSync(agentDir)) {
		const agentFiles = readdirSync(agentDir).filter((f) => f.endsWith(".md"));

		agentChecks.push({
			name: `Agent files (${agentFiles.length} found)`,
			ok: agentFiles.length > 0,
			fix: "ock agent create",
		});

		// Validate each agent has frontmatter
		for (const file of agentFiles) {
			const content = readFileSync(join(agentDir, file), "utf-8");
			const hasFrontmatter = content.startsWith("---");
			const hasMode = content.includes("mode:");

			if (!hasFrontmatter) {
				warnings.push({
					name: `${file}: Missing frontmatter`,
					ok: false,
					warn: true,
				});
			} else if (!hasMode) {
				warnings.push({
					name: `${file}: Missing mode in frontmatter`,
					ok: false,
					warn: true,
				});
			}
		}
	} else {
		agentChecks.push({
			name: "agent/ directory",
			ok: false,
			fix: "ock agent create",
		});
	}

	checks.push(...agentChecks);
	displayChecks(agentChecks);

	// ═══════════════════════════════════════════════════════════
	// Skill Validation
	// ═══════════════════════════════════════════════════════════

	console.log();
	console.log(color.bold("  Skills"));

	const skillDir = join(opencodeDir, "skill");
	const skillChecks: CheckResult[] = [];

	if (existsSync(skillDir)) {
		const skillFolders = readdirSync(skillDir).filter((f) =>
			lstatSync(join(skillDir, f)).isDirectory(),
		);

		const validSkills = skillFolders.filter((folder) =>
			existsSync(join(skillDir, folder, "SKILL.md")),
		);

		skillChecks.push({
			name: `Skills (${validSkills.length} valid)`,
			ok: validSkills.length > 0,
			fix: "ock skill create",
		});

		// Check for folders without SKILL.md
		const invalidFolders = skillFolders.filter(
			(f) => !existsSync(join(skillDir, f, "SKILL.md")),
		);
		if (invalidFolders.length > 0) {
			warnings.push({
				name: `Skill folders missing SKILL.md: ${invalidFolders.slice(0, 3).join(", ")}${invalidFolders.length > 3 ? "..." : ""}`,
				ok: false,
				warn: true,
			});
		}

		// Validate skill frontmatter
		for (const folder of validSkills.slice(0, 5)) {
			const content = readFileSync(join(skillDir, folder, "SKILL.md"), "utf-8");
			const hasFrontmatter = content.startsWith("---");
			const hasName = content.includes("name:");
			const hasDescription = content.includes("description:");

			if (!hasFrontmatter || !hasName || !hasDescription) {
				warnings.push({
					name: `${folder}: Missing required frontmatter (name, description)`,
					ok: false,
					warn: true,
				});
			}
		}
	} else {
		skillChecks.push({
			name: "skill/ directory",
			ok: false,
			fix: "ock skill create",
			warn: true,
		});
	}

	checks.push(...skillChecks);
	displayChecks(skillChecks);

	// ═══════════════════════════════════════════════════════════
	// Custom Tools Validation
	// ═══════════════════════════════════════════════════════════

	console.log();
	console.log(color.bold("  Tools"));

	const toolDir = join(opencodeDir, "tool");
	const toolChecks: CheckResult[] = [];

	if (existsSync(toolDir)) {
		const toolFiles = readdirSync(toolDir).filter((f) => f.endsWith(".ts"));

		toolChecks.push({
			name: `Custom tools (${toolFiles.length} found)`,
			ok: true,
		});

		// Check tools have proper exports
		for (const file of toolFiles.slice(0, 5)) {
			const content = readFileSync(join(toolDir, file), "utf-8");
			const hasExport =
				content.includes("export default") || content.includes("export const");
			const hasTool = content.includes("tool(");

			if (!hasExport || !hasTool) {
				warnings.push({
					name: `${file}: Missing tool() export`,
					ok: false,
					warn: true,
				});
			}
		}
	} else {
		toolChecks.push({
			name: "tool/ directory (optional)",
			ok: true,
		});
	}

	checks.push(...toolChecks);
	displayChecks(toolChecks);

	// ═══════════════════════════════════════════════════════════
	// Summary
	// ═══════════════════════════════════════════════════════════

	const errors = checks.filter((c) => !c.ok && !c.warn);
	const warningCount =
		warnings.length + checks.filter((c) => !c.ok && c.warn).length;

	// Show warnings
	if (warnings.length > 0) {
		console.log();
		console.log(color.bold("  Warnings"));
		for (const warn of warnings.slice(0, 5)) {
			console.log(`  ${color.yellow("!")} ${warn.name}`);
		}
		if (warnings.length > 5) {
			console.log(color.dim(`    ... and ${warnings.length - 5} more`));
		}
	}

	console.log();

	if (errors.length === 0 && warningCount === 0) {
		p.outro(color.green("All checks passed!"));
	} else if (errors.length === 0) {
		p.outro(
			color.yellow(
				`Passed with ${warningCount} warning${warningCount > 1 ? "s" : ""}`,
			),
		);
	} else {
		p.outro(
			color.red(
				`${errors.length} error${errors.length > 1 ? "s" : ""}, ${warningCount} warning${warningCount > 1 ? "s" : ""}`,
			),
		);
	}
}

function displayChecks(checks: CheckResult[]) {
	for (const check of checks) {
		if (check.ok) {
			console.log(`  ${color.green("✓")} ${check.name}`);
		} else if (check.warn) {
			console.log(`  ${color.yellow("!")} ${check.name}`);
			if (check.fix) {
				console.log(`    ${color.dim("→")} ${color.dim(check.fix)}`);
			}
		} else {
			console.log(`  ${color.red("✗")} ${check.name}`);
			if (check.fix) {
				console.log(`    ${color.dim("→ Run:")} ${color.cyan(check.fix)}`);
			}
		}
	}
}

async function statusCommand() {
	if (process.argv.includes("--quiet")) return;

	const cwd = process.cwd();
	const opencodeDir = requireOpencodePath();

	if (!opencodeDir) {
		return;
	}

	const projectName = basename(cwd);

	p.intro(color.bgCyan(color.black(` ${projectName} `)));

	// Count agents
	const agentDir = join(opencodeDir, "agent");
	let agentNames: string[] = [];
	if (existsSync(agentDir)) {
		agentNames = readdirSync(agentDir)
			.filter((f) => f.endsWith(".md") && lstatSync(join(agentDir, f)).isFile())
			.map((f) => f.replace(".md", ""));
	}

	// Count skills (using correct path)
	const skillDir = join(opencodeDir, "skill");
	let skillCount = 0;
	if (existsSync(skillDir)) {
		skillCount = readdirSync(skillDir).filter(
			(f) =>
				lstatSync(join(skillDir, f)).isDirectory() &&
				existsSync(join(skillDir, f, "SKILL.md")),
		).length;
	}

	// Count commands
	const commandDir = join(opencodeDir, "command");
	let commandCount = 0;
	if (existsSync(commandDir)) {
		commandCount = readdirSync(commandDir).filter((f) =>
			f.endsWith(".md"),
		).length;
	}

	// Count tools
	const toolDir = join(opencodeDir, "tool");
	let toolCount = 0;
	if (existsSync(toolDir)) {
		toolCount = readdirSync(toolDir).filter((f) => f.endsWith(".ts")).length;
	}

	// Count MCP servers
	const configPath = join(opencodeDir, "opencode.json");
	let mcpCount = 0;
	if (existsSync(configPath)) {
		try {
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			mcpCount = Object.keys(config.mcp || {}).length;
		} catch {
			// Ignore
		}
	}

	// Display
	console.log();
	console.log(
		`  ${color.bold("Agents")}     ${color.cyan(String(agentNames.length))}`,
	);
	if (agentNames.length > 0) {
		console.log(`             ${color.dim(agentNames.join(", "))}`);
	}
	console.log();
	console.log(
		`  ${color.bold("Skills")}     ${color.cyan(String(skillCount))}`,
	);
	console.log();
	console.log(
		`  ${color.bold("Commands")}   ${color.cyan(String(commandCount))}`,
	);
	console.log();
	console.log(`  ${color.bold("Tools")}      ${color.cyan(String(toolCount))}`);
	console.log();
	console.log(`  ${color.bold("MCP")}        ${color.cyan(String(mcpCount))}`);
	console.log();

	// Warn if deps not installed
	if (!existsSync(join(opencodeDir, "node_modules"))) {
		showWarning("Dependencies not installed", "cd .opencode && bun install");
	}

	p.outro(color.dim(".opencode/"));
}

export { doctorCommand, statusCommand };
