import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import * as p from "@clack/prompts";
import { parse } from "jsonc-parser";
import color from "picocolors";
import { z } from "zod";
import { getBridgeHealthReport } from "../utils/bridge-diagnostics.js";
import { requireOpencodePath, showWarning } from "../utils/errors.js";

const StatusConfigSchema = z.object({
	mcp: z.record(z.string(), z.unknown()).optional(),
}).catchall(z.unknown());

export async function statusCommand() {
	const quiet = process.argv.includes("--quiet");

	const cwd = process.cwd();
	const opencodeDir = requireOpencodePath();

	if (!opencodeDir) {
		return;
	}

	const projectName = basename(cwd);
	const bridgeHealth = getBridgeHealthReport(opencodeDir);

	if (!quiet) {
		p.intro(color.bgCyan(color.black(` ${projectName} `)));
	}

	const agentDir = join(opencodeDir, "agent");
	let agentNames: string[] = [];
	if (existsSync(agentDir)) {
		agentNames = readdirSync(agentDir)
			.filter((f) => f.endsWith(".md") && lstatSync(join(agentDir, f)).isFile())
			.map((f) => f.replace(".md", ""));
	}

	const skillDir = join(opencodeDir, "skill");
	let skillCount = 0;
	if (existsSync(skillDir)) {
		skillCount = readdirSync(skillDir).filter(
			(f) =>
				lstatSync(join(skillDir, f)).isDirectory() &&
				existsSync(join(skillDir, f, "SKILL.md")),
		).length;
	}

	const commandDir = join(opencodeDir, "command");
	let commandCount = 0;
	if (existsSync(commandDir)) {
		commandCount = readdirSync(commandDir).filter((f) =>
			f.endsWith(".md"),
		).length;
	}

	const toolDir = join(opencodeDir, "tool");
	let toolCount = 0;
	if (existsSync(toolDir)) {
		toolCount = readdirSync(toolDir).filter((f) => f.endsWith(".ts")).length;
	}

	const configPath = join(opencodeDir, "opencode.json");
	let mcpCount = 0;
	if (existsSync(configPath)) {
		try {
			const configContent = readFileSync(configPath, "utf-8");
			const parseErrors: NonNullable<Parameters<typeof parse>[1]> = [];
			const parsedConfig = parse(configContent, parseErrors);
			if (parseErrors.length > 0) {
				throw new Error(`Invalid JSONC in ${configPath}`);
			}
			const config = StatusConfigSchema.parse(parsedConfig);
			if (config.mcp) {
				mcpCount = Object.keys(config.mcp).length;
			}
		} catch (error) {
			if (!quiet) {
				showWarning(
					"Invalid opencode.json",
					error instanceof Error ? error.message : "Failed to parse OpenCode config",
				)
			}
		}
	}

	if (!quiet) {
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
		console.log(`  ${color.bold("Bridge Health")}  ${color.cyan(bridgeHealth.level)}`);
		console.log();

		if (bridgeHealth.level !== "OK") {
			for (const diagnostic of bridgeHealth.diagnostics) {
				console.log(`  ${diagnostic.message}`);
			}
			console.log();
		}
	}

	if (!existsSync(join(opencodeDir, "node_modules"))) {
		if (!quiet) {
			showWarning("Dependencies not installed", "cd .opencode && npm install");
		}
	}

	if (!quiet) {
		p.outro(color.dim(".opencode/"));
	}
}
