import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import color from "picocolors";

export interface CheckResult {
	name: string;
	ok: boolean;
	fix?: string;
	warn?: boolean;
}

export const KNOWN_CONFIG_PROPERTIES = new Set([
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

export function collectDoctorSectionChecks(
	opencodeDir: string,
	warnings: CheckResult[],
) {
	const structureChecks: CheckResult[] = [
		{ name: ".opencode/ exists", ok: existsSync(opencodeDir), fix: "ock init" },
		{
			name: "opencode.json exists",
			ok: existsSync(join(opencodeDir, "opencode.json")),
			fix: "ock init --force",
		},
		{
			name: "package.json exists",
			ok: existsSync(join(opencodeDir, "package.json")),
			fix: "ock init --force",
		},
		{
			name: "Dependencies installed",
			ok: existsSync(join(opencodeDir, "node_modules")),
			fix: "cd .opencode && npm install",
		},
	];

	return {
		structureChecks,
		configurationChecks: collectConfigurationChecks(opencodeDir, warnings),
		agentChecks: collectAgentChecks(opencodeDir, warnings),
		skillChecks: collectSkillChecks(opencodeDir, warnings),
		toolChecks: collectToolChecks(opencodeDir, warnings),
	};
}

function collectConfigurationChecks(
	opencodeDir: string,
	warnings: CheckResult[],
): CheckResult[] {
	const configPath = join(opencodeDir, "opencode.json");
	if (!existsSync(configPath)) {
		return [];
	}

	try {
		const config = JSON.parse(readFileSync(configPath, "utf-8")) as Record<
			string,
			unknown
		>;
		const checks: CheckResult[] = [
			{
				name: "$schema reference",
				ok: !!config.$schema,
				fix: 'Add "$schema": "https://opencode.ai/config.json"',
				warn: true,
			},
			{
				name: "Model configured",
				ok: !!config.model,
				fix: "ock config model",
				warn: true,
			},
		];

		const unknownProps = Object.keys(config).filter(
			(key) => !KNOWN_CONFIG_PROPERTIES.has(key),
		);
		if (unknownProps.length > 0) {
			warnings.push({
				name: `Unknown config properties: ${unknownProps.join(", ")}`,
				ok: false,
				warn: true,
			});
		}

		if (
			config.mcp &&
			typeof config.mcp === "object" &&
			!Array.isArray(config.mcp)
		) {
			const invalidMcp = Object.entries(config.mcp)
				.filter(([, server]) => {
					return (
						typeof server !== "object" ||
						server === null ||
						(!Object.hasOwn(server, "command") && !Object.hasOwn(server, "url"))
					);
				})
				.map(([name]) => name);
			checks.push({
				name: `MCP servers (${Object.keys(config.mcp).length} configured)`,
				ok: invalidMcp.length === 0,
				fix:
					invalidMcp.length > 0
						? `Fix: ${invalidMcp.join(", ")} need command or url`
						: undefined,
			});
		}

		if (
			config.agent &&
			typeof config.agent === "object" &&
			!Array.isArray(config.agent)
		) {
			const agentDir = join(opencodeDir, "agent");
			const missingFiles = Object.keys(config.agent).filter(
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

		return checks;
	} catch {
		return [
			{
				name: "Valid JSON syntax",
				ok: false,
				fix: "Fix JSON syntax errors in opencode.json",
			},
		];
	}
}

function collectAgentChecks(
	opencodeDir: string,
	warnings: CheckResult[],
): CheckResult[] {
	const agentDir = join(opencodeDir, "agent");
	if (!existsSync(agentDir)) {
		return [{ name: "agent/ directory", ok: false, fix: "ock agent create" }];
	}

	const agentFiles = readdirSync(agentDir).filter((file) =>
		file.endsWith(".md"),
	);
	for (const file of agentFiles) {
		const content = readFileSync(join(agentDir, file), "utf-8");
		if (!content.startsWith("---")) {
			warnings.push({
				name: `${file}: Missing frontmatter`,
				ok: false,
				warn: true,
			});
		} else if (!content.includes("mode:")) {
			warnings.push({
				name: `${file}: Missing mode in frontmatter`,
				ok: false,
				warn: true,
			});
		}
	}

	return [
		{
			name: `Agent files (${agentFiles.length} found)`,
			ok: agentFiles.length > 0,
			fix: "ock agent create",
		},
	];
}

function collectSkillChecks(
	opencodeDir: string,
	warnings: CheckResult[],
): CheckResult[] {
	const skillDir = join(opencodeDir, "skill");
	if (!existsSync(skillDir)) {
		return [
			{
				name: "skill/ directory",
				ok: false,
				fix: "ock skill create",
				warn: true,
			},
		];
	}

	const skillFolders = readdirSync(skillDir).filter((entry) =>
		lstatSync(join(skillDir, entry)).isDirectory(),
	);
	const validSkills = skillFolders.filter((folder) =>
		existsSync(join(skillDir, folder, "SKILL.md")),
	);
	const invalidFolders = skillFolders.filter(
		(folder) => !existsSync(join(skillDir, folder, "SKILL.md")),
	);
	if (invalidFolders.length > 0) {
		warnings.push({
			name: `Skill folders missing SKILL.md: ${invalidFolders.slice(0, 3).join(", ")}${invalidFolders.length > 3 ? "..." : ""}`,
			ok: false,
			warn: true,
		});
	}

	for (const folder of validSkills.slice(0, 5)) {
		const content = readFileSync(join(skillDir, folder, "SKILL.md"), "utf-8");
		if (
			!content.startsWith("---") ||
			!content.includes("name:") ||
			!content.includes("description:")
		) {
			warnings.push({
				name: `${folder}: Missing required frontmatter (name, description)`,
				ok: false,
				warn: true,
			});
		}
	}

	return [
		{
			name: `Skills (${validSkills.length} valid)`,
			ok: validSkills.length > 0,
			fix: "ock skill create",
		},
	];
}

function collectToolChecks(
	opencodeDir: string,
	warnings: CheckResult[],
): CheckResult[] {
	const toolDir = join(opencodeDir, "tool");
	if (!existsSync(toolDir)) {
		return [{ name: "tool/ directory (optional)", ok: true }];
	}

	const toolFiles = readdirSync(toolDir).filter((file) => file.endsWith(".ts"));
	for (const file of toolFiles.slice(0, 5)) {
		const content = readFileSync(join(toolDir, file), "utf-8");
		const hasExport =
			content.includes("export default") || content.includes("export const");
		if (!hasExport || !content.includes("tool(")) {
			warnings.push({
				name: `${file}: Missing tool() export`,
				ok: false,
				warn: true,
			});
		}
	}

	return [{ name: `Custom tools (${toolFiles.length} found)`, ok: true }];
}

export function displayChecks(checks: CheckResult[]) {
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
