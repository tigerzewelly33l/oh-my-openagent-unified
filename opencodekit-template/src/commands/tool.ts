import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import { requireOpencodePath, showEmpty, unknownAction } from "../utils/errors.js";
import { ToolActionSchema, parseAction } from "../utils/schemas.js";

interface ToolInfo {
	name: string;
	path: string;
	description: string;
}

export async function toolCommand(action?: string) {
	const validatedAction = parseAction(ToolActionSchema, action);

	const opencodePath = requireOpencodePath();
	if (!opencodePath) return;

	const toolDir = join(opencodePath, "tool");

	switch (validatedAction) {
		case "list":
			listTools(toolDir);
			break;

		case "create":
			await createTool(toolDir);
			break;

		case "show": {
			const toolName = process.argv[4];
			await viewTool(toolDir, toolName);
			break;
		}

		case "edit": {
			const toolName = process.argv[4];
			p.log.info(`Edit tool: ${toolName} (not yet implemented)`);
			break;
		}

		case "delete": {
			const toolName = process.argv[4];
			await removeTool(toolDir, toolName);
			break;
		}

		default:
			unknownAction(action ?? "(none)", [
				"list",
				"show",
				"create",
				"edit",
				"delete",
			]);
	}
}

function extractDescription(content: string): string {
	// Try to extract description from tool({ description: "..." })
	const match = content.match(/description:\s*["'`]([^"'`]+)["'`]/);
	if (match) {
		return match[1].slice(0, 80) + (match[1].length > 80 ? "..." : "");
	}

	// Try multiline description
	const multiMatch = content.match(/description:\s*\n?\s*["'`]([^"'`]+)["'`]/);
	if (multiMatch) {
		return (
			multiMatch[1].slice(0, 80) + (multiMatch[1].length > 80 ? "..." : "")
		);
	}

	return "";
}

function collectTools(toolDir: string): ToolInfo[] {
	const tools: ToolInfo[] = [];

	if (!existsSync(toolDir)) return tools;

	const files = readdirSync(toolDir).filter((f) => f.endsWith(".ts"));

	for (const file of files) {
		const filePath = join(toolDir, file);
		const content = readFileSync(filePath, "utf-8");
		const name = basename(file, ".ts");
		const description = extractDescription(content);

		tools.push({
			name,
			path: filePath,
			description,
		});
	}

	return tools.sort((a, b) => a.name.localeCompare(b.name));
}

function listTools(toolDir: string) {
	const tools = collectTools(toolDir);

	if (tools.length === 0) {
		showEmpty("custom tools", "ock tool create");
		return;
	}

	p.log.info(color.bold("Custom Tools"));

	for (const tool of tools) {
		const desc = tool.description ? color.dim(` - ${tool.description}`) : "";
		console.log(`  ${color.cyan(tool.name)}${desc}`);
	}

	console.log();
	p.log.info(
		color.dim(
			`Found ${tools.length} tool${tools.length === 1 ? "" : "s"} in .opencode/tool/`,
		),
	);
}

async function createTool(toolDir: string) {
	p.intro(color.bgMagenta(color.white(" Create Custom Tool ")));

	// Ensure directory exists
	if (!existsSync(toolDir)) {
		mkdirSync(toolDir, { recursive: true });
	}

	const name = await p.text({
		message: "Tool name",
		placeholder: "my-tool",
		validate: (value) => {
			if (!value) return "Name is required";
			if (!/^[a-z][a-z0-9-]*$/.test(value)) {
				return "Use lowercase letters, numbers, and hyphens only";
			}
			if (existsSync(join(toolDir, `${value}.ts`))) {
				return "Tool already exists";
			}
			return undefined;
		},
	});

	if (p.isCancel(name)) {
		p.cancel("Cancelled");
		return;
	}

	const description = await p.text({
		message: "Description",
		placeholder: "What does this tool do?",
		validate: (value) => {
			if (!value) return "Description is required";
			return undefined;
		},
	});

	if (p.isCancel(description)) {
		p.cancel("Cancelled");
		return;
	}

	const hasArgs = await p.confirm({
		message: "Does this tool accept arguments?",
		initialValue: true,
	});

	if (p.isCancel(hasArgs)) {
		p.cancel("Cancelled");
		return;
	}

	// Generate tool template
	const argsSection = hasArgs
		? `args: {
		input: tool.schema
			.string()
			.describe("The input parameter"),
	},`
		: "args: {},";

	const executeParams = hasArgs
		? "args: { input: string }"
		: "_args: Record<string, never>";
	const executeBody = hasArgs
		? `const { input } = args;
		
		// TODO: Implement your tool logic here
		
		return \`Processed: \${input}\`;`
		: `// TODO: Implement your tool logic here
		
		return "Tool executed successfully";`;

	const template = `import { tool } from "@opencode-ai/plugin";

/**
 * ${description}
 */
export default tool({
	description: "${description}",
	${argsSection}
	execute: async (${executeParams}) => {
		${executeBody}
	},
});
`;

	const filePath = join(toolDir, `${name}.ts`);
	writeFileSync(filePath, template);

	p.outro(color.green(`Created ${name} at .opencode/tool/${name}.ts`));

	console.log();
	p.log.info(color.dim("Next steps:"));
	console.log(color.dim("  1. Edit the tool file to implement your logic"));
	console.log(
		color.dim("  2. The tool will be available in OpenCode automatically"),
	);
}

async function viewTool(toolDir: string, toolNameArg?: string) {
	const tools = collectTools(toolDir);

	if (tools.length === 0) {
		showEmpty("custom tools", "ock tool create");
		return;
	}

	let toolName = toolNameArg;
	if (!toolName) {
		const options = tools.map((t) => ({
			value: t.name,
			label: t.name,
			hint: t.description || "",
		}));

		const selected = await p.select({
			message: "Select tool to view",
			options,
		});

		if (p.isCancel(selected)) {
			return;
		}

		toolName = selected as string;
	}

	const tool = tools.find((t) => t.name === toolName);

	if (!tool) {
		p.log.error(`Tool "${toolName}" not found`);
		return;
	}

	const content = readFileSync(tool.path, "utf-8");

	console.log();
	console.log(color.dim("─".repeat(60)));
	console.log(content);
	console.log(color.dim("─".repeat(60)));
}

async function removeTool(toolDir: string, toolNameArg?: string) {
	const tools = collectTools(toolDir);

	if (tools.length === 0) {
		showEmpty("custom tools", "ock tool create");
		return;
	}

	let toolName = toolNameArg;
	if (!toolName) {
		const options = tools.map((t) => ({
			value: t.name,
			label: t.name,
			hint: t.description || "",
		}));

		const selected = await p.select({
			message: "Select tool to remove",
			options,
		});

		if (p.isCancel(selected)) {
			return;
		}

		toolName = selected as string;
	}

	const tool = tools.find((t) => t.name === toolName);

	if (!tool) {
		p.log.error(`Tool "${toolName}" not found`);
		return;
	}

	const confirm = await p.confirm({
		message: `Remove tool "${tool.name}"?`,
		initialValue: false,
	});

	if (p.isCancel(confirm) || !confirm) {
		p.cancel("Cancelled");
		return;
	}

	unlinkSync(tool.path);
	p.log.success(`Removed tool "${tool.name}"`);
}
