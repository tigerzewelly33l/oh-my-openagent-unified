/**
 * Memory Plugin — Hooks
 *
 * All event handlers, transforms, and compaction logic.
 * Uses factory pattern: createHooks(deps) returns hook definitions.
 *
 * Hook architecture (from @opencode-ai/plugin Hooks interface):
 * - `event` — generic handler for ALL events (session.idle, message.updated, etc.)
 * - Named hooks — separate handlers with (input, output) signature:
 *   - "tool.execute.after", "chat.message", "experimental.chat.*", etc.
 *
 * Events NOT in the Hooks interface (handled via generic `event`):
 * - session.idle, session.error, session.created, session.deleted
 * - message.updated, message.removed, message.part.updated, message.part.removed
 */

import { captureMessageMeta, captureMessagePart } from "./capture.js";
import { manageContext } from "./context.js";
import { curateFromDistillations } from "./curator.js";
import { distillSession } from "./distill.js";
import { buildInjection } from "./inject.js";
import {
	checkFTS5Available,
	checkpointWAL,
	getDatabaseSizes,
	optimizeFTS5,
} from "./memory-db.js";

interface HookDeps {
	showToast: (
		title: string,
		message: string,
		variant?: "info" | "warning",
	) => Promise<void>;
	log: (message: string, level?: "info" | "warn") => Promise<void>;
}

/**
 * Extract a human-readable error message from any value.
 * Handles: Error instances, objects with .message, strings, and arbitrary objects.
 * Never returns "[object Object]".
 */
function extractErrorMessage(value: unknown, maxLen = 200): string {
	if (!value) return "Unknown error";
	if (typeof value === "string") return value.slice(0, maxLen);
	if (value instanceof Error)
		return (value.message || value.name || "Error").slice(0, maxLen);
	if (typeof value === "object" && value !== null) {
		const obj = value as Record<string, unknown>;

		// Handle OpenCode error structure: { name, data: { message, statusCode } }
		if (typeof obj.data === "object" && obj.data !== null) {
			const data = obj.data as Record<string, unknown>;
			if (typeof data.message === "string") {
				const prefix = typeof obj.name === "string" ? `${obj.name}: ` : "";
				const status =
					typeof data.statusCode === "number" ? ` (${data.statusCode})` : "";
				return `${prefix}${data.message}${status}`.slice(0, maxLen);
			}
		}

		// Common error shapes: { message }, { error }, { error: { message } }
		if (typeof obj.message === "string") return obj.message.slice(0, maxLen);
		if (typeof obj.error === "string") return obj.error.slice(0, maxLen);
		if (typeof obj.error === "object" && obj.error !== null) {
			const inner = obj.error as Record<string, unknown>;
			if (typeof inner.message === "string")
				return inner.message.slice(0, maxLen);
		}
		// Last resort: JSON stringify with truncation
		try {
			const json = JSON.stringify(value);
			return json.slice(0, maxLen);
		} catch {
			return "Non-serializable error object";
		}
	}
	// number, boolean, symbol, etc.
	return String(value).slice(0, maxLen);
}

