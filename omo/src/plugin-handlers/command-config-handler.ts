import type { OhMyOpenCodeConfig } from "../config";
import { loadBuiltinCommands } from "../features/builtin-commands";
import {
	loadOpencodeGlobalCommands,
	loadOpencodeProjectCommands,
	loadProjectCommands,
	loadUserCommands,
} from "../features/claude-code-command-loader";
import type { CommandDefinition } from "../features/claude-code-command-loader/types";
import {
	discoverConfigSourceSkills,
	loadGlobalAgentsSkills,
	loadOpencodeGlobalSkills,
	loadOpencodeProjectSkills,
	loadProjectAgentsSkills,
	loadProjectSkills,
	loadUserSkills,
	skillsToCommandDefinitionRecord,
} from "../features/opencode-skill-loader";
import {
	detectExternalSkillPlugin,
	getCommandPriorityGroup,
	getSkillPluginConflictWarning,
	isOckBeadFirstProject,
	log,
	prioritizeNamedValues,
	shouldSuppressBuiltinCommandInOckProject,
} from "../shared";
import { getAgentListDisplayName } from "../shared/agent-display-names";
import type { PluginComponents } from "./plugin-components-loader";

type CommandDefinitionRecord = Record<string, CommandDefinition>;

type RuntimeCommandScope =
	| "project"
	| "config"
	| "user"
	| "opencode-project"
	| "opencode"
	| "builtin"
	| "plugin";

function filterBuiltinCommandsForOckRepo(
	commands: CommandDefinitionRecord,
	beadFirstProject: boolean,
): CommandDefinitionRecord {
	if (!beadFirstProject) {
		return commands;
	}

	return Object.fromEntries(
		Object.entries(commands).filter(
			([commandName]) => !shouldSuppressBuiltinCommandInOckProject(commandName),
		),
	);
}

const OCK_BEAD_FIRST_WORKFLOW_SCOPE_PRIORITY: Record<
	RuntimeCommandScope,
	number
> = {
	"opencode-project": 0,
	project: 1,
	config: 2,
	user: 3,
	opencode: 4,
	builtin: 5,
	plugin: 6,
};

function getCommandScopePriority(
	scope: RuntimeCommandScope,
	commandName: string,
	preferOckBeadWorkflow: boolean,
): number {
	if (
		preferOckBeadWorkflow &&
		getCommandPriorityGroup(commandName) !== "other"
	) {
		return OCK_BEAD_FIRST_WORKFLOW_SCOPE_PRIORITY[scope];
	}

	return Number.POSITIVE_INFINITY;
}

function mergeCommandSource(params: {
	source: CommandDefinitionRecord;
	scope: RuntimeCommandScope;
	target: CommandDefinitionRecord;
	selectedPriorities: Map<string, number>;
	selectedOrder: Map<string, number>;
	preferOckBeadWorkflow: boolean;
	mergeIndex: number;
}): number {
	let mergeIndex = params.mergeIndex;

	for (const [commandName, definition] of Object.entries(params.source)) {
		mergeIndex += 1;

		if (getCommandPriorityGroup(commandName) === "other") {
			params.target[commandName] = definition;
			params.selectedPriorities.delete(commandName);
			params.selectedOrder.set(commandName, mergeIndex);
			continue;
		}

		if (!params.preferOckBeadWorkflow) {
			params.target[commandName] = definition;
			params.selectedPriorities.delete(commandName);
			params.selectedOrder.set(commandName, mergeIndex);
			continue;
		}

		const incomingPriority = getCommandScopePriority(
			params.scope,
			commandName,
			params.preferOckBeadWorkflow,
		);
		const existingPriority = params.selectedPriorities.get(commandName);
		const existingOrder = params.selectedOrder.get(commandName) ?? -1;

		if (
			existingPriority === undefined ||
			incomingPriority < existingPriority ||
			(incomingPriority === existingPriority && mergeIndex >= existingOrder)
		) {
			params.target[commandName] = definition;
			params.selectedPriorities.set(commandName, incomingPriority);
			params.selectedOrder.set(commandName, mergeIndex);
		}
	}

	return mergeIndex;
}

