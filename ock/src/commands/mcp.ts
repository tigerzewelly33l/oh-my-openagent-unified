import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import { requireOpencodePath, showEmpty, unknownAction } from "../utils/errors.js";
import { McpActionSchema, parseAction } from "../utils/schemas.js";

interface MCPServer {
	type?: "local" | "remote";
	command?: string[];
	url?: string;
	enabled?: boolean;
	env?: Record<string, string>;
}

interface OpenCodeConfig {
	mcp?: Record<string, MCPServer>;
	[key: string]: unknown;
}

export async function mcpCommand(action?: string) {
	const validatedAction = parseAction(McpActionSchema, action);

	const opencodePath = requireOpencodePath();
	if (!opencodePath) return;

	const configPath = join(opencodePath, "opencode.json");

	switch (validatedAction) {
		case "list":
			await listMCP(configPath);
			break;

		case "add":
			await addMCP(configPath);
			break;

		case "remove": {
			const serverName = process.argv[4];
			await removeMCP(configPath, serverName);
			break;
		}

		case "toggle": {
			const serverName = process.argv[4];
			await toggleMCP(configPath, serverName);
			break;
		}

		default:
			unknownAction(action ?? "undefined", ["list", "add", "remove", "toggle"]);
			return;
	}
}

function loadConfig(configPath: string): OpenCodeConfig {
	if (!existsSync(configPath)) {
		return {};
	}
	try {
		const content = readFileSync(configPath, "utf-8");
		return JSON.parse(content);
	} catch {
		return {};
	}
}

function saveConfig(configPath: string, config: OpenCodeConfig): void {
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

async function listMCP(configPath: string) {
	const config = loadConfig(configPath);

	if (!config.mcp || Object.keys(config.mcp).length === 0) {
		showEmpty("MCP servers", "ock mcp add");
		return;
	}

	p.log.info(color.bold("MCP Servers"));

	for (const [name, server] of Object.entries(config.mcp)) {
		const status =
			server.enabled === false ? color.red("off") : color.green("on");
		const type =
			server.type === "remote" ? color.dim("remote") : color.dim("local");
		const endpoint =
			server.type === "remote"
				? color.dim(` → ${server.url}`)
				: color.dim(` → ${(server.command || []).join(" ")}`);

		console.log(`  ${status} ${color.cyan(name)} ${type}${endpoint}`);
	}
}

async function addMCP(configPath: string) {
	p.intro(color.bgCyan(color.black(" Add MCP Server ")));

	const config = loadConfig(configPath);

	if (!config.mcp) {
		config.mcp = {};
	}

	const name = await p.text({
		message: "Server name",
		placeholder: "e.g. my-server",
		validate: (value) => {
			if (!value) return "Name is required";
			if (!/^[a-z][a-z0-9-]*$/.test(value)) {
				return "Use lowercase letters, numbers, and hyphens only";
			}
			if (config.mcp?.[value]) return "Server already exists";
		},
	});

	if (p.isCancel(name)) {
		p.cancel("Cancelled");
		return;
	}

	const serverType = await p.select({
		message: "Server type",
		options: [
			{
				value: "local" as const,
				label: "Local (command)",
				hint: "runs a local process",
			},
			{
				value: "remote" as const,
				label: "Remote (URL)",
				hint: "connects to remote server",
			},
		],
	});

	if (p.isCancel(serverType)) {
		p.cancel("Cancelled");
		return;
	}

	const serverName = name as string;

	if (serverType === "remote") {
		const url = await p.text({
			message: "Server URL",
			placeholder: "https://example.com/mcp",
			validate: (value) => {
				if (!value) return "URL is required";
				if (!value.startsWith("http")) return "Must be a valid URL";
			},
		});

		if (p.isCancel(url)) {
			p.cancel("Cancelled");
			return;
		}

		config.mcp[serverName] = {
			type: "remote",
			url: url as string,
			enabled: true,
		};
	} else {
		const command = await p.text({
			message: "Command (space-separated)",
			placeholder: "npx -y @modelcontextprotocol/server-filesystem",
			validate: (value) => {
				if (!value) return "Command is required";
			},
		});

		if (p.isCancel(command)) {
			p.cancel("Cancelled");
			return;
		}

		// Ask for environment variables
		const hasEnv = await p.confirm({
			message: "Add environment variables?",
			initialValue: false,
		});

		let env: Record<string, string> | undefined;

		if (!p.isCancel(hasEnv) && hasEnv) {
			const envInput = await p.text({
				message: "Environment variables (KEY=value, comma-separated)",
				placeholder: "API_KEY=xxx, DEBUG=true",
			});

			if (!p.isCancel(envInput) && envInput) {
				env = {};
				const pairs = (envInput as string).split(",").map((s) => s.trim());
				for (const pair of pairs) {
					const [key, ...valueParts] = pair.split("=");
					if (key && valueParts.length > 0) {
						env[key.trim()] = valueParts.join("=").trim();
					}
				}
			}
		}

		config.mcp[serverName] = {
			type: "local",
			command: (command as string).split(" "),
			enabled: true,
			...(env && Object.keys(env).length > 0 ? { env } : {}),
		};
	}

	saveConfig(configPath, config);
	p.log.success(`Added MCP server: ${color.cyan(serverName)}`);
	p.outro(color.green("Done!"));
}

async function removeMCP(configPath: string, serverNameArg?: string) {
	const config = loadConfig(configPath);

	if (!config.mcp || Object.keys(config.mcp).length === 0) {
		showEmpty("MCP servers", "ock mcp add");
		return;
	}

	// If no server name provided, prompt for selection
	let serverName = serverNameArg;
	if (!serverName) {
		const servers = Object.keys(config.mcp).map((name) => ({
			value: name,
			label: name,
			hint: config.mcp?.[name]?.enabled === false ? "disabled" : "enabled",
		}));

		const selected = await p.select({
			message: "Select server to remove",
			options: servers,
		});

		if (p.isCancel(selected)) {
			return;
		}

		serverName = selected as string;
	}

	if (!config.mcp[serverName]) {
		p.log.error(`Server "${serverName}" not found`);
		return;
	}

	const confirm = await p.confirm({
		message: `Remove "${serverName}"?`,
	});

	if (p.isCancel(confirm) || !confirm) {
		return;
	}

	delete config.mcp[serverName];
	saveConfig(configPath, config);

	p.log.success(`Removed: ${serverName}`);
}

async function toggleMCP(configPath: string, serverNameArg?: string) {
	const config = loadConfig(configPath);

	if (!config.mcp || Object.keys(config.mcp).length === 0) {
		showEmpty("MCP servers", "ock mcp add");
		return;
	}

	// If no server name provided, prompt for selection
	let serverName = serverNameArg;
	if (!serverName) {
		const servers = Object.entries(config.mcp).map(([name, server]) => ({
			value: name,
			label: name,
			hint: server.enabled === false ? "off" : "on",
		}));

		const selected = await p.select({
			message: "Select server to toggle",
			options: servers,
		});

		if (p.isCancel(selected)) {
			return;
		}

		serverName = selected as string;
	}

	if (!config.mcp[serverName]) {
		p.log.error(`Server "${serverName}" not found`);
		return;
	}

	const server = config.mcp[serverName];
	const wasEnabled = server.enabled !== false;
	server.enabled = !wasEnabled;

	saveConfig(configPath, config);

	const status = server.enabled
		? color.green("enabled")
		: color.red("disabled");
	p.log.success(`${serverName}: ${status}`);
}
