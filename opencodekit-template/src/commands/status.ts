import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import { requireOpencodePath, showWarning } from "../utils/errors.js";
import {
	getBeadsRuntimeHealthReport,
	getBridgeHealthReport,
} from "./bridge-diagnostics.js";
import { createMachineReadableDiagnosticsPayload } from "./diagnostic-codes.js";

function renderHealthLevel(level: "OK" | "WARN" | "ERROR"): string {
	return level === "OK"
		? color.green(level)
		: level === "WARN"
			? color.yellow(level)
			: color.red(level);
}

export interface StatusCommandOptions {
	json?: boolean;
}

interface StatusContext {
	projectName: string;
	agentNames: string[];
	skillCount: number;
	commandCount: number;
	toolCount: number;
	mcpCount: number;
	bridgeHealth: ReturnType<typeof getBridgeHealthReport>;
	beadsRuntimeHealth: ReturnType<typeof getBeadsRuntimeHealthReport>;
}

export async function statusCommand(options: StatusCommandOptions = {}) {
	if (process.argv.includes("--quiet")) return;

	const cwd = process.cwd();
	const opencodeDir = requireOpencodePath();

	if (!opencodeDir) {
		return;
	}

	const projectName = basename(cwd);
	const bridgeHealth = getBridgeHealthReport(opencodeDir);
	const beadsRuntimeHealth = getBeadsRuntimeHealthReport({
		projectDir: cwd,
		opencodeDir,
	});

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
			const config = JSON.parse(readFileSync(configPath, "utf-8"));
			mcpCount = Object.keys(config.mcp || {}).length;
		} catch {
			// Ignore
		}
	}

	const status = {
		projectName,
		agentNames,
		skillCount,
		commandCount,
		toolCount,
		mcpCount,
		bridgeHealth,
		beadsRuntimeHealth,
	} satisfies StatusContext;

	if (options.json) {
		renderStatusJson(status);
		return;
	}

	p.intro(color.bgCyan(color.black(` ${projectName} `)));

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
	console.log(
		`  ${color.bold("Bridge Health")}  ${color.cyan(bridgeHealth.level)}`,
	);
	console.log();

	if (bridgeHealth.level !== "OK") {
		for (const diagnostic of bridgeHealth.diagnostics) {
			console.log(`  ${diagnostic.message}`);
		}
		console.log();
	}

	console.log(
		`  ${color.bold("Beads Runtime")}  ${renderHealthLevel(beadsRuntimeHealth.level)}`,
	);
	for (const check of beadsRuntimeHealth.checks) {
		console.log(
			`  ${color.dim("•")} ${color.bold(check.name)}  ${renderHealthLevel(check.level)}`,
		);
		console.log(`    ${check.message}`);
		if (check.details && check.details.length > 0) {
			for (const detail of check.details.slice(0, 3)) {
				console.log(`    ${color.dim("→")} ${color.dim(detail)}`);
			}
		}
	}
	console.log();

	if (!existsSync(join(opencodeDir, "node_modules"))) {
		showWarning("Dependencies not installed", "cd .opencode && npm install");
	}

	p.outro(color.dim(".opencode/"));
}

function renderStatusJson(status: StatusContext) {
	const payload = createMachineReadableDiagnosticsPayload({
		surface: "status",
		mode: "health",
		checks: [
			...status.bridgeHealth.diagnostics,
			...status.beadsRuntimeHealth.checks,
		],
	});
	console.log(
		JSON.stringify(
			{
				...payload,
				project: {
					name: status.projectName,
					agents: status.agentNames,
					skillCount: status.skillCount,
					commandCount: status.commandCount,
					toolCount: status.toolCount,
					mcpCount: status.mcpCount,
				},
			},
			null,
			2,
		),
	);
}
