/**
 * Stitch Plugin — Google Stitch UI generation as native OpenCode tools.
 *
 * Replaces the MCP subprocess (`npx @_davideast/stitch-mcp proxy`) with
 * direct HTTP via `@google/stitch-sdk`'s `StitchToolClient`.
 *
 * Tools: stitch_create_project, stitch_get_project, stitch_list_projects,
 *        stitch_list_screens, stitch_get_screen, stitch_generate_screen,
 *        stitch_edit_screens, stitch_generate_variants
 *
 * Auth: Set STITCH_API_KEY env var (API key) or STITCH_ACCESS_TOKEN (OAuth).
 */

import { StitchError, StitchToolClient } from "@google/stitch-sdk";
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

let client: StitchToolClient | null = null;

const getClient = (): StitchToolClient => {
	if (!client) {
		client = new StitchToolClient();
	}
	return client;
};

/** Call a Stitch MCP tool and return the result as a JSON string. */
const callTool = async (
	name: string,
	args: Record<string, unknown>,
): Promise<string> => {
	try {
		const result = await getClient().callTool(name, args);
		return JSON.stringify(result, null, 2);
	} catch (err: unknown) {
		if (err instanceof StitchError) {
			return JSON.stringify({
				error: err.code,
				message: err.message,
				...(err.suggestion ? { suggestion: err.suggestion } : {}),
				recoverable: err.recoverable,
				tool: name,
			});
		}
		return JSON.stringify({
			error: "UNKNOWN_ERROR",
			message: err instanceof Error ? err.message : String(err),
			tool: name,
		});
	}
};

// ---------------------------------------------------------------------------
// Enums (for agent guidance — not strict validation)
// ---------------------------------------------------------------------------

const DEVICE_TYPES = [
	"DEVICE_TYPE_UNSPECIFIED",
	"MOBILE",
	"DESKTOP",
	"TABLET",
	"AGNOSTIC",
] as const;

const MODEL_IDS = [
	"MODEL_ID_UNSPECIFIED",
	"GEMINI_3_PRO",
	"GEMINI_3_FLASH",
] as const;

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

