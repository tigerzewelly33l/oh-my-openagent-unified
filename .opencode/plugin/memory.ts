/**
 * Unified Memory Plugin v2
 *
 * Consolidates all memory tools + hooks + compaction into a single plugin.
 *
 * Systems:
 * 1. Capture — message.updated → temporal_messages
 * 2. Distillation — session.idle → TF-IDF compression
 * 3. Curator — session.idle → pattern-matched observations
 * 4. LTM Injection — system.transform → relevance-scored knowledge
 * 5. Context Management — messages.transform → token budget enforcement
 *
 * Tools: observation, memory-search, memory-get, memory-read,
 *        memory-update, memory-timeline, memory-admin
 *
 * Module structure:
 *   memory.ts              — Plugin entry (this file)
 *   lib/memory-helpers.ts  — Constants, compaction utilities, formatting
 *   lib/memory-tools.ts    — Core tools (observation, search, get, read, update, timeline)
 *   lib/memory-admin-tools.ts — Admin tools (memory-admin)
 *   lib/memory-hooks.ts    — Event hooks, transforms, compaction
 *   lib/memory-db.ts       — Database barrel (re-exports from lib/db/*.ts)
 *   lib/capture.ts         — Message capture module
 *   lib/distill.ts         — Heuristic distillation engine
 *   lib/curator.ts         — Pattern-based knowledge extraction
 *   lib/inject.ts          — LTM relevance scoring + injection
 *   lib/context.ts         — Context window management
 */

import path from "node:path";
import type { Plugin } from "@opencode-ai/plugin";
import { createAdminTools } from "./lib/memory-admin-tools.js";
import { createHooks } from "./lib/memory-hooks.js";
import { createCoreTools } from "./lib/memory-tools.js";

// ============================================================================
// Plugin Export
// ============================================================================

export const MemoryPlugin: Plugin = async ({ client, directory }) => {
	const memoryDir = path.join(directory, ".opencode", "memory");
	const handoffDir = path.join(memoryDir, "handoffs");

	// Logging + toast helpers
	const log = async (message: string, level: "info" | "warn" = "info") => {
		await client.app
			.log({ body: { service: "memory", level, message } })
			.catch(() => {});
	};

	const showToast = async (
		title: string,
		message: string,
		variant: "info" | "warning" = "info",
	) => {
		try {
			await client.tui.showToast({
				body: {
					title: `Memory: ${title}`,
					message,
					variant,
					duration: variant === "warning" ? 8000 : 5000,
				},
			});
		} catch {
			/* Toast API unavailable */
		}
	};

	// Assemble tools
	const coreTools = createCoreTools({ handoffDir });
	const adminTools = createAdminTools({ directory });

	// Assemble hooks
	const hooks = createHooks({
		showToast,
		log,
	});

	return {
		tool: {
			...coreTools,
			...adminTools,
		},
		...hooks,
	};
};

export default MemoryPlugin;
