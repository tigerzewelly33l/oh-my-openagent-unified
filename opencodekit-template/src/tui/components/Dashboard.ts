import color from "picocolors";
import type { ProjectData } from "../hooks/useData.js";

/**
 * Renders the dashboard to the terminal with box-style layout.
 */
export function renderDashboard(data: ProjectData): void {
	const width = Math.min(process.stdout.columns || 80, 120) - 4;

	console.clear();

	// Header
	console.log();
	console.log(
		`  ${color.bgCyan(color.black(" OpenCodeKit Dashboard "))} ${color.dim(data.projectName)}`,
	);
	console.log();

	// Stats Box
	printBox("Overview", width, () => {
		const stats = [
			{ label: "Agents", value: data.agents.length, col: color.cyan },
			{ label: "Skills", value: data.skills.length, col: color.cyan },
			{ label: "Commands", value: data.commands.length, col: color.yellow },
			{ label: "Tools", value: data.tools.length, col: color.yellow },
			{ label: "MCP", value: data.mcpServers.length, col: color.magenta },
		];

		const statLine = stats
			.map((s) => `${color.dim(s.label)} ${s.col(color.bold(String(s.value)))}`)
			.join("   ");
		console.log(`  ${statLine}`);
	});

	console.log();

	// Two-column layout: Agents & Skills
	printTwoColumnBox(
		{ title: "Agents", items: data.agents, icon: "●", col: color.cyan },
		{ title: "Skills", items: data.skills, icon: "◆", col: color.cyan },
		width,
		8,
	);

	console.log();

	// Two-column layout: Commands & MCP
	printTwoColumnBox(
		{
			title: "Commands",
			items: data.commands.map((c) => `/${c}`),
			icon: "›",
			col: color.yellow,
		},
		{
			title: "MCP Servers",
			items: data.mcpServers,
			icon: "◈",
			col: color.magenta,
		},
		width,
		5,
	);

	console.log();

	// Footer
	console.log(color.dim(`  ${"─".repeat(width - 4)}`));
	console.log();
	console.log(
		`  ${color.dim("[")}${color.cyan("a")}${color.dim("] Agents")}  ` +
			`${color.dim("[")}${color.cyan("s")}${color.dim("] Skills")}  ` +
			`${color.dim("[")}${color.yellow("c")}${color.dim("] Config")}  ` +
			`${color.dim("[")}${color.magenta("m")}${color.dim("] MCP")}  ` +
			`${color.dim("[")}${color.red("q")}${color.dim("] Quit")}`,
	);
	console.log();
}

function printBox(title: string, width: number, content: () => void): void {
	const innerWidth = width - 4;
	const titlePadded = ` ${title} `;
	const topLine = `┌${titlePadded}${"─".repeat(innerWidth - titlePadded.length)}┐`;
	const bottomLine = `└${"─".repeat(innerWidth)}┘`;

	console.log(color.dim(`  ${topLine}`));
	content();
	console.log(color.dim(`  ${bottomLine}`));
}

interface ColumnConfig {
	title: string;
	items: string[];
	icon: string;
	col: (s: string) => string;
}

function printTwoColumnBox(
	left: ColumnConfig,
	right: ColumnConfig,
	totalWidth: number,
	maxItems: number,
): void {
	const colWidth = Math.floor((totalWidth - 7) / 2);

	// Top border with titles
	const leftTitle = ` ${left.title} `;
	const rightTitle = ` ${right.title} `;
	const leftBorder = `┌${leftTitle}${"─".repeat(colWidth - leftTitle.length)}`;
	const rightBorder = `┬${rightTitle}${"─".repeat(colWidth - rightTitle.length)}┐`;

	console.log(color.dim(`  ${leftBorder}${rightBorder}`));

	// Content rows
	const leftItems = formatItems(left.items, left.icon, left.col, maxItems);
	const rightItems = formatItems(right.items, right.icon, right.col, maxItems);
	const maxRows = Math.max(leftItems.length, rightItems.length);

	for (let i = 0; i < maxRows; i++) {
		const leftContent = leftItems[i] || "";
		const rightContent = rightItems[i] || "";
		const leftPadded = padRight(leftContent, colWidth - 1);
		const rightPadded = padRight(rightContent, colWidth - 1);
		console.log(
			`  ${color.dim("│")} ${leftPadded}${color.dim("│")} ${rightPadded}${color.dim("│")}`,
		);
	}

	// Bottom border
	const bottomLine = `└${"─".repeat(colWidth)}┴${"─".repeat(colWidth)}┘`;
	console.log(color.dim(`  ${bottomLine}`));
}

function formatItems(
	items: string[],
	icon: string,
	col: (s: string) => string,
	maxItems: number,
): string[] {
	const result: string[] = [];

	if (items.length === 0) {
		result.push(color.dim("(none)"));
		return result;
	}

	for (const item of items.slice(0, maxItems)) {
		result.push(`${col(icon)} ${item}`);
	}

	if (items.length > maxItems) {
		result.push(color.dim(`  +${items.length - maxItems} more`));
	}

	return result;
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
