import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import color from "picocolors";
import { createKeyboardController } from "../utils/keyboard.js";

interface ConfigSection {
	key: string;
	value: unknown;
	type: "object" | "array" | "string" | "number" | "boolean" | "null";
}

interface EditorState {
	path: string[];
	selectedIndex: number;
	editMode: boolean;
	editBuffer: string;
	message: string;
	messageType: "info" | "error" | "success";
}

/**
 * Run the config editor TUI with box-style layout.
 */
export async function runConfigEditor(): Promise<void> {
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

	const state: EditorState = {
		path: [],
		selectedIndex: 0,
		editMode: false,
		editBuffer: "",
		message: "",
		messageType: "info",
	};

	const getSections = (): ConfigSection[] => {
		let current: unknown = config;
		for (const key of state.path) {
			if (typeof current === "object" && current !== null) {
				current = (current as Record<string, unknown>)[key];
			}
		}

		if (typeof current !== "object" || current === null) {
			return [];
		}

		return Object.entries(current as Record<string, unknown>).map(
			([key, value]) => ({
				key,
				value,
				type: getType(value),
			}),
		);
	};

	const getType = (
		value: unknown,
	): "object" | "array" | "string" | "number" | "boolean" | "null" => {
		if (value === null) return "null";
		if (Array.isArray(value)) return "array";
		return typeof value as "object" | "string" | "number" | "boolean";
	};

	const formatValue = (section: ConfigSection): string => {
		if (section.type === "object") {
			const keys = Object.keys(section.value as Record<string, unknown>);
			return color.dim(`{${keys.length} keys}`);
		}
		if (section.type === "array") {
			const arr = section.value as unknown[];
			return color.dim(`[${arr.length} items]`);
		}
		if (section.type === "string") {
			const str = section.value as string;
			if (str.length > 35) {
				return color.green(`"${str.substring(0, 32)}..."`);
			}
			return color.green(`"${str}"`);
		}
		if (section.type === "number") {
			return color.yellow(String(section.value));
		}
		if (section.type === "boolean") {
			return section.value ? color.green("true") : color.red("false");
		}
		return color.dim("null");
	};

	const getTypeIcon = (section: ConfigSection): string => {
		switch (section.type) {
			case "object":
				return color.cyan("{}");
			case "array":
				return color.cyan("[]");
			case "string":
				return color.green('""');
			case "number":
				return color.yellow("#");
			case "boolean":
				return color.magenta("◉");
			default:
				return color.dim("○");
		}
	};

	const setValue = (newValue: unknown): boolean => {
		const sections = getSections();
		const section = sections[state.selectedIndex];
		if (!section) return false;

		let target: Record<string, unknown> = config;
		for (const key of state.path) {
			target = target[key] as Record<string, unknown>;
		}

		target[section.key] = newValue;
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
		const pathStr = state.path.length > 0 ? state.path.join(" → ") : "root";
		console.log();
		console.log(
			`  ${color.bgCyan(color.black(" Config Editor "))} ${color.dim(pathStr)}`,
		);
		console.log();

		const sections = getSections();
		const pageSize = 15;
		const startIdx = Math.max(
			0,
			Math.min(
				state.selectedIndex - Math.floor(pageSize / 2),
				sections.length - pageSize,
			),
		);
		const endIdx = Math.min(startIdx + pageSize, sections.length);

		// Box top
		const boxTitle = ` ${sections.length} items `;
		console.log(
			color.dim(`  ┌${boxTitle}${"─".repeat(width - boxTitle.length - 3)}┐`),
		);

		if (sections.length === 0) {
			console.log(
				`  ${color.dim("│")} ${padRight(color.dim("(empty)"), width - 4)}${color.dim("│")}`,
			);
		} else {
			for (let i = startIdx; i < endIdx; i++) {
				const section = sections[i];
				const isSelected = i === state.selectedIndex;
				const prefix = isSelected ? color.cyan("▶") : " ";
				const typeIcon = getTypeIcon(section);
				const keyPart = isSelected
					? color.bold(color.cyan(section.key))
					: section.key;

				let content: string;
				if (state.editMode && isSelected) {
					content = `${prefix} ${typeIcon} ${keyPart}: ${color.bgBlue(color.white(state.editBuffer))}█`;
				} else {
					const valuePart = formatValue(section);
					content = `${prefix} ${typeIcon} ${keyPart}: ${valuePart}`;
				}

				console.log(
					`  ${color.dim("│")} ${padRight(content, width - 4)}${color.dim("│")}`,
				);
			}
		}

		// Box bottom
		console.log(color.dim(`  └${"─".repeat(width - 2)}┘`));

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
		if (state.editMode) {
			console.log(
				`  ${color.dim("Type value,")} ${color.green("Enter")} ${color.dim("to save,")} ${color.red("Esc")} ${color.dim("to cancel")}`,
			);
		} else {
			console.log(
				`  ${color.dim("[")}${color.cyan("↑↓")}${color.dim("] Nav")}  ` +
					`${color.dim("[")}${color.green("Enter")}${color.dim("] Edit/Drill")}  ` +
					`${color.dim("[")}${color.yellow("←")}${color.dim("] Back")}  ` +
					`${color.dim("[")}${color.magenta("s")}${color.dim("] Save")}  ` +
					`${color.dim("[")}${color.red("q")}${color.dim("] Quit")}`,
			);
		}
		console.log();
	};

	return new Promise((resolve) => {
		const kb = createKeyboardController();

		const handleKey = (key: string) => {
			const sections = getSections();

			if (state.editMode) {
				if (key === "escape") {
					state.editMode = false;
					state.editBuffer = "";
					state.message = "";
					render();
				} else if (key === "enter") {
					const section = sections[state.selectedIndex];
					if (section) {
						let newValue: unknown;
						const buf = state.editBuffer.trim();

						if (section.type === "boolean") {
							newValue = buf === "true";
						} else if (section.type === "number") {
							newValue = Number(buf);
							if (Number.isNaN(newValue)) {
								state.message = "Invalid number";
								state.messageType = "error";
								render();
								return;
							}
						} else if (section.type === "string") {
							newValue = buf;
						} else {
							state.message = "Cannot edit complex types inline";
							state.messageType = "error";
							state.editMode = false;
							render();
							return;
						}

						if (setValue(newValue)) {
							state.message = "Updated (press 's' to save)";
							state.messageType = "success";
						} else {
							state.message = "Failed to update";
							state.messageType = "error";
						}
					}
					state.editMode = false;
					state.editBuffer = "";
					render();
				} else if (key === "backspace") {
					state.editBuffer = state.editBuffer.slice(0, -1);
					render();
				} else if (key.length === 1 && key.charCodeAt(0) >= 32) {
					state.editBuffer += key;
					render();
				}
				return;
			}

			switch (key) {
				case "up":
					state.selectedIndex = Math.max(0, state.selectedIndex - 1);
					state.message = "";
					render();
					break;
				case "down":
					state.selectedIndex = Math.min(
						sections.length - 1,
						state.selectedIndex + 1,
					);
					state.message = "";
					render();
					break;
				case "enter":
				case "right": {
					const section = sections[state.selectedIndex];
					if (section) {
						if (section.type === "object" || section.type === "array") {
							state.path.push(section.key);
							state.selectedIndex = 0;
							state.message = "";
						} else {
							state.editMode = true;
							state.editBuffer = String(section.value);
							state.message = "";
						}
					}
					render();
					break;
				}
				case "left":
				case "backspace":
					if (state.path.length > 0) {
						state.path.pop();
						state.selectedIndex = 0;
						state.message = "";
						render();
					}
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