export function createHooks(deps: HookDeps) {
	const { showToast, log } = deps;

	return {
		// ================================================================
		// Generic event handler — ALL events route through here
		// Receives: { event: { type, properties? } }
		// ================================================================
		event: async (input: unknown) => {
			const { event } = input as {
				event: {
					type?: string;
					properties?: Record<string, unknown>;
				};
			};
			if (!event?.type) return;

			// --- Message capture ---
			if (event.type === "message.updated") {
				try {
					captureMessageMeta(
						event.properties as Parameters<typeof captureMessageMeta>[0],
					);
				} catch {
					/* Non-fatal */
				}
			}

			if (event.type === "message.part.updated") {
				try {
					captureMessagePart(
						event.properties as Parameters<typeof captureMessagePart>[0],
					);
				} catch {
					/* Non-fatal */
				}
			}

			// --- Session idle: distill + curate + optimize ---
			if (event.type === "session.idle") {
				const sessionId =
					(event.properties as { sessionID?: string })?.sessionID ??
					(event as unknown as { sessionID?: string })?.sessionID;
				try {
					if (sessionId) distillSession(sessionId);
					curateFromDistillations(sessionId, 5);
					if (checkFTS5Available()) optimizeFTS5();
					const sizes = getDatabaseSizes();
					if (sizes.wal > 1024 * 1024) checkpointWAL();
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					await log(`Idle maintenance failed: ${msg}`, "warn");
				}
			}

			// --- Session error: classify and guide ---
			if (event.type === "session.error") {
				const props = event.properties as Record<string, unknown> | undefined;
				const errorObj = props?.error ?? props?.message ?? "Unknown error";
				const errorMsg = extractErrorMessage(errorObj);

				// Extract status code from error object for classification
				const rawCode =
					typeof errorObj === "object" && errorObj !== null
						? ((errorObj as Record<string, unknown>).data as Record<string, unknown>
							)?.statusCode ??
							(errorObj as Record<string, unknown>).statusCode
						: undefined;
				const statusCode =
					typeof rawCode === "number"
						? rawCode
						: typeof rawCode === "string"
							? Number(rawCode) || undefined
							: undefined;

				// Log full error for debugging
				await log(`Session error: ${errorMsg}`, "warn");

				// Classify error and provide specific guidance
				let guidance: string;
				if (
					/token.{0,20}(exceed|limit)/i.test(errorMsg) ||
					errorMsg.includes("context_length_exceeded")
				) {
					guidance = "Context too large — use /compact or start a new session";
				} else if (
					/rate.?limit|too many requests/i.test(errorMsg) ||
					statusCode === 429
				) {
					guidance = "Rate limited — wait a moment and retry";
				} else if (
					/unauthorized|auth/i.test(errorMsg) ||
					statusCode === 401 ||
					statusCode === 403
				) {
					guidance = "Auth error — check API key or token";
				} else if (
					statusCode === 400 ||
					/bad request|invalid.*request/i.test(errorMsg)
				) {
					// Sub-classify 400 errors for more specific guidance
					if (
						/thinking.?block|invalid.*signature|reasoning/i.test(errorMsg)
					) {
						guidance =
							"Thinking block error — start a new session to reset";
					} else if (
						/context.*(too|exceed|length|large|limit)|too.?long|max.?length|content.?length/i.test(errorMsg)
					) {
						guidance =
							"Request too large — use /compact to reduce context";
					} else if (
						/invalid.*\bid\b|item.*\bid\b|unknown.*\bid\b|malformed.*\bid\b/i.test(errorMsg)
					) {
						guidance = "API format error — start a new session";
					} else {
						guidance =
							"Bad request — try starting a new session or using /compact";
					}
				} else if (
					/timeout|ETIMEDOUT|ECONNRESET|network|fetch failed/i.test(errorMsg)
				) {
					guidance = "Network error — check connection and retry";
				} else if (
					/invalid.*signature|thinking block/i.test(errorMsg)
				) {
					guidance = "API format error — try starting a new session";
				} else if (
					statusCode === 500 ||
					statusCode === 502 ||
					statusCode === 503 ||
					statusCode === 504 ||
					/internal server|service unavailable/i.test(errorMsg)
				) {
					guidance = "Server error — retry in a few seconds";
				} else {
					guidance =
						"Unexpected error — save work with observation tool if needed";
				}

				const short =
					errorMsg.length > 100 ? `${errorMsg.slice(0, 100)}…` : errorMsg;
				await showToast("Session Error", `${guidance} (${short})`, "warning");
			}
		},

		// ================================================================
		// Named hook: tool.execute.after
		// Receives: (input: { tool, sessionID, callID, args }, output: { title, output, metadata })
		// ================================================================
		"tool.execute.after": async (input: {
			tool?: string;
			sessionID?: string;
		}) => {
			try {
				if (input.tool === "observation" && typeof showToast === "function") {
					await showToast("Saved", "Observation added to memory");
				}
			} catch {
				/* Toast is cosmetic, never block tool execution */
			}
		},

		// ================================================================
		// LTM injection into system prompt
		// ================================================================
		"experimental.chat.system.transform": async (
			_input: unknown,
			output: { system: string[] },
		) => {
			try {
				const injection = buildInjection(output.system);
				if (injection) output.system.push(injection);
			} catch {
				/* Non-fatal */
			}
		},

		// ================================================================
		// Context window management
		// ================================================================
		"experimental.chat.messages.transform": async (
			_input: unknown,
			output: { messages: unknown[] },
		) => {
			try {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				output.messages = manageContext(output.messages as any) as any;
			} catch {
				/* Non-fatal */
			}
		},

		// ================================================================
		// Compaction — inject session continuity context
		// Receives: (input: { sessionID }, output: { context, prompt? })
		// ================================================================
		"experimental.session.compacting": async (
			_input: { sessionID?: string },
			output: { context: string[]; prompt?: string },
		) => {
			// No context injection here — the session is already at the
			// model limit when compaction fires. Only append prompt guidance.
			output.prompt = `${output.prompt ?? ""}

<compaction_task>
Summarize conversation state for reliable continuation after compaction.
</compaction_task>

<compaction_rules>
- Preserve exact IDs, file paths, and unresolved constraints.
- Distinguish completed work from current in-progress work.
- Keep summary concise and execution-focused.
- If critical context is missing, state uncertainty explicitly.
</compaction_rules>

<compaction_output>
Include:
- What was done
- What is being worked on now
- Files currently in play
- Next actions
- Persistent user constraints/preferences
</compaction_output>
`;
		},
	};
}
