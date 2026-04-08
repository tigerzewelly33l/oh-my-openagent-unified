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
import { CommandActionSchema, parseAction } from "../utils/schemas.js";

interface CommandFrontmatter {
	description?: string;
	"argument-hint"?: string;
	agent?: string;
	subtask?: boolean;
	model?: string;
}

export async function commandCommand(action?: string) {
	const validatedAction = parseAction(CommandActionSchema, action);

	const opencodePath = requireOpencodePath();

	if (!opencodePath) {
		return;
	}

	const commandDir = join(opencodePath, "command");

	switch (validatedAction) {
		case "list":
			listCommands(commandDir);
			break;

		case "create":
			await createCommand(commandDir);
			break;

		case "show": {
			const cmdName = process.argv[4];
			await viewCommand(commandDir, cmdName);
			break;
		}

		case "delete": {
			const cmdName = process.argv[4];
			await removeCommand(commandDir, cmdName);
			break;
		}

		default:
			unknownAction(action ?? "", ["list", "create", "show", "delete"]);
	}
}

function parseFrontmatter(content: string): {
	frontmatter: CommandFrontmatter;
	body: string;
} {
	const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) {
		return { frontmatter: {}, body: content };
	}

	const frontmatter: CommandFrontmatter = {};
	const lines = match[1].split("\n");

	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0) {
			const key = line.slice(0, colonIndex).trim();
			let value: string | boolean = line.slice(colonIndex + 1).trim();

			// Remove quotes
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}

			// Parse boolean
			if (value === "true") value = true as unknown as string;
			if (value === "false") value = false as unknown as string;

			(frontmatter as Record<string, string | boolean>)[key] = value;
		}
	}

	return { frontmatter, body: match[2] };
}

function listCommands(commandDir: string) {
	if (!existsSync(commandDir)) {
		showEmpty("slash commands", "ock command create");
		return;
	}

	const files = readdirSync(commandDir).filter((f) => f.endsWith(".md"));

	if (files.length === 0) {
		showEmpty("slash commands", "ock command create");
		return;
	}

	p.log.info(color.bold("Slash Commands"));

	for (const file of files.sort()) {
		const name = basename(file, ".md");
		const content = readFileSync(join(commandDir, file), "utf-8");
		const { frontmatter } = parseFrontmatter(content);

		const agent = frontmatter.agent
			? color.dim(`[${frontmatter.agent}]`)
			: color.dim("[build]");
		const desc = frontmatter.description
			? color.dim(` - ${frontmatter.description}`)
			: "";
		const hint = frontmatter["argument-hint"]
			? color.yellow(` ${frontmatter["argument-hint"]}`)
			: "";
		const subtask = frontmatter.subtask ? color.magenta(" (subtask)") : "";

		console.log(`  ${color.cyan(`/${name}`)}${hint}${subtask} ${agent}${desc}`);
	}

	console.log();
	p.log.info(
		color.dim(`Found ${files.length} command${files.length === 1 ? "" : "s"}`),
	);
}

