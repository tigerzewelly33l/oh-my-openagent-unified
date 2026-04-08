import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import color from "picocolors";
import { createKeyboardController } from "../utils/keyboard.js";

interface MCPServer {
	name: string;
	type: "local" | "remote";
	enabled: boolean;
	command?: string[];
	url?: string;
}

interface MonitorState {
	selectedIndex: number;
	message: string;
	messageType: "info" | "error" | "success";
}

/**
 * Run the MCP status monitor TUI with box-style layout.
 */
export async function runMCPMonitor(): Promise<void> {
	const configPath = join(process.cwd(), ".opencode", "opencode.json");

	if (!existsSync(configPath)) {
		console.clear();
		console.log();
		console.log(color.red("  Config file not found: .opencode/opencode.json"));
		console.log(color.dim("  Press any key to go back..."));

		return new Promise((resolve) => {
			const kb = createKeyboardController();
			kb.start(() => {
				kb.stop();
				resolve();
			});
		});
	}

	let config: Record<string, unknown>;
	try {
		config = JSON.parse(readFileSync(configPath, "utf-8"));
	} catch {
		console.clear();
		console.log();
		console.log(color.red("  Failed to parse config file"));
		console.log(color.dim("  Press any key to go back..."));

		return new Promise((resolve) => {
			const kb = createKeyboardController();
			kb.start(() => {
				kb.stop();
				resolve();
			});
		});
	}

	const state: MonitorState = {
		selectedIndex: 0,
		message: "",
		messageType: "info",
	};

	const getMCPServers = (): MCPServer[] => {
		const mcp = config.mcp as Record<string, unknown> | undefined;
		if (!mcp || typeof mcp !== "object") return [];

		return Object.entries(mcp).map(([name, value]) => {
			const server = value as Record<string, unknown>;
			return {
				name,
				type: (server.type as "local" | "remote") || "local",
				enabled: server.enabled !== false,
				command: server.command as string[] | undefined,
				url: server.url as string | undefined,
			};
		});
	};

	const toggleServer = (index: number): boolean => {
		const servers = getMCPServers();
		const server = servers[index];
		if (!server) return false;

		const mcp = config.mcp as Record<string, Record<string, unknown>>;
		mcp[server.name].enabled = !server.enabled;
		return true;
	};

	const saveConfig = (): boolean => {
		try {
			writeFileSync(configPath, JSON.stringify(config, null, 2));
			return true;
		} catch {
			return false;
		}
	};

	const render = () => {
		console.clear();
		const width = Math.min(process.stdout.columns || 80, 120) - 4;

		// Header
		console.log();
		console.log(
			`  ${color.bgMagenta(color.white(" MCP Monitor "))} ${color.dim("Model Context Protocol")}`,
		);
		console.log();

		const servers = getMCPServers();

		// Box top
		const boxTitle = ` ${servers.length} servers `;
		console.log(
			color.dim(`  ┌${boxTitle}${"─".repeat(width - boxTitle.length - 3)}┐`),
		);

		if (servers.length === 0) {
			console.log(
				`  ${color.dim("│")} ${padRight(color.dim("No MCP servers configured"), width - 4)}${color.dim("│")}`,
			);
			console.log(
				`  ${color.dim("│")} ${padRight("", width - 4)}${color.dim("│")}`,
			);
			console.log(
				`  ${color.dim("│")} ${padRight(color.dim("Add servers to .opencode/opencode.json:"), width - 4)}${color.dim("│")}`,
			);
			console.log(
				`  ${color.dim("│")} ${padRight(color.dim('  "mcp": { "name": { "command": [...] } }'), width - 4)}${color.dim("│")}`,
			);
		} else {
			// Header row
			const headerContent = `  ${color.bold("Status")}  ${color.bold("Type")}  ${color.bold("Name")}                ${color.bold("Details")}`;
			console.log(
				`  ${color.dim("│")} ${padRight(headerContent, width - 4)}${color.dim("│")}`,
			);
			console.log(
				`  ${color.dim("│")} ${padRight(color.dim("─".repeat(width - 6)), width - 4)}${color.dim("│")}`,
			);

			for (let i = 0; i < servers.length; i++) {
				const server = servers[i];
				const isSelected = i === state.selectedIndex;
				const prefix = isSelected ? color.cyan("▶") : " ";

				const status = server.enabled ? color.green("●") : color.dim("○");
				const typeIcon =
					server.type === "remote" ? color.blue("☁") : color.yellow("⚡");
				const name = isSelected
					? color.bold(color.cyan(server.name.padEnd(18)))
					: server.name.padEnd(18);

				let details = "";
				if (server.type === "remote" && server.url) {
					details = color.dim(truncate(server.url, 25));
				} else if (server.command) {
					details = color.dim(truncate(server.command.join(" "), 25));
				}

				const rowContent = `${prefix} ${status}       ${typeIcon}     ${name}  ${details}`;
				console.log(
					`  ${color.dim("│")} ${padRight(rowContent, width - 4)}${color.dim("│")}`,
				);
			}
		}

		// Box bottom
		console.log(color.dim(`  └${"─".repeat(width - 2)}┘`));

		// Legend
		console.log();
		console.log(
			`  ${color.green("●")} ${color.dim("Enabled")}  ${color.dim("○")} ${color.dim("Disabled")}  ${color.yellow("⚡")} ${color.dim("Local")}  ${color.blue("☁")} ${color.dim("Remote")}`,
		);

		// Message area
		if (state.message) {
			console.log();
			const msgColor =
				state.messageType === "error"
					? color.red
					: state.messageType === "success"
						? color.green
						: color.dim;
			console.log(`  ${msgColor(state.message)}`);
		}

		// Footer
		console.log();
		console.log(
			`  ${color.dim("[")}${color.cyan("↑↓")}${color.dim("] Nav")}  ` +
				`${color.dim("[")}${color.green("Space")}${color.dim("] Toggle")}  ` +
				`${color.dim("[")}${color.magenta("s")}${color.dim("] Save")}  ` +
				`${color.dim("[")}${color.red("q")}${color.dim("] Back")}`,
		);
		console.log();
	};

	return new Promise((resolve) => {
		const kb = createKeyboardController();

		const handleKey = (key: string) => {
			const currentServers = getMCPServers();

			switch (key) {
				case "up":
					state.selectedIndex = Math.max(0, state.selectedIndex - 1);
					state.message = "";
					render();
					break;
				case "down":
					state.selectedIndex = Math.min(
						currentServers.length - 1,
						state.selectedIndex + 1,
					);
					state.message = "";
					render();
					break;
				case " ":
				case "enter":
					if (currentServers.length > 0) {
						if (toggleServer(state.selectedIndex)) {
							const server = currentServers[state.selectedIndex];
							const newState = !server.enabled;
							state.message = `${server.name}: ${newState ? "enabled" : "disabled"} (press 's' to save)`;
							state.messageType = "success";
						}
					}
					render();
					break;
				case "s":
					if (saveConfig()) {
						state.message = "Config saved!";
						state.messageType = "success";
					} else {
						state.message = "Failed to save";
						state.messageType = "error";
					}
					render();
					break;
				case "escape":
				case "q":
					kb.stop();
					resolve();
					break;
				case "quit":
					kb.stop();
					process.exit(0);
			}
		};

		render();
		kb.start(handleKey);
	});
}

function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.substring(0, maxLen - 3)}...`;
}

function padRight(str: string, len: number): string {
	const stripped = stripAnsi(str);
	const pad = Math.max(0, len - stripped.length);
	return str + " ".repeat(pad);
}

function stripAnsi(str: string): string {
	const esc = "\u001B";
	let result = "";
	let index = 0;

	while (index < str.length) {
		const start = str.indexOf(esc, index);
		if (start === -1) {
			result += str.slice(index);
			break;
		}

		result += str.slice(index, start);
		const end = str.indexOf("m", start);
		if (end === -1) {
			index = start + 1;
			continue;
		}

		index = end + 1;
	}

	return result;
}
