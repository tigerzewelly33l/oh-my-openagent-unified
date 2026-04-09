import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import { parse } from "jsonc-parser";
import color from "picocolors";
import { z } from "zod";
import { getBridgeHealthReport } from "../utils/bridge-diagnostics.js";

export interface CheckResult {
	name: string;
	ok: boolean;
	fix?: string;
	warn?: boolean;
}

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

const DoctorConfigSchema = z.object({
	$schema: z.string().optional(),
	model: z.string().optional(),
	mcp: z.record(z.string(), z.object({ command: z.string().optional(), url: z.string().optional() })).optional(),
	agent: z.record(z.string(), z.unknown()).optional(),
}).catchall(z.unknown());

export async function doctorCommand() {
	const quiet = process.argv.includes("--quiet");

	const cwd = process.cwd();
	const opencodeDir = join(cwd, ".opencode");
	const bridgeHealth = getBridgeHealthReport(opencodeDir);

	if (!quiet) {
		p.intro(color.bgBlue(color.white(" Doctor - Health Check ")));
	}

	const checks: CheckResult[] = [];
	const warnings: CheckResult[] = [];

	if (!quiet) {
		console.log();
		console.log(color.bold("  Structure"));
	}

	checks.push({
		name: ".opencode/ exists",
		ok: existsSync(opencodeDir),
		fix: "ock init",
	});

	const configPath = join(opencodeDir, "opencode.json");
	checks.push({
		name: "opencode.json exists",
		ok: existsSync(configPath),
		fix: "ock init --force",
	});

	checks.push({
		name: "package.json exists",
		ok: existsSync(join(opencodeDir, "package.json")),
		fix: "ock init --force",
	});

	checks.push({
		name: "Dependencies installed",
		ok: existsSync(join(opencodeDir, "node_modules")),
		fix: "cd .opencode && npm install",
	});

	if (!quiet) {
		displayChecks(checks.slice(-4));
	}

	if (existsSync(configPath)) {
		if (!quiet) {
			console.log();
			console.log(color.bold("  Configuration"));
		}

		const configChecks: CheckResult[] = [];

		try {
			const configContent = readFileSync(configPath, "utf-8");
			const parseErrors: NonNullable<Parameters<typeof parse>[1]> = [];
			const parsedConfig = parse(configContent, parseErrors);
			if (parseErrors.length > 0) {
				throw new Error(`Invalid JSONC in ${configPath}`);
			}
			const config = DoctorConfigSchema.parse(parsedConfig);

			configChecks.push({
				name: "$schema reference",
				ok: !!config.$schema,
				fix: 'Add "$schema": "https://opencode.ai/config.json"',
				warn: true,
			});

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

			configChecks.push({
				name: "Model configured",
				ok: !!config.model,
				fix: "ock config model",
				warn: true,
			});

			const mcpConfig = config.mcp;
			if (mcpConfig) {
				const mcpServers = Object.keys(mcpConfig);
				const invalidMcp = mcpServers.filter((name) => {
					const server = mcpConfig[name];
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
			if (!quiet) {
				displayChecks(configChecks);
			}
		} catch {
			checks.push({
				name: "Valid opencode.json syntax and structure",
				ok: false,
				fix: "Fix opencode.json syntax or schema errors",
			});
			if (!quiet) {
				displayChecks([checks[checks.length - 1]]);
			}
		}
	}

	if (!quiet) {
		console.log();
		console.log(color.bold("  Agents"));
	}

	const agentDir = join(opencodeDir, "agent");
	const agentChecks: CheckResult[] = [];

	if (existsSync(agentDir)) {
		const agentFiles = readdirSync(agentDir).filter((f) => f.endsWith(".md"));

		agentChecks.push({
			name: `Agent files (${agentFiles.length} found)`,
			ok: agentFiles.length > 0,
			fix: "ock agent create",
		});

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
	if (!quiet) {
		displayChecks(agentChecks);
	}

	if (!quiet) {
		console.log();
		console.log(color.bold("  Skills"));
	}

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

		for (const folder of validSkills) {
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
	if (!quiet) {
		displayChecks(skillChecks);
	}

	if (!quiet) {
		console.log();
		console.log(color.bold("  Tools"));
	}

	const toolDir = join(opencodeDir, "tool");
	const toolChecks: CheckResult[] = [];

	if (existsSync(toolDir)) {
		const toolFiles = readdirSync(toolDir).filter((f) => f.endsWith(".ts"));

		toolChecks.push({
			name: `Custom tools (${toolFiles.length} found)`,
			ok: true,
		});

		for (const file of toolFiles) {
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
	if (!quiet) {
		displayChecks(toolChecks);
	}

	if (!quiet) {
		console.log();
		console.log(color.bold("  Bridge"));
	}

	if (!quiet) {
		if (bridgeHealth.level === "OK") {
			console.log(`  ${color.green("✓")} BRIDGE OK: canonical OMO runtime registration detected`);
		} else {
			for (const diagnostic of bridgeHealth.diagnostics) {
				const prefix = diagnostic.level === "ERROR" ? color.red("✗") : color.yellow("!");
				console.log(`  ${prefix} ${diagnostic.message}`);
				if (diagnostic.details && diagnostic.details.length > 0) {
					for (const detail of diagnostic.details.slice(0, 5)) {
						console.log(`    ${color.dim("→")} ${color.dim(detail)}`);
					}
					if (diagnostic.details.length > 5) {
						console.log(color.dim(`    ... and ${diagnostic.details.length - 5} more`));
					}
				}
			}
		}
	}

	const errors = checks.filter((c) => !c.ok && !c.warn);
	const warningCount =
		warnings.length +
		checks.filter((c) => !c.ok && c.warn).length +
		bridgeHealth.diagnostics.filter((diagnostic) => diagnostic.level === "WARN").length;
	const bridgeErrorCount = bridgeHealth.diagnostics.filter(
		(diagnostic) => diagnostic.level === "ERROR",
	).length;

	if (warnings.length > 0) {
		if (!quiet) {
			console.log();
			console.log(color.bold("  Warnings"));
			for (const warn of warnings.slice(0, 5)) {
				console.log(`  ${color.yellow("!")} ${warn.name}`);
			}
			if (warnings.length > 5) {
				console.log(color.dim(`    ... and ${warnings.length - 5} more`));
			}
		}
	}

	if (!quiet) {
		console.log();
	}

	if (errors.length === 0 && bridgeErrorCount === 0 && warningCount === 0) {
		if (!quiet) {
			p.outro(color.green("All checks passed!"));
		}
		process.exitCode = 0;
	} else if (errors.length === 0 && bridgeErrorCount === 0) {
		if (!quiet) {
			p.outro(
				color.yellow(
					`Passed with ${warningCount} warning${warningCount > 1 ? "s" : ""}`,
				),
			);
		}
		process.exitCode = 2;
	} else {
		if (!quiet) {
			p.outro(
				color.red(
					`${errors.length + bridgeErrorCount} error${errors.length + bridgeErrorCount > 1 ? "s" : ""}, ${warningCount} warning${warningCount > 1 ? "s" : ""}`,
				),
			);
		}
		process.exitCode = 1;
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
