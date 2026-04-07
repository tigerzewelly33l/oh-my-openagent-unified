export const PRIMARY_WORKFLOW_COMMAND_NAMES = [
	"create",
	"start",
	"plan",
	"ship",
	"pr",
] as const;

export const SUPPORT_COMMAND_NAMES = [
	"verify",
	"status",
	"resume",
	"handoff",
	"research",
] as const;

export const COMPATIBILITY_COMMAND_NAMES = ["lfg", "compound"] as const;

export const OCK_CONFLICTING_BUILTIN_COMMAND_NAMES = [
	"start-work",
	"ralph-loop",
	"ulw-loop",
	"cancel-ralph",
	"stop-continuation",
] as const;

export type CommandPriorityGroup =
	| "primary"
	| "support"
	| "other"
	| "compatibility";

const COMMAND_PRIORITY_RANK = new Map<string, number>([
	...PRIMARY_WORKFLOW_COMMAND_NAMES.map((name, index): [string, number] => [
		name,
		index,
	]),
	...SUPPORT_COMMAND_NAMES.map((name, index): [string, number] => [
		name,
		index,
	]),
	...COMPATIBILITY_COMMAND_NAMES.map((name, index): [string, number] => [
		name,
		index,
	]),
]);

const COMMAND_PRIORITY_ORDER: Record<CommandPriorityGroup, number> = {
	primary: 0,
	support: 1,
	other: 2,
	compatibility: 3,
};

export function getCommandPriorityGroup(
	commandName: string,
): CommandPriorityGroup {
	if (
		PRIMARY_WORKFLOW_COMMAND_NAMES.includes(
			commandName as (typeof PRIMARY_WORKFLOW_COMMAND_NAMES)[number],
		)
	) {
		return "primary";
	}

	if (
		SUPPORT_COMMAND_NAMES.includes(
			commandName as (typeof SUPPORT_COMMAND_NAMES)[number],
		)
	) {
		return "support";
	}

	if (
		COMPATIBILITY_COMMAND_NAMES.includes(
			commandName as (typeof COMPATIBILITY_COMMAND_NAMES)[number],
		)
	) {
		return "compatibility";
	}

	return "other";
}

export function prioritizeNamedValues<T extends { name: string }>(
	values: T[],
): T[] {
	return values
		.map((value, index) => ({
			value,
			index,
			group: getCommandPriorityGroup(value.name),
			rank: getCommandPriorityRank(value.name),
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
		.map(({ value }) => value);
}

export function getCommandPriorityRank(commandName: string): number {
	return COMMAND_PRIORITY_RANK.get(commandName) ?? Number.POSITIVE_INFINITY;
}

export function shouldSuppressBuiltinCommandInOckProject(
	commandName: string,
): boolean {
	return OCK_CONFLICTING_BUILTIN_COMMAND_NAMES.includes(
		commandName as (typeof OCK_CONFLICTING_BUILTIN_COMMAND_NAMES)[number],
	);
}