export const StitchPlugin: Plugin = async () => {
	return {
		tool: {
			// ---------------------------------------------------------------
			// Projects
			// ---------------------------------------------------------------

			stitch_create_project: tool({
				description:
					"Create a new Google Stitch project.\n\nOptionally provide a title.",
				args: {
					title: tool.schema
						.string()
						.optional()
						.describe("Project title (optional)"),
				},
				async execute(args: { title?: string }) {
					return callTool("create_project", args);
				},
			}),

			stitch_get_project: tool({
				description:
					"Get details of a Stitch project by resource name.\n\nFormat: projects/{projectId}",
				args: {
					name: tool.schema
						.string()
						.describe(
							"Project resource name (e.g. projects/abc123). Required.",
						),
				},
				async execute(args: { name: string }) {
					return callTool("get_project", args);
				},
			}),

			stitch_list_projects: tool({
				description: "List all Stitch projects. Optionally filter by keyword.",
				args: {
					filter: tool.schema
						.string()
						.optional()
						.describe("Filter string (optional)"),
				},
				async execute(args: { filter?: string }) {
					return callTool("list_projects", args);
				},
			}),

			// ---------------------------------------------------------------
			// Screens
			// ---------------------------------------------------------------

			stitch_list_screens: tool({
				description:
					"List all screens in a Stitch project.\n\nRequires projectId.",
				args: {
					projectId: tool.schema.string().describe("Project ID. Required."),
				},
				async execute(args: { projectId: string }) {
					return callTool("list_screens", args);
				},
			}),

			stitch_get_screen: tool({
				description:
					"Get screen details including HTML code.\n\nProvide the screen resource name (format: projects/{projectId}/screens/{screenId}).",
				args: {
					name: tool.schema
						.string()
						.describe(
							"Screen resource name (e.g. projects/abc/screens/xyz). Required.",
						),
				},
				async execute(args: { name: string }) {
					return callTool("get_screen", args);
				},
			}),

			// ---------------------------------------------------------------
			// Generation
			// ---------------------------------------------------------------

			stitch_generate_screen: tool({
				description: `Generate a UI screen from a text prompt.

Device types: ${DEVICE_TYPES.join(", ")}
Model IDs: ${MODEL_IDS.join(", ")}`,
				args: {
					projectId: tool.schema.string().describe("Project ID. Required."),
					prompt: tool.schema
						.string()
						.describe("Text description of the UI to generate. Required."),
					deviceType: tool.schema
						.string()
						.optional()
						.describe(
							`Device type: ${DEVICE_TYPES.join(" | ")} (default: MOBILE)`,
						),
					modelId: tool.schema
						.string()
						.optional()
						.describe(
							`Model: ${MODEL_IDS.join(" | ")} (default: GEMINI_3_FLASH)`,
						),
				},
				async execute(args: {
					projectId: string;
					prompt: string;
					deviceType?: string;
					modelId?: string;
				}) {
					return callTool("generate_screen_from_text", args);
				},
			}),

			stitch_edit_screens: tool({
				description: `Edit existing screens with a text prompt.

Device types: ${DEVICE_TYPES.join(", ")}
Model IDs: ${MODEL_IDS.join(", ")}`,
				args: {
					projectId: tool.schema.string().describe("Project ID. Required."),
					selectedScreenIds: tool.schema
						.array(tool.schema.string())
						.describe("Screen IDs to edit. Required."),
					prompt: tool.schema.string().describe("Edit instructions. Required."),
					deviceType: tool.schema
						.string()
						.optional()
						.describe(
							`Device type: ${DEVICE_TYPES.join(" | ")} (default: MOBILE)`,
						),
					modelId: tool.schema
						.string()
						.optional()
						.describe(
							`Model: ${MODEL_IDS.join(" | ")} (default: GEMINI_3_FLASH)`,
						),
				},
				async execute(args: {
					projectId: string;
					selectedScreenIds: string[];
					prompt: string;
					deviceType?: string;
					modelId?: string;
				}) {
					return callTool("edit_screens", args);
				},
			}),

			stitch_generate_variants: tool({
				description: `Generate design variants of existing screens.

variantOptions:
  - variantCount: number of variants (1-10)
  - creativeRange: LOW, MEDIUM, HIGH (how different from original)
  - aspects: optional comma-separated aspects to vary (e.g. "color,layout")

Device types: ${DEVICE_TYPES.join(", ")}
Model IDs: ${MODEL_IDS.join(", ")}`,
				args: {
					projectId: tool.schema.string().describe("Project ID. Required."),
					selectedScreenIds: tool.schema
						.array(tool.schema.string())
						.describe("Screen IDs to create variants of. Required."),
					prompt: tool.schema
						.string()
						.describe("Prompt describing desired variations. Required."),
					variantCount: tool.schema
						.number()
						.optional()
						.describe("Number of variants to generate (1-10, default: 3)"),
					creativeRange: tool.schema
						.string()
						.optional()
						.describe("Creative range: LOW | MEDIUM | HIGH (default: MEDIUM)"),
					aspects: tool.schema
						.string()
						.optional()
						.describe(
							"Comma-separated aspects to vary (e.g. 'color,layout'). Optional.",
						),
					deviceType: tool.schema
						.string()
						.optional()
						.describe(
							`Device type: ${DEVICE_TYPES.join(" | ")} (default: MOBILE)`,
						),
					modelId: tool.schema
						.string()
						.optional()
						.describe(
							`Model: ${MODEL_IDS.join(" | ")} (default: GEMINI_3_FLASH)`,
						),
				},
				async execute(args: {
					projectId: string;
					selectedScreenIds: string[];
					prompt: string;
					variantCount?: number;
					creativeRange?: string;
					aspects?: string;
					deviceType?: string;
					modelId?: string;
				}) {
					// Build variantOptions object from flat args
					const variantOptions: Record<string, unknown> = {};
					if (args.variantCount != null)
						variantOptions.variantCount = args.variantCount;
					if (args.creativeRange)
						variantOptions.creativeRange = args.creativeRange;
					if (args.aspects) variantOptions.aspects = args.aspects;

					return callTool("generate_variants", {
						projectId: args.projectId,
						selectedScreenIds: args.selectedScreenIds,
						prompt: args.prompt,
						variantOptions,
						...(args.deviceType ? { deviceType: args.deviceType } : {}),
						...(args.modelId ? { modelId: args.modelId } : {}),
					});
				},
			}),
		},
	};
};

export default StitchPlugin;
