import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import {
	notFound,
	requireOpencodePath,
	showEmpty,
	unknownAction,
} from "../utils/errors.js";
import { AgentActionSchema, parseAction } from "../utils/schemas.js";

interface AgentFrontmatter {
	mode?: string;
	description?: string;
	model?: string;
	tools?: string[];
}

interface AgentInfo {
	name: string;
	path: string;
	frontmatter: AgentFrontmatter;
	disabled?: boolean;
	configModel?: string;
}

export async function agentCommand(action?: string) {
	const validatedAction = parseAction(AgentActionSchema, action);

	const opencodePath = requireOpencodePath();

	if (!opencodePath) {
		return;
	}

	const agentPath = join(opencodePath, "agent");

	switch (validatedAction) {
		case "list":
			await listAgents(agentPath);
			break;

		case "create":
			await createAgent(agentPath);
			break;

		case "show": {
			const agentName = process.argv[4];
			await viewAgent(agentPath, agentName);
			break;
		}

		case "delete": {
			const agentName = process.argv[4];
			await removeAgent(agentPath, agentName);
			break;
		}

		case "edit":
			// TODO: Implement edit action
			unknownAction("edit", ["list", "create", "show", "delete"]);
			break;

		default:
			unknownAction(action ?? "", ["list", "create", "show", "delete", "edit"]);
	}
}

function parseFrontmatter(content: string): AgentFrontmatter {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};

	const frontmatter: AgentFrontmatter = {};
	const lines = match[1].split("\n");

	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const key = line.slice(0, colonIndex).trim();
			let value = line.slice(colonIndex + 1).trim();

			// Remove quotes
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			// Handle arrays (simple case)
			if (value.startsWith("[") && value.endsWith("]")) {
				const items = value
					.slice(1, -1)
					.split(",")
					.map((s) => s.trim().replace(/^["']|["']$/g, ""))
					.filter(Boolean);
				(frontmatter as Record<string, string | string[]>)[key] = items;
			} else {
				(frontmatter as Record<string, string>)[key] = value;
			}
		}
	}

	return frontmatter;
}

function collectAgents(agentPath: string): AgentInfo[] {
	if (!existsSync(agentPath)) return [];

	// Load opencode.json for agent configs
	const opencodePath = join(process.cwd(), ".opencode");
	const configPath = join(opencodePath, "opencode.json");
	let agentConfigs: Record<string, { model?: string; disable?: boolean }> = {};

	if (existsSync(configPath)) {
		try {
			const configContent = readFileSync(configPath, "utf-8");
			const config = JSON.parse(configContent);
			agentConfigs = config.agent || {};
		} catch {
			// Ignore parse errors
		}
	}

	const entries = readdirSync(agentPath);
	const agents: AgentInfo[] = [];

	for (const entry of entries) {
		const entryPath = join(agentPath, entry);
		if (!lstatSync(entryPath).isFile() || !entry.endsWith(".md")) continue;

		const name = entry.replace(".md", "");
		const content = readFileSync(entryPath, "utf-8");
		const frontmatter = parseFrontmatter(content);

		agents.push({
			name,
			path: entryPath,
			frontmatter,
			disabled: agentConfigs[name]?.disable,
			configModel: agentConfigs[name]?.model,
		});
	}

	return agents.sort((a, b) => a.name.localeCompare(b.name));
}

async function listAgents(agentPath: string) {
	const agents = collectAgents(agentPath);

	if (agents.length === 0) {
		showEmpty("agents", "ock agent create");
		return;
	}

	p.log.info(color.bold("Agents"));

	for (const agent of agents) {
		const model = agent.configModel || agent.frontmatter.model;
		const mode = agent.frontmatter.mode;

		const modeDisplay = mode ? color.yellow(`[${mode}]`) : "";
		const modelDisplay = model
			? color.dim(` → ${model}`)
			: color.dim(" → (default)");
		const disabledDisplay = agent.disabled ? color.red(" [disabled]") : "";
		const descDisplay = agent.frontmatter.description
			? color.dim(
					` - ${agent.frontmatter.description.slice(0, 40)}${agent.frontmatter.description.length > 40 ? "..." : ""}`,
				)
			: "";

		console.log(
			`  ${color.cyan("•")} ${agent.name} ${modeDisplay}${modelDisplay}${disabledDisplay}${descDisplay}`,
		);
	}

	console.log();
	p.log.info(
		color.dim(`Found ${agents.length} agent${agents.length === 1 ? "" : "s"}`),
	);
}

