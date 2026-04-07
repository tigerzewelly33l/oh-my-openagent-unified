import {
	discoverAllSkills,
	type LazyContentLoader,
	type LoadedSkill,
} from "../../features/opencode-skill-loader";
import { isOckBeadFirstProject } from "../../shared";
import {
	discoverCommandsSync,
	formatLoadedCommand,
	getCommandPriorityLabel,
	prioritizeCommands,
	resolveCommandConflicts,
} from "../../tools/slashcommand";
import type {
	CommandMetadata,
	CommandInfo as DiscoveredCommandInfo,
} from "../../tools/slashcommand/types";
import type { ParsedSlashCommand } from "./types";

interface SkillCommandInfo {
	name: string;
	path?: string;
	metadata: CommandMetadata;
	content?: string;
	scope: "skill";
	lazyContentLoader?: LazyContentLoader;
}

type CommandInfo = DiscoveredCommandInfo | SkillCommandInfo;

function skillToCommandInfo(skill: LoadedSkill): SkillCommandInfo {
	return {
		name: skill.name,
		path: skill.path,
		metadata: {
			name: skill.name,
			description: skill.definition.description || "",
			argumentHint: skill.definition.argumentHint,
			model: skill.definition.model,
			agent: skill.definition.agent,
			subtask: skill.definition.subtask,
		},
		content: skill.definition.template,
		scope: "skill",
		lazyContentLoader: skill.lazyContent,
	};
}

export interface ExecutorOptions {
	skills?: LoadedSkill[];
	pluginsEnabled?: boolean;
	enabledPluginsOverride?: Record<string, boolean>;
	agent?: string;
	directory?: string;
}

async function discoverAllCommands(
	options?: ExecutorOptions,
): Promise<CommandInfo[]> {
	const discoveredCommands = discoverCommandsSync(
		options?.directory ?? process.cwd(),
		{
			pluginsEnabled: options?.pluginsEnabled,
			enabledPluginsOverride: options?.enabledPluginsOverride,
		},
	);
	const preferOckBeadWorkflow = isOckBeadFirstProject(
		options?.directory ?? process.cwd(),
	);
	const prioritizedDiscoveredCommands = prioritizeCommands(
		resolveCommandConflicts(discoveredCommands, preferOckBeadWorkflow),
	);

	const skills = options?.skills ?? (await discoverAllSkills());
	const workflowCommandNames = new Set(
		preferOckBeadWorkflow
			? prioritizedDiscoveredCommands
					.filter(
						(command) => getCommandPriorityLabel(command.name) !== "other",
					)
					.map((command) => command.name.toLowerCase())
			: [],
	);
	const skillCommands = skills
		.map(skillToCommandInfo)
		.filter((skill) => !workflowCommandNames.has(skill.name.toLowerCase()));

	return [...skillCommands, ...prioritizedDiscoveredCommands];
}

async function findCommand(
	commandName: string,
	options?: ExecutorOptions,
): Promise<CommandInfo | null> {
	const allCommands = await discoverAllCommands(options);
	return (
		allCommands.find(
			(cmd) => cmd.name.toLowerCase() === commandName.toLowerCase(),
		) ?? null
	);
}

export interface ExecuteResult {
	success: boolean;
	replacementText?: string;
	error?: string;
}

export async function executeSlashCommand(
	parsed: ParsedSlashCommand,
	options?: ExecutorOptions,
): Promise<ExecuteResult> {
	const command = await findCommand(parsed.command, options);

	if (!command) {
		return {
			success: false,
			error: `Command "/${parsed.command}" not found. Use the skill tool to list available skills and commands.`,
		};
	}

	if (command.scope === "skill" && command.metadata.agent) {
		if (!options?.agent || command.metadata.agent !== options.agent) {
			return {
				success: false,
				error: `Skill "${command.name}" is restricted to agent "${command.metadata.agent}"`,
			};
		}
	}

	try {
		const template = await formatLoadedCommand(command, parsed.args, {
			argumentLabel: "User Arguments",
			includeUserRequestSection: Boolean(parsed.args),
		});
		return {
			success: true,
			replacementText: template,
		};
	} catch (err) {
		return {
			success: false,
			error: `Failed to load command "/${parsed.command}": ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}
