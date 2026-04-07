import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { basename, join } from "path";
import { loadBuiltinCommands } from "../../features/builtin-commands";
import type { CommandFrontmatter } from "../../features/claude-code-command-loader/types";
import {
	type CommandPriorityGroup,
	discoverPluginCommandDefinitions,
	findProjectOpencodeCommandDirs,
	getClaudeConfigDir,
	getCommandPriorityGroup,
	getCommandPriorityRank,
	getOpenCodeCommandDirs,
	isOckBeadFirstProject,
	log,
	parseFrontmatter,
	sanitizeModelField,
	shouldSuppressBuiltinCommandInOckProject,
} from "../../shared";
import { isMarkdownFile } from "../../shared/file-utils";
import type { CommandInfo, CommandMetadata, CommandScope } from "./types";

export interface CommandDiscoveryOptions {
	pluginsEnabled?: boolean;
	enabledPluginsOverride?: Record<string, boolean>;
}

const NESTED_COMMAND_SEPARATOR = "/";

const COMMAND_PRIORITY_ORDER: Record<CommandPriorityGroup, number> = {
	primary: 0,
	support: 1,
	other: 2,
	compatibility: 3,
};

const OCK_BEAD_FIRST_WORKFLOW_SCOPE_PRIORITY: Record<CommandScope, number> = {
	"opencode-project": 0,
	project: 1,
	config: 2,
	user: 3,
	opencode: 4,
	builtin: 5,
	plugin: 6,
};

export function prioritizeCommands<T extends { name: string }>(
	commands: T[],
): T[] {
	return commands
		.map((command, index) => ({
			command,
			index,
			group: getCommandPriorityGroup(command.name),
			rank: getCommandPriorityRank(command.name),
		}))
		.sort((left, right) => {
			const priorityDifference =
				COMMAND_PRIORITY_ORDER[left.group] -
				COMMAND_PRIORITY_ORDER[right.group];

			if (priorityDifference !== 0) {
				return priorityDifference;
			}

			const rankDifference = left.rank - right.rank;

			if (rankDifference !== 0) {
				return rankDifference;
			}

			return left.index - right.index;
		})
		.map(({ command }) => command);
}

export function getCommandPriorityLabel(
	commandName: string,
): CommandPriorityGroup {
	return getCommandPriorityGroup(commandName);
}

function getCommandScopePriority(
	command: CommandInfo,
	preferOckBeadWorkflow: boolean,
): number {
	const commandPriorityGroup = getCommandPriorityGroup(command.name);

	if (preferOckBeadWorkflow && commandPriorityGroup !== "other") {
		return OCK_BEAD_FIRST_WORKFLOW_SCOPE_PRIORITY[command.scope];
	}

	return Number.POSITIVE_INFINITY;
}

function discoverCommandsFromDir(
	commandsDir: string,
	scope: CommandScope,
	prefix = "",
): CommandInfo[] {
	if (!existsSync(commandsDir)) return [];
	if (!statSync(commandsDir).isDirectory()) {
		log(`[command-discovery] Skipping non-directory path: ${commandsDir}`);
		return [];
	}

	const entries = readdirSync(commandsDir, { withFileTypes: true });
	const commands: CommandInfo[] = [];

	for (const entry of entries) {
		if (entry.isDirectory()) {
			if (entry.name.startsWith(".")) continue;
			const nestedPrefix = prefix
				? `${prefix}${NESTED_COMMAND_SEPARATOR}${entry.name}`
				: entry.name;
			commands.push(
				...discoverCommandsFromDir(
					join(commandsDir, entry.name),
					scope,
					nestedPrefix,
				),
			);
			continue;
		}

		if (!isMarkdownFile(entry)) continue;

		const commandPath = join(commandsDir, entry.name);
		const baseCommandName = basename(entry.name, ".md");
		const commandName = prefix
			? `${prefix}${NESTED_COMMAND_SEPARATOR}${baseCommandName}`
			: baseCommandName;

		try {
			const content = readFileSync(commandPath, "utf-8");
			const { data, body } = parseFrontmatter<CommandFrontmatter>(content);

			const isOpencodeSource =
				scope === "opencode" || scope === "opencode-project";
			const metadata: CommandMetadata = {
				name: commandName,
				description: data.description || "",
				argumentHint: data["argument-hint"],
				model: sanitizeModelField(
					data.model,
					isOpencodeSource ? "opencode" : "claude-code",
				),
				agent: data.agent,
				subtask: Boolean(data.subtask),
			};

			commands.push({
				name: commandName,
				path: commandPath,
				metadata,
				content: body,
				scope,
			});
		} catch {}
	}

	return commands;
}