async function createAgent(agentPath: string) {
	p.intro(color.bgMagenta(color.black(" Create Agent ")));

	// Create agent directory if needed
	if (!existsSync(agentPath)) {
		mkdirSync(agentPath, { recursive: true });
	}

	const name = await p.text({
		message: "Agent name",
		placeholder: "e.g. reviewer, planner, researcher",
		validate: (value) => {
			if (!value) return "Name is required";
			if (!/^[a-z][a-z0-9-]*$/.test(value)) {
				return "Use lowercase letters, numbers, and hyphens only";
			}
			if (existsSync(join(agentPath, `${value}.md`))) {
				return "Agent already exists";
			}
			return undefined;
		},
	});

	if (p.isCancel(name)) {
		p.cancel("Cancelled");
		return;
	}

	const description = await p.text({
		message: "Description (what does this agent do?)",
		placeholder: "Reviews code for security issues and best practices",
		validate: (value) => {
			if (!value) return "Description is required";
			return undefined;
		},
	});

	if (p.isCancel(description)) {
		p.cancel("Cancelled");
		return;
	}

	const mode = await p.select({
		message: "Agent mode",
		options: [
			{
				value: "subagent",
				label: "subagent",
				hint: "Invoked by primary agents via Task tool",
			},
			{
				value: "primary",
				label: "primary",
				hint: "Main agent that orchestrates work",
			},
			{
				value: "all",
				label: "all",
				hint: "Can be used in both modes",
			},
		],
	});

	if (p.isCancel(mode)) {
		p.cancel("Cancelled");
		return;
	}

	const toolsInput = await p.text({
		message: "Tools this agent can use (comma-separated, or empty for all)",
		placeholder: "read, glob, grep, bash",
	});

	if (p.isCancel(toolsInput)) {
		p.cancel("Cancelled");
		return;
	}

	const tools = toolsInput
		? String(toolsInput)
				.split(",")
				.map((t) => t.trim())
				.filter(Boolean)
		: [];

	// Build frontmatter
	const frontmatterLines = [`mode: ${mode}`, `description: "${description}"`];

	if (tools.length > 0) {
		frontmatterLines.push(`tools: [${tools.map((t) => `"${t}"`).join(", ")}]`);
	}

	const displayName = String(name)
		.split("-")
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");

	const template = `---
${frontmatterLines.join("\n")}
---

# ${displayName} Agent

${description}

## Role

Describe the specific role and responsibilities of this agent.

## Capabilities

- Capability 1
- Capability 2
- Capability 3

## Instructions

Provide specific instructions for how this agent should behave:

1. First, understand the context
2. Then, analyze the problem
3. Finally, provide a solution

## Constraints

- What this agent should NOT do
- Boundaries and limitations

## Output Format

Describe the expected output format for this agent.
`;

	const agentFile = join(agentPath, `${name}.md`);
	writeFileSync(agentFile, template);

	p.log.success(`Created ${color.cyan(`.opencode/agent/${name}.md`)}`);

	if (mode === "primary") {
		p.note(
			`Add to opencode.json:\n\n"agent": {\n  "${name}": {\n    "model": "claude-sonnet-4-20250514"\n  }\n}`,
			"Configure model (optional)",
		);
	}

	p.outro(color.green("Done! Edit the file to customize."));
}

async function viewAgent(agentPath: string, agentNameArg?: string) {
	const agents = collectAgents(agentPath);

	if (agents.length === 0) {
		showEmpty("agents", "ock agent create");
		return;
	}

	let agentName = agentNameArg;
	if (!agentName) {
		const options = agents.map((a) => ({
			value: a.name,
			label: a.name,
			hint: a.frontmatter.description || "",
		}));

		const selected = await p.select({
			message: "Select agent to view",
			options,
		});

		if (p.isCancel(selected)) {
			return;
		}

		agentName = selected as string;
	}

	const agent = agents.find((a) => a.name === agentName);

	if (!agent) {
		notFound("Agent", agentName);
		return;
	}

	const content = readFileSync(agent.path, "utf-8");
	console.log();
	console.log(color.dim("─".repeat(60)));
	console.log(content);
	console.log(color.dim("─".repeat(60)));
}

async function removeAgent(agentPath: string, agentNameArg?: string) {
	const agents = collectAgents(agentPath);

	if (agents.length === 0) {
		showEmpty("agents", "ock agent create");
		return;
	}

	let agentName = agentNameArg;
	if (!agentName) {
		const options = agents.map((a) => ({
			value: a.name,
			label: a.name,
			hint: a.frontmatter.description || "",
		}));

		const selected = await p.select({
			message: "Select agent to remove",
			options,
		});

		if (p.isCancel(selected)) {
			return;
		}

		agentName = selected as string;
	}

	const agent = agents.find((a) => a.name === agentName);

	if (!agent) {
		notFound("Agent", agentName);
		return;
	}

	const confirm = await p.confirm({
		message: `Remove agent "${agent.name}"?`,
		initialValue: false,
	});

	if (p.isCancel(confirm) || !confirm) {
		p.cancel("Cancelled");
		return;
	}

	unlinkSync(agent.path);
	p.log.success(`Removed agent "${agent.name}"`);

	// Check if agent is configured in opencode.json
	const opencodePath = join(process.cwd(), ".opencode");
	const configPath = join(opencodePath, "opencode.json");
	if (existsSync(configPath)) {
		try {
			const configContent = readFileSync(configPath, "utf-8");
			const config = JSON.parse(configContent);
			if (config.agent?.[agent.name]) {
				p.log.warn(
					color.yellow(
						`Note: Agent "${agent.name}" is still configured in opencode.json`,
					),
				);
			}
		} catch {
			// Ignore
		}
	}
}
