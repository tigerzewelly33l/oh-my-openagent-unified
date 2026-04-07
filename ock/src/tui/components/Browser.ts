import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import color from "picocolors";
import { createKeyboardController } from "../utils/keyboard.js";

export interface BrowserItem {
	name: string;
	path: string;
	description?: string;
}

export interface BrowserOptions {
	title: string;
	items: BrowserItem[];
	icon?: string;
	color?: (s: string) => string;
	onSelect?: (item: BrowserItem) => void;
	onEdit?: (item: BrowserItem) => void;
	onBack?: () => void;
}

/**
 * Interactive browser component with keyboard navigation.
 * Displays a list on the left and preview on the right with box-style layout.
 */
export async function runBrowser(options: BrowserOptions): Promise<void> {
	const {
		title,
		items,
		icon = "●",
		color: itemColor = color.cyan,
		onBack,
	} = options;

	if (items.length === 0) {
		console.clear();
		console.log();
		printEmptyBox(title);
		console.log();
		console.log(color.dim("  Press any key to go back..."));

		return new Promise((resolve) => {
			const kb = createKeyboardController();
			kb.start(() => {
				kb.stop();
				resolve();
			});
		});
	}

	let selectedIndex = 0;
	const pageSize = 14;

	const render = () => {
		console.clear();
		const totalWidth = Math.min(process.stdout.columns || 80, 120) - 4;
		const listWidth = Math.floor(totalWidth * 0.35);
		const previewWidth = totalWidth - listWidth - 3;

		// Header
		console.log();
		console.log(
			`  ${color.bgCyan(color.black(` ${title} Browser `))} ${color.dim(`${items.length} items`)}`,
		);
		console.log();

		// Calculate visible range
		const startIdx = Math.max(
			0,
			Math.min(
				selectedIndex - Math.floor(pageSize / 2),
				items.length - pageSize,
			),
		);
		const endIdx = Math.min(startIdx + pageSize, items.length);
		const visibleItems = items.slice(startIdx, endIdx);

		// Get selected item for preview
		const selected = items[selectedIndex];
		const previewLines = getPreviewLines(selected, previewWidth - 2);

		// Build rows
		const maxRows = Math.max(
			visibleItems.length,
			previewLines.length,
			pageSize,
		);

		// Top border
		const listTitle = ` ${items.length} items `;
		const previewTitle = " Preview ";
		console.log(
			color.dim(
				`  ┌${listTitle}${"─".repeat(listWidth - listTitle.length)}┬${previewTitle}${"─".repeat(previewWidth - previewTitle.length)}┐`,
			),
		);

		// Content rows
		for (let i = 0; i < maxRows; i++) {
			let leftContent = "";
			let rightContent = "";

			if (i < visibleItems.length) {
				const itemIdx = startIdx + i;
				const item = visibleItems[i];
				const isSelected = itemIdx === selectedIndex;
				const pointer = isSelected ? color.cyan("▶") : " ";
				const itemIcon = isSelected ? itemColor(icon) : color.dim(icon);
				const name = isSelected
					? color.bold(itemColor(truncate(item.name, listWidth - 6)))
					: truncate(item.name, listWidth - 6);
				leftContent = `${pointer}${itemIcon} ${name}`;
			}

			if (i < previewLines.length) {
				rightContent = previewLines[i];
			}

			const leftPadded = padRight(leftContent, listWidth - 1);
			const rightPadded = padRight(rightContent, previewWidth - 1);

			console.log(
				`  ${color.dim("│")} ${leftPadded}${color.dim("│")} ${rightPadded}${color.dim("│")}`,
			);
		}

		// Bottom border
		console.log(
			color.dim(`  └${"─".repeat(listWidth)}┴${"─".repeat(previewWidth)}┘`),
		);

		// Scroll indicator
		if (items.length > pageSize) {
			const scrollPos = Math.round((selectedIndex / (items.length - 1)) * 100);
			console.log(
				color.dim(`  ${selectedIndex + 1}/${items.length} (${scrollPos}%)`),
			);
		}

		// Footer
		console.log();
		console.log(
			`  ${color.dim("[")}${color.cyan("↑↓")}${color.dim("] Navigate")}  ` +
				`${color.dim("[")}${color.green("Enter")}${color.dim("] View")}  ` +
				`${color.dim("[")}${color.yellow("e")}${color.dim("] Edit")}  ` +
				`${color.dim("[")}${color.red("q")}${color.dim("] Back")}`,
		);
		console.log();
	};

	return new Promise((resolve) => {
		const kb = createKeyboardController();

		const handleKey = async (key: string) => {
			switch (key) {
				case "up":
					selectedIndex = Math.max(0, selectedIndex - 1);
					render();
					break;
				case "down":
					selectedIndex = Math.min(items.length - 1, selectedIndex + 1);
					render();
					break;
				case "enter":
					kb.stop();
					await showFileViewer(items[selectedIndex]);
					render();
					kb.start(handleKey);
					break;
				case "e":
					kb.stop();
					await openInEditor(items[selectedIndex]);
					render();
					kb.start(handleKey);
					break;
				case "escape":
				case "q":
					kb.stop();
					if (onBack) onBack();
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

function printEmptyBox(title: string): void {
	const width = Math.min(process.stdout.columns || 80, 120) - 4;
	console.log(color.dim(`  ┌${"─".repeat(width - 2)}┐`));
	console.log(
		`  ${color.dim("│")} ${padRight(color.yellow(`No ${title.toLowerCase()} found`), width - 4)}${color.dim("│")}`,
	);
	console.log(
		`  ${color.dim("│")} ${padRight("", width - 4)}${color.dim("│")}`,
	);
	console.log(
		`  ${color.dim("│")} ${padRight(color.dim("Check your .opencode/ directory"), width - 4)}${color.dim("│")}`,
	);
	console.log(color.dim(`  └${"─".repeat(width - 2)}┘`));
}

function getPreviewLines(item: BrowserItem, maxWidth: number): string[] {
	const lines: string[] = [];

	// Header with name
	lines.push(color.bold(color.cyan(item.name)));
	lines.push(color.dim("─".repeat(Math.min(maxWidth, 40))));

	// Path info
	const shortPath = item.path.replace(process.cwd(), ".");
	lines.push(color.dim(`Path: ${truncate(shortPath, maxWidth - 6)}`));
	lines.push("");

	if (!existsSync(item.path)) {
		lines.push(color.red("(file not found)"));
		return lines;
	}

	try {
		const content = readFileSync(item.path, "utf-8");
		const contentLines = content.split("\n");

		// Try to extract description from frontmatter or first lines
		let inFrontmatter = false;
		let description = "";
		let startLine = 0;

		for (let i = 0; i < Math.min(contentLines.length, 20); i++) {
			const line = contentLines[i].trim();
			if (i === 0 && line === "---") {
				inFrontmatter = true;
				continue;
			}
			if (inFrontmatter && line === "---") {
				inFrontmatter = false;
				startLine = i + 1;
				continue;
			}
			if (inFrontmatter && line.startsWith("description:")) {
				description = line.replace("description:", "").trim();
			}
		}

		if (description) {
			lines.push(color.green("Description:"));
			const descWords = description.split(" ");
			let currentLine = "";
			for (const word of descWords) {
				if (`${currentLine} ${word}`.length > maxWidth - 2) {
					lines.push(`  ${currentLine.trim()}`);
					currentLine = word;
				} else {
					currentLine += ` ${word}`;
				}
			}
			if (currentLine.trim()) {
				lines.push(`  ${currentLine.trim()}`);
			}
			lines.push("");
		}

		// Content preview
		lines.push(color.dim("Content:"));
		const previewLines = contentLines.slice(startLine, startLine + 8);
		for (const line of previewLines) {
			if (line.length > maxWidth - 2) {
				lines.push(color.dim(`  ${line.substring(0, maxWidth - 5)}...`));
			} else {
				lines.push(color.dim(`  ${line}`));
			}
		}

		if (contentLines.length > startLine + 8) {
			lines.push("");
			lines.push(
				color.dim(`  ... ${contentLines.length - startLine - 8} more lines`),
			);
		}
	} catch {
		lines.push(color.red("(could not read file)"));
	}

	return lines;
}

function truncate(str: string, maxLen: number): string {
	if (str.length <= maxLen) return str;
	return `${str.substring(0, maxLen - 1)}…`;
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

/**
 * Show file content in a full-screen viewer
 */
async function showFileViewer(item: BrowserItem): Promise<void> {
	if (!existsSync(item.path)) {
		console.clear();
		console.log();
		console.log(color.red(`  File not found: ${item.path}`));
		console.log(color.dim("  Press any key to go back..."));
		await waitForKey();
		return;
	}

	const content = readFileSync(item.path, "utf-8");
	const lines = content.split("\n");
	let scrollOffset = 0;
	const pageSize = (process.stdout.rows || 24) - 6;

	const renderViewer = () => {
		console.clear();
		const width = Math.min(process.stdout.columns || 80, 120) - 4;

		// Header
		console.log();
		console.log(
			`  ${color.bgGreen(color.black(" View "))} ${color.cyan(item.name)}`,
		);
		console.log(color.dim(`  ${item.path.replace(process.cwd(), ".")}`));
		console.log();

		// Box top
		console.log(color.dim(`  ┌${"─".repeat(width - 2)}┐`));

		// Content
		const visibleLines = lines.slice(scrollOffset, scrollOffset + pageSize);
		for (let i = 0; i < pageSize; i++) {
			const lineNum = scrollOffset + i + 1;
			const lineContent = visibleLines[i] ?? "";
			const numStr = color.dim(`${String(lineNum).padStart(4, " ")} │ `);
			const truncated =
				lineContent.length > width - 10
					? `${lineContent.substring(0, width - 13)}...`
					: lineContent;
			console.log(
				`  ${color.dim("│")}${numStr}${truncated.padEnd(width - 10)}${color.dim("│")}`,
			);
		}

		// Box bottom
		console.log(color.dim(`  └${"─".repeat(width - 2)}┘`));

		// Footer
		console.log();
		console.log(
			`  ${color.dim("[")}${color.cyan("↑↓")}${color.dim("] Scroll")}  ` +
				`${color.dim("[")}${color.yellow("PgUp/PgDn")}${color.dim("] Page")}  ` +
				`${color.dim("Line")} ${scrollOffset + 1}-${Math.min(scrollOffset + pageSize, lines.length)}/${lines.length}  ` +
				`${color.dim("[")}${color.red("q")}${color.dim("] Back")}`,
		);
	};

	return new Promise((resolve) => {
		const kb = createKeyboardController();

		const handleKey = (key: string) => {
			switch (key) {
				case "up":
					scrollOffset = Math.max(0, scrollOffset - 1);
					renderViewer();
					break;
				case "down":
					scrollOffset = Math.min(lines.length - pageSize, scrollOffset + 1);
					renderViewer();
					break;
				case "pageup":
				case "left":
					scrollOffset = Math.max(0, scrollOffset - pageSize);
					renderViewer();
					break;
				case "pagedown":
				case "right":
					scrollOffset = Math.min(
						lines.length - pageSize,
						scrollOffset + pageSize,
					);
					renderViewer();
					break;
				case "escape":
				case "q":
					kb.stop();
					resolve();
					break;
			}
		};

		renderViewer();
		kb.start(handleKey);
	});
}

/**
 * Open file in default editor
 */
async function openInEditor(item: BrowserItem): Promise<void> {
	const editor = process.env.EDITOR || process.env.VISUAL || "vim";

	console.clear();
	console.log();
	console.log(color.cyan(`  Opening ${item.name} in ${editor}...`));

	return new Promise((resolve) => {
		const child = spawn(editor, [item.path], {
			stdio: "inherit",
		});

		child.on("exit", () => {
			resolve();
		});

		child.on("error", async () => {
			console.log(color.red(`  Failed to open editor: ${editor}`));
			console.log(color.dim("  Set $EDITOR environment variable"));
			console.log(color.dim("  Press any key to continue..."));
			await waitForKey();
			resolve();
		});
	});
}

/**
 * Wait for any key press
 */
function waitForKey(): Promise<void> {
	return new Promise((resolve) => {
		const kb = createKeyboardController();
		kb.start(() => {
			kb.stop();
			resolve();
		});
	});
}

/**
 * Load agents as browser items
 */
export function loadAgentItems(): BrowserItem[] {
	const cwd = process.cwd();
	const agentDir = join(cwd, ".opencode", "agent");

	if (!existsSync(agentDir)) return [];

	const { readdirSync, lstatSync } = require("node:fs");
	return readdirSync(agentDir)
		.filter(
			(f: string) => f.endsWith(".md") && lstatSync(join(agentDir, f)).isFile(),
		)
		.map((f: string) => ({
			name: f.replace(".md", ""),
			path: join(agentDir, f),
		}));
}

/**
 * Load skills as browser items
 */
export function loadSkillItems(): BrowserItem[] {
	const cwd = process.cwd();
	const skillDir = join(cwd, ".opencode", "skill");

	if (!existsSync(skillDir)) return [];

	const { readdirSync, lstatSync } = require("node:fs");
	return readdirSync(skillDir)
		.filter(
			(f: string) =>
				lstatSync(join(skillDir, f)).isDirectory() &&
				existsSync(join(skillDir, f, "SKILL.md")),
		)
		.map((f: string) => ({
			name: f,
			path: join(skillDir, f, "SKILL.md"),
		}));
}