async function createCommand(commandDir: string) {
	p.intro(color.bgCyan(color.black(" Create Slash Command ")));

	// Ensure directory exists
	if (!existsSync(commandDir)) {
		mkdirSync(commandDir, { recursive: true });
	}

	const name = await p.text({
		message: "Command name (without /)",
		placeholder: "my-command",
		validate: (value) => {
			if (!value) return "Name is required";
			if (!/^[a-z][a-z0-9-]*$/.test(value)) {
				return "Use lowercase letters, numbers, and hyphens only";
			}
			if (existsSync(join(commandDir, `${value}.md`))) {
				return "Command already exists";
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
		placeholder: "What does this command do?",
	});

	if (p.isCancel(description)) {
		p.cancel("Cancelled");
		return;
	}

	const agent = await p.select({
		message: "Which agent runs this command?",
		options: [
			{ value: "build", label: "build", hint: "Implementation work" },
			{ value: "planner", label: "planner", hint: "Architecture & design" },
			{ value: "scout", label: "scout", hint: "External research" },
			{ value: "explore", label: "explore", hint: "Codebase search" },
			{ value: "review", label: "review", hint: "Code review & debugging" },
			{ value: "vision", label: "vision", hint: "UI/UX & visual analysis" },
		],
	});

	if (p.isCancel(agent)) {
		p.cancel("Cancelled");
		return;
	}

	const argumentHint = await p.text({
		message: "Argument hint (optional)",
		placeholder: "<required> [optional]",
	});

	if (p.isCancel(argumentHint)) {
		p.cancel("Cancelled");
		return;
	}

	const isSubtask = await p.confirm({
		message: "Run as subtask? (doesn't pollute primary context)",
		initialValue: false,
	});

	if (p.isCancel(isSubtask)) {
		p.cancel("Cancelled");
		return;
	}

	// Build frontmatter
	const frontmatterLines = [`description: "${description}"`];

	if (argumentHint) {
		frontmatterLines.push(`argument-hint: "${argumentHint}"`);
	}

	frontmatterLines.push(`agent: ${agent}`);

	if (isSubtask) {
		frontmatterLines.push("subtask: true");
	}

	const template = `---
${frontmatterLines.join("\n")}
---

# ${String(name).charAt(0).toUpperCase() + String(name).slice(1).replace(/-/g, " ")}: $ARGUMENTS

${description}

## Context

\`\`\`typescript
// Load any required skills
// skill({ name: "example" });
\`\`\`

## Instructions

<!-- Add your command instructions here -->

1. Step one
2. Step two
3. Step three

## Output

<!-- Define expected output format -->
`;

	const filePath = join(commandDir, `${name}.md`);
	writeFileSync(filePath, template);

	p.outro(color.green(`Created /${name} at .opencode/command/${name}.md`));
}

async function viewCommand(commandDir: string, cmdNameArg?: string) {
	if (!existsSync(commandDir)) {
		showEmpty("slash commands", "ock command create");
		return;
	}

	const files = readdirSync(commandDir).filter((f) => f.endsWith(".md"));

	if (files.length === 0) {
		showEmpty("slash commands", "ock command create");
		return;
	}

	let cmdName = cmdNameArg;
	if (!cmdName) {
		const options = files.sort().map((f) => {
			const name = basename(f, ".md");
			const content = readFileSync(join(commandDir, f), "utf-8");
			const { frontmatter } = parseFrontmatter(content);
			return {
				value: name,
				label: `/${name}`,
				hint: frontmatter.description || "",
			};
		});

		const selected = await p.select({
			message: "Select command to view",
			options,
		});

		if (p.isCancel(selected)) {
			return;
		}

		cmdName = selected as string;
	}

	// Remove leading / if present
	if (cmdName.startsWith("/")) {
		cmdName = cmdName.slice(1);
	}

	const filePath = join(commandDir, `${cmdName}.md`);

	if (!existsSync(filePath)) {
		p.log.error(`Command /${cmdName} not found`);
		return;
	}

	const content = readFileSync(filePath, "utf-8");
	console.log();
	console.log(color.dim("─".repeat(60)));
	console.log(content);
	console.log(color.dim("─".repeat(60)));
}

async function removeCommand(commandDir: string, cmdNameArg?: string) {
	if (!existsSync(commandDir)) {
		showEmpty("slash commands", "ock command create");
		return;
	}

	const files = readdirSync(commandDir).filter((f) => f.endsWith(".md"));

	if (files.length === 0) {
		showEmpty("slash commands", "ock command create");
		return;
	}

	let cmdName = cmdNameArg;
	if (!cmdName) {
		const options = files.sort().map((f) => {
			const name = basename(f, ".md");
			const content = readFileSync(join(commandDir, f), "utf-8");
			const { frontmatter } = parseFrontmatter(content);
			return {
				value: name,
				label: `/${name}`,
				hint: frontmatter.description || "",
			};
		});

		const selected = await p.select({
			message: "Select command to remove",
			options,
		});

		if (p.isCancel(selected)) {
			return;
		}

		cmdName = selected as string;
	}

	// Remove leading / if present
	if (cmdName.startsWith("/")) {
		cmdName = cmdName.slice(1);
	}

	const filePath = join(commandDir, `${cmdName}.md`);

	if (!existsSync(filePath)) {
		p.log.error(`Command /${cmdName} not found`);
		return;
	}

	const confirm = await p.confirm({
		message: `Remove /${cmdName}?`,
		initialValue: false,
	});

	if (p.isCancel(confirm) || !confirm) {
		p.cancel("Cancelled");
		return;
	}

	unlinkSync(filePath);
	p.log.success(`Removed /${cmdName}`);
}
