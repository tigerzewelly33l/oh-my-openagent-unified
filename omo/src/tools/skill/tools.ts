import { dirname } from "node:path";
import { type ToolDefinition, tool } from "@opencode-ai/plugin";
import type { ToolContext } from "@opencode-ai/plugin/tool";
import type { LoadedSkill } from "../../features/opencode-skill-loader";
import {
	clearSkillCache,
	getAllSkills,
	injectGitMasterConfig,
} from "../../features/opencode-skill-loader/skill-content";
import {
	discoverCommandsSync,
	getCommandPriorityLabel,
} from "../slashcommand/command-discovery";
import { formatLoadedCommand } from "../slashcommand/command-output-formatter";
import type { CommandInfo } from "../slashcommand/types";
import { TOOL_DESCRIPTION_PREFIX } from "./constants";
import { formatCombinedDescription } from "./description-formatter";
import { formatMcpCapabilities } from "./mcp-capability-formatter";
import {
	isPromiseLike,
	loadedSkillToInfo,
	mergeNativeSkillInfos,
	mergeNativeSkills,
} from "./native-skills";
import { extractSkillBody } from "./skill-body";
import {
	findPartialMatches,
	matchCommandByName,
	matchSkillByName,
} from "./skill-matcher";
import type { SkillArgs, SkillLoadOptions } from "./types";

export function createSkillTool(
	options: SkillLoadOptions = {},
): ToolDefinition {
	let cachedDescription: string | null = null;

	const getSkills = async (): Promise<LoadedSkill[]> => {
		clearSkillCache();
		const discovered = await getAllSkills({
			disabledSkills: options?.disabledSkills,
			browserProvider: options?.browserProvider,
		});
		const allSkills = !options.skills
			? discovered
			: [
					...discovered,
					...options.skills.filter(
						(skill) =>
							!new Set(
								discovered.map((discoveredSkill) => discoveredSkill.name),
							).has(skill.name),
					),
				];

		if (options.nativeSkills) {
			try {
				const nativeAll = await options.nativeSkills.all();
				mergeNativeSkills(allSkills, nativeAll);
			} catch {}
		}

		return allSkills;
	};

	const getCommands = (): CommandInfo[] => {
		return discoverCommandsSync(options.directory, {
			pluginsEnabled: options.pluginsEnabled,
			enabledPluginsOverride: options.enabledPluginsOverride,
		});
	};

	const buildDescription = async (force = false): Promise<string> => {
		if (!force && cachedDescription) return cachedDescription;
		const skills = await getSkills();
		const commands = getCommands();
		const skillInfos = skills.map(loadedSkillToInfo);
		cachedDescription = formatCombinedDescription(skillInfos, commands);
		return cachedDescription;
	};

	if (options.skills !== undefined) {
		const skillInfos = options.skills.map(loadedSkillToInfo);
		const commandsForDescription = options.commands ?? [];
		let needsAsyncRefresh = false;

		if (options.nativeSkills) {
			try {
				const nativeAll = options.nativeSkills.all();
				if (isPromiseLike(nativeAll)) {
					needsAsyncRefresh = true;
				} else {
					mergeNativeSkillInfos(skillInfos, nativeAll);
				}
			} catch {}
		}

		cachedDescription = formatCombinedDescription(
			skillInfos,
			commandsForDescription,
		);
		if (needsAsyncRefresh) {
			void buildDescription(true);
		}
	} else if (options.commands !== undefined) {
		cachedDescription = formatCombinedDescription([], options.commands);
	} else {
		void buildDescription();
	}

	return tool({
		get description() {
			if (cachedDescription === null) {
				void buildDescription();
			}
			return cachedDescription ?? TOOL_DESCRIPTION_PREFIX;
		},
		args: {
			name: tool.schema
				.string()
				.describe(
					"The skill or command name (e.g., 'code-review' or 'publish'). Use without leading slash for commands.",
				),
			user_message: tool.schema
				.string()
				.optional()
				.describe(
					"Optional arguments or context for command invocation. Example: name='publish', user_message='patch'",
				),
		},
		async execute(args: SkillArgs, ctx?: ToolContext) {
			const skills = await getSkills();
			const commands = getCommands();
			cachedDescription = formatCombinedDescription(
				skills.map(loadedSkillToInfo),
				commands,
			);

			const requestedName = args.name.replace(/^\//, "");
			const matchedCommand = matchCommandByName(commands, requestedName);
			const shouldPreferWorkflowCommand =
				matchedCommand !== undefined &&
				getCommandPriorityLabel(requestedName) !== "other";

			if (shouldPreferWorkflowCommand) {
				return await formatLoadedCommand(matchedCommand, args.user_message);
			}

			const matchedSkill = matchSkillByName(skills, requestedName);

			if (matchedSkill) {
				if (
					matchedSkill.definition.agent &&
					(!ctx?.agent || matchedSkill.definition.agent !== ctx.agent)
				) {
					throw new Error(
						`Skill "${matchedSkill.name}" is restricted to agent "${matchedSkill.definition.agent}"`,
					);
				}

				let body = await extractSkillBody(matchedSkill);

				if (matchedSkill.name === "git-master") {
					body = injectGitMasterConfig(body, options.gitMasterConfig);
				}

				const dir = matchedSkill.path
					? dirname(matchedSkill.path)
					: matchedSkill.resolvedPath || process.cwd();

				const output = [
					`## Skill: ${matchedSkill.name}`,
					"",
					`**Base directory**: ${dir}`,
					"",
					body,
				];

				if (options.mcpManager && matchedSkill.mcpConfig) {
					const sessionID = ctx?.sessionID || options.getSessionID?.();

					if (!sessionID) {
						return output.join("\n");
					}

					const mcpInfo = await formatMcpCapabilities(
						matchedSkill,
						options.mcpManager,
						sessionID,
					);
					if (mcpInfo) {
						output.push(mcpInfo);
					}
				}

				return output.join("\n");
			}

			if (matchedCommand) {
				return await formatLoadedCommand(matchedCommand, args.user_message);
			}

			const partialMatches = findPartialMatches(
				skills,
				commands,
				requestedName,
			);

			if (partialMatches.length > 0) {
				throw new Error(
					`Skill or command "${args.name}" not found. Did you mean: ${partialMatches.join(", ")}?`,
				);
			}

			const available = [
				...skills.map((skill) => skill.name),
				...commands.map((command) => `/${command.name}`),
			].join(", ");
			throw new Error(
				`Skill or command "${args.name}" not found. Available: ${available || "none"}`,
			);
		},
	});
}

export const skill: ToolDefinition = createSkillTool();