export async function applyCommandConfig(params: {
	config: Record<string, unknown>;
	pluginConfig: OhMyOpenCodeConfig;
	ctx: { directory: string };
	pluginComponents: PluginComponents;
}): Promise<void> {
	const preferOckBeadWorkflow = isOckBeadFirstProject(params.ctx.directory);
	const builtinCommands = filterBuiltinCommandsForOckRepo(
		loadBuiltinCommands(params.pluginConfig.disabled_commands, {
			useRegisteredAgents: true,
		}),
		preferOckBeadWorkflow,
	);
	const systemCommands =
		(params.config.command as CommandDefinitionRecord) ?? {};

	const includeClaudeCommands =
		params.pluginConfig.claude_code?.commands ?? true;
	const includeClaudeSkills = params.pluginConfig.claude_code?.skills ?? true;

	const externalSkillPlugin = detectExternalSkillPlugin(params.ctx.directory);
	if (includeClaudeSkills && externalSkillPlugin.detected) {
		log(getSkillPluginConflictWarning(externalSkillPlugin.pluginName!));
	}

	const [
		configSourceSkills,
		userCommands,
		projectCommands,
		opencodeGlobalCommands,
		opencodeProjectCommands,
		userSkills,
		globalAgentsSkills,
		projectSkills,
		projectAgentsSkills,
		opencodeGlobalSkills,
		opencodeProjectSkills,
	] = await Promise.all([
		discoverConfigSourceSkills({
			config: params.pluginConfig.skills,
			configDir: params.ctx.directory,
		}),
		includeClaudeCommands ? loadUserCommands() : Promise.resolve({}),
		includeClaudeCommands
			? loadProjectCommands(params.ctx.directory)
			: Promise.resolve({}),
		loadOpencodeGlobalCommands(),
		loadOpencodeProjectCommands(params.ctx.directory),
		includeClaudeSkills ? loadUserSkills() : Promise.resolve({}),
		includeClaudeSkills ? loadGlobalAgentsSkills() : Promise.resolve({}),
		includeClaudeSkills
			? loadProjectSkills(params.ctx.directory)
			: Promise.resolve({}),
		includeClaudeSkills
			? loadProjectAgentsSkills(params.ctx.directory)
			: Promise.resolve({}),
		loadOpencodeGlobalSkills(),
		loadOpencodeProjectSkills(params.ctx.directory),
	]);

	const mergedCommands: CommandDefinitionRecord = {};
	const selectedPriorities = new Map<string, number>();
	const selectedOrder = new Map<string, number>();

	let mergeIndex = 0;
	const commandSources: Array<{
		source: CommandDefinitionRecord;
		scope: RuntimeCommandScope;
	}> = [
		{ source: builtinCommands as CommandDefinitionRecord, scope: "builtin" },
		{
			source: skillsToCommandDefinitionRecord(
				configSourceSkills,
			) as CommandDefinitionRecord,
			scope: "config",
		},
		{ source: userCommands as CommandDefinitionRecord, scope: "user" },
		{ source: userSkills as CommandDefinitionRecord, scope: "user" },
		{ source: globalAgentsSkills as CommandDefinitionRecord, scope: "user" },
		{
			source: opencodeGlobalCommands as CommandDefinitionRecord,
			scope: "opencode",
		},
		{
			source: opencodeGlobalSkills as CommandDefinitionRecord,
			scope: "opencode",
		},
		{ source: systemCommands, scope: "config" },
		{ source: projectCommands as CommandDefinitionRecord, scope: "project" },
		{ source: projectSkills as CommandDefinitionRecord, scope: "project" },
		{
			source: projectAgentsSkills as CommandDefinitionRecord,
			scope: "project",
		},
		{
			source: opencodeProjectCommands as CommandDefinitionRecord,
			scope: "opencode-project",
		},
		{
			source: opencodeProjectSkills as CommandDefinitionRecord,
			scope: "opencode-project",
		},
		{
			source: params.pluginComponents.commands as CommandDefinitionRecord,
			scope: "plugin",
		},
		{
			source: params.pluginComponents.skills as CommandDefinitionRecord,
			scope: "plugin",
		},
	];

	for (const commandSource of commandSources) {
		mergeIndex = mergeCommandSource({
			...commandSource,
			target: mergedCommands,
			selectedPriorities,
			selectedOrder,
			preferOckBeadWorkflow,
			mergeIndex,
		});
	}

	params.config.command = preferOckBeadWorkflow
		? Object.fromEntries(
				prioritizeNamedValues(
					Object.entries(mergedCommands).map(([name, definition]) => ({
						name,
						definition,
					})),
				).map(({ name, definition }) => [name, definition]),
			)
		: mergedCommands;

	remapCommandAgentFields(params.config.command as CommandDefinitionRecord);
}

function remapCommandAgentFields(commands: CommandDefinitionRecord): void {
	for (const cmd of Object.values(commands)) {
		if (cmd?.agent && typeof cmd.agent === "string") {
			cmd.agent = getAgentListDisplayName(cmd.agent);
		}
	}
}