function discoverPluginCommands(
	options?: CommandDiscoveryOptions,
): CommandInfo[] {
	const pluginDefinitions = discoverPluginCommandDefinitions(options);

	return Object.entries(pluginDefinitions).map(([name, definition]) => ({
		name,
		metadata: {
			name,
			description: definition.description || "",
			model: definition.model,
			agent: definition.agent,
			subtask: definition.subtask,
		},
		content: definition.template,
		scope: "plugin",
	}));
}

function filterBuiltinCommandsForOckRepo(
	commands: CommandInfo[],
	beadFirstProject: boolean,
): CommandInfo[] {
	if (!beadFirstProject) {
		return commands;
	}

	return commands.filter(
		(command) => !shouldSuppressBuiltinCommandInOckProject(command.name),
	);
}

export function resolveCommandConflicts(
	commands: CommandInfo[],
	preferOckBeadWorkflow: boolean,
): CommandInfo[] {
	const bestCommandByName = new Map<
		string,
		{ command: CommandInfo; index: number; priority: number }
	>();

	for (const [index, command] of commands.entries()) {
		const priority = getCommandScopePriority(command, preferOckBeadWorkflow);
		const existing = bestCommandByName.get(command.name);

		if (
			!existing ||
			priority < existing.priority ||
			(priority === existing.priority && index < existing.index)
		) {
			bestCommandByName.set(command.name, { command, index, priority });
		}
	}

	return [...bestCommandByName.values()]
		.sort((left, right) => left.index - right.index)
		.map(({ command }) => command);
}

export function discoverCommandsSync(
	directory?: string,
	options?: CommandDiscoveryOptions,
): CommandInfo[] {
	const userCommandsDir = join(getClaudeConfigDir(), "commands");
	const projectCommandsDir = join(
		directory ?? process.cwd(),
		".claude",
		"commands",
	);
	const opencodeGlobalDirs = getOpenCodeCommandDirs({ binary: "opencode" });
	const opencodeProjectDirs = findProjectOpencodeCommandDirs(
		directory ?? process.cwd(),
	);
	const preferOckBeadWorkflow = isOckBeadFirstProject(
		directory ?? process.cwd(),
	);

	const userCommands = discoverCommandsFromDir(userCommandsDir, "user");
	const opencodeGlobalCommands = opencodeGlobalDirs.flatMap((commandsDir) =>
		discoverCommandsFromDir(commandsDir, "opencode"),
	);
	const projectCommands = discoverCommandsFromDir(
		projectCommandsDir,
		"project",
	);
	const opencodeProjectCommands = opencodeProjectDirs.flatMap((commandsDir) =>
		discoverCommandsFromDir(commandsDir, "opencode-project"),
	);
	const pluginCommands = discoverPluginCommands(options);

	const builtinCommandsMap = loadBuiltinCommands();
	const builtinCommands = filterBuiltinCommandsForOckRepo(
		Object.values(builtinCommandsMap).map((command) => ({
			name: command.name,
			metadata: {
				name: command.name,
				description: command.description || "",
				argumentHint: command.argumentHint,
				model: command.model,
				agent: command.agent,
				subtask: command.subtask,
			},
			content: command.template,
			scope: "builtin",
		})),
		preferOckBeadWorkflow,
	);

	return prioritizeCommands(
		resolveCommandConflicts(
			[
				...projectCommands,
				...userCommands,
				...opencodeProjectCommands,
				...opencodeGlobalCommands,
				...builtinCommands,
				...pluginCommands,
			],
			preferOckBeadWorkflow,
		),
	);
}
