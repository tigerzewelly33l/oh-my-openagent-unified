import { dirname } from "path";
import {
	resolveCommandsInText,
	resolveFileReferencesInText,
} from "../../shared";
import {
	getCommandPriorityLabel,
	prioritizeCommands,
} from "./command-discovery";
import type { CommandInfo } from "./types";

interface LoadableCommandInfo {
	name: string;
	path?: string;
	metadata: CommandInfo["metadata"];
	content?: string;
	scope: string;
	lazyContentLoader?: CommandInfo["lazyContentLoader"];
}

interface FormatLoadedCommandOptions {
	argumentLabel?: string;
	includeUserRequestSection?: boolean;
}

function getCommandCategoryDescription(commandName: string): string | null {
	switch (getCommandPriorityLabel(commandName)) {
		case "primary":
			return "primary workflow";
		case "support":
			return "workflow support";
		case "compatibility":
			return "compatibility adapter";
		default:
			return null;
	}
}

export async function formatLoadedCommand(
	command: LoadableCommandInfo,
	userMessage?: string,
	options: FormatLoadedCommandOptions = {},
): Promise<string> {
	const sections: string[] = [];
	const categoryDescription = getCommandCategoryDescription(command.name);

	sections.push(`# /${command.name} Command\n`);

	if (command.metadata.description) {
		sections.push(`**Description**: ${command.metadata.description}\n`);
	}

	if (command.metadata.argumentHint) {
		sections.push(
			`**Usage**: /${command.name} ${command.metadata.argumentHint}\n`,
		);
	}

	if (userMessage) {
		sections.push(
			`**${options.argumentLabel ?? "Arguments"}**: ${userMessage}\n`,
		);
	}

	if (command.metadata.model) {
		sections.push(`**Model**: ${command.metadata.model}\n`);
	}

	if (command.metadata.agent) {
		sections.push(`**Agent**: ${command.metadata.agent}\n`);
	}

	if (command.metadata.subtask) {
		sections.push("**Subtask**: true\n");
	}

	if (categoryDescription) {
		sections.push(`**Category**: ${categoryDescription}\n`);
	}

	sections.push(`**Scope**: ${command.scope}\n`);
	sections.push("---\n");
	sections.push("## Command Instructions\n");

	let content = command.content || "";
	if (!content && command.lazyContentLoader) {
		content = await command.lazyContentLoader.load();
	}

	const commandDir = command.path ? dirname(command.path) : process.cwd();
	const withFileReferences = await resolveFileReferencesInText(
		content,
		commandDir,
	);
	const resolvedContent = await resolveCommandsInText(withFileReferences);

	let finalContent = resolvedContent.trim();
	if (userMessage) {
		finalContent = finalContent
			.replace(/\$\{user_message\}/g, userMessage)
			.replace(/\$ARGUMENTS/g, userMessage);
	}

	sections.push(finalContent);

	if (options.includeUserRequestSection && userMessage) {
		sections.push("\n\n---\n");
		sections.push("## User Request\n");
		sections.push(userMessage);
	}

	return sections.join("\n");
}

export function formatCommandList(items: CommandInfo[]): string {
	if (items.length === 0) return "No commands or skills found.";

	const lines = ["# Available Commands & Skills\n"];

	for (const command of prioritizeCommands(items)) {
		const hint = command.metadata.argumentHint
			? ` ${command.metadata.argumentHint}`
			: "";
		const categoryDescription = getCommandCategoryDescription(command.name);
		const scopeLabel = categoryDescription
			? `${command.scope}, ${categoryDescription}`
			: command.scope;
		lines.push(
			`- **/${command.name}${hint}**: ${command.metadata.description || "(no description)"} (${scopeLabel})`,
		);
	}

	lines.push(`\n**Total**: ${items.length} items`);
	return lines.join("\n");
}
