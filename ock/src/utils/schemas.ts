/**
 * Zod schemas for CLI command options.
 * Provides runtime validation and type inference for all command inputs.
 */

import { z } from "zod";

// --- Init Command ---

export const InitOptionsSchema = z.object({
	force: z.boolean().optional().default(false),
	beads: z.boolean().optional().default(false),
	global: z.boolean().optional().default(false),
	free: z.boolean().optional().default(false),
	recommend: z.boolean().optional().default(false),
	yes: z.boolean().optional().default(false),
	backup: z.boolean().optional().default(false),
	prune: z.boolean().optional().default(false),
	pruneAll: z.boolean().optional().default(false),
	projectOnly: z.boolean().optional().default(false),
});

export type InitOptions = z.infer<typeof InitOptionsSchema>;

// --- Upgrade Command ---

export const UpgradeOptionsSchema = z.object({
	force: z.boolean().optional().default(false),
	check: z.boolean().optional().default(false),
	prune: z.boolean().optional().default(false),
	pruneAll: z.boolean().optional().default(false),
});

export type UpgradeOptions = z.infer<typeof UpgradeOptionsSchema>;

// --- Config Command ---

export const ConfigActionSchema = z.enum([
	"show",
	"edit",
	"set",
	"get",
	"list",
	"provider",
	"model",
	"agent",
	"mcp",
	"permission",
	"keybinds",
	"theme",
	"tui",
	"tools",
	"share",
	"autoupdate",
	"validate",
]);

export type ConfigAction = z.infer<typeof ConfigActionSchema>;

export const ConfigOptionsSchema = z.object({
	json: z.boolean().optional().default(false),
	global: z.boolean().optional().default(false),
});

export type ConfigOptions = z.infer<typeof ConfigOptionsSchema>;

// --- MCP Command ---

export const McpActionSchema = z.enum(["list", "add", "remove", "toggle"]);

export type McpAction = z.infer<typeof McpActionSchema>;

export const McpOptionsSchema = z.object({
	json: z.boolean().optional().default(false),
	global: z.boolean().optional().default(false),
});

export type McpOptions = z.infer<typeof McpOptionsSchema>;

// --- Agent Command ---

export const AgentActionSchema = z.enum([
	"list",
	"show",
	"create",
	"edit",
	"delete",
]);

export type AgentAction = z.infer<typeof AgentActionSchema>;

export const AgentOptionsSchema = z.object({
	json: z.boolean().optional().default(false),
});

export type AgentOptions = z.infer<typeof AgentOptionsSchema>;

// --- Command Command ---

export const CommandActionSchema = z.enum([
	"list",
	"show",
	"create",
	"edit",
	"delete",
	"run",
]);

export type CommandAction = z.infer<typeof CommandActionSchema>;

export const CommandOptionsSchema = z.object({
	json: z.boolean().optional().default(false),
});

export type CommandOptions = z.infer<typeof CommandOptionsSchema>;

// --- Skill Command ---

export const SkillActionSchema = z.enum([
	"list",
	"show",
	"create",
	"edit",
	"delete",
]);

export type SkillAction = z.infer<typeof SkillActionSchema>;

export const SkillOptionsSchema = z.object({
	json: z.boolean().optional().default(false),
});

export type SkillOptions = z.infer<typeof SkillOptionsSchema>;

// --- Tool Command ---

export const ToolActionSchema = z.enum([
	"list",
	"show",
	"create",
	"edit",
	"delete",
]);

export type ToolAction = z.infer<typeof ToolActionSchema>;

export const ToolOptionsSchema = z.object({
	json: z.boolean().optional().default(false),
});

export type ToolOptions = z.infer<typeof ToolOptionsSchema>;

// --- Patch Command ---

export const PatchActionSchema = z.enum([
	"list",
	"create",
	"apply",
	"diff",
	"remove",
	"disable",
	"enable",
]);

export type PatchAction = z.infer<typeof PatchActionSchema>;

// --- Completion Command ---

export const CompletionShellSchema = z.enum(["bash", "zsh", "fish"]).optional();

export type CompletionShell = z.infer<typeof CompletionShellSchema>;

// --- Menu Command ---

export const MenuActionSchema = z.enum(["status", "doctor"]).optional();

export type MenuAction = z.infer<typeof MenuActionSchema>;

// --- Shared Validation Helper ---

/**
 * Parse and validate command options with Zod.
 * Returns validated options or logs error and returns defaults.
 */
export function parseOptions<T extends z.ZodSchema>(
	schema: T,
	options: unknown,
	defaults?: z.infer<T>,
): z.infer<T> {
	const result = schema.safeParse(options);
	if (result.success) {
		return result.data;
	}

	// Log validation errors in debug mode
	if (process.env.DEBUG) {
		console.error("[Schema validation failed]", result.error.format());
	}

	// Return defaults or empty object
	return defaults ?? schema.parse({});
}

/**
 * Validate action parameter against allowed actions.
 * Returns validated action or undefined if invalid.
 */
export function parseAction<T extends z.ZodEnum<[string, ...string[]]>>(
	schema: T,
	action: string | undefined,
): z.infer<T> | undefined {
	if (!action) return undefined;

	const result = schema.safeParse(action);
	return result.success ? result.data : undefined;
}
