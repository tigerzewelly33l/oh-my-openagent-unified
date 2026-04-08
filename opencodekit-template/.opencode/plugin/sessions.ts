/**
 * OpenCode Session Tools
 * Direct SQLite access for fast, ranked session search.
 *
 * Core tools:
 * - find_sessions: Multi-word AND search with relevance ranking
 * - read_session: Full transcript with keyword filtering
 *
 * Requires Bun runtime (uses bun:sqlite for zero-dep DB access).
 */

import { Database } from "bun:sqlite";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin/tool";

// --- Configuration ---

const SEARCH_CONFIG = {
	roles: ["user", "assistant"],
	defaultLimit: 6,
	maxLimit: 12,
	snippetsPerSession: 2,
	snippetLength: 220,
	sinceHours: 24 * 180, // 180-day lookback window
} as const;

const TRANSCRIPT_CONFIG = {
	roles: ["user", "assistant"],
	defaultLimit: 80,
	maxLimit: 120,
	maxCharsPerEntry: 600,
} as const;

// --- DB helpers ---

const resolveDbPath = (): string => {
	// 1. Env override
	if (process.env.OPENCODE_DB_PATH) return process.env.OPENCODE_DB_PATH;

	// 2. CLI introspection — ask the running binary where the DB is
	try {
		const result = spawnSync("opencode", ["db", "path"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		if (result.status === 0) {
			const p = (result.stdout || "").trim();
			if (p) return p;
		}
	} catch {
		/* fall through */
	}

	// 3. XDG fallback
	return join(
		process.env.HOME || "",
		".local",
		"share",
		"opencode",
		"opencode.db",
	);
};

/** Resolved once at module load — no per-request resolution cost. */
const DEFAULT_DB_PATH = resolveDbPath();

const openReadonlyDb = (): { db: Database | null; error: string | null } => {
	try {
		return {
			db: new Database(DEFAULT_DB_PATH, {
				readonly: true,
				create: false,
				strict: true,
			}),
			error: null,
		};
	} catch (err) {
		return {
			db: null,
			error: err instanceof Error ? err.message : String(err),
		};
	}
};

/** Escape SQL LIKE wildcards for safe pattern matching. */
const escapeLike = (value: string): string =>
	value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

const formatTime = (ms: number): string => new Date(ms).toISOString();

const ROLE_LIST = SEARCH_CONFIG.roles.map((r) => `'${r}'`).join(",");

// --- Plugin ---

export const SessionsPlugin: Plugin = async () => {
	return {
		tool: {
			find_sessions: tool({
				description: `Search sessions by keyword.
	
Example:
find_sessions({ query: "auth", limit: 5 })`,
				args: {
					query: tool.schema.string().describe("Search query"),
					limit: tool.schema
						.number()
						.optional()
						.describe("Max results (default: 10)"),
				},
				async execute(args: { query: string; limit?: number }) {
					const trimmed = args.query.trim();
					if (!trimmed) {
						return JSON.stringify({
							error: "INVALID_QUERY",
							message: "Query cannot be empty",
							dbPath: DEFAULT_DB_PATH,
						});
					}

					const { db, error } = openReadonlyDb();
					if (!db) {
						return JSON.stringify({
							error: "DB_OPEN_FAILED",
							message: error,
							dbPath: DEFAULT_DB_PATH,
						});
					}

					try {
						const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
						const limit = Math.min(
							args.limit || SEARCH_CONFIG.defaultLimit,
							SEARCH_CONFIG.maxLimit,
						);
						const cutoffMs = Date.now() - SEARCH_CONFIG.sinceHours * 3_600_000;

						// Phase 1: Rank sessions by match count + recency
						const likeClauses = words
							.map(
								() =>
									`lower(json_extract(p.data, '$.text')) LIKE ? ESCAPE '\\'`,
							)
							.join(" AND ");

						const rankSql = `
							SELECT s.id AS session_id, s.title, s.directory,
								   COUNT(*) AS match_count,
								   MAX(p.time_created) AS last_match_ms
							FROM part p
							JOIN message m ON m.id = p.message_id
							JOIN session s ON s.id = p.session_id
							WHERE json_extract(p.data, '$.type') = 'text'
							  AND json_extract(p.data, '$.text') IS NOT NULL
							  AND json_extract(m.data, '$.role') IN (${ROLE_LIST})
							  AND ${likeClauses}
							  AND p.time_created >= ?
							GROUP BY s.id
							ORDER BY COUNT(*) DESC, MAX(p.time_created) DESC
							LIMIT ?`;

						const likeParams = words.map((w) => `%${escapeLike(w)}%`);
						const rankParams = [...likeParams, cutoffMs, limit];
						const sessions = db.prepare(rankSql).all(...rankParams) as Array<{
							session_id: string;
							title: string;
							directory: string;
							match_count: number;
							last_match_ms: number;
						}>;

						if (sessions.length === 0) {
							return JSON.stringify({
								query: trimmed,
								sessions: [],
								stats: { totalSessions: 0, totalMatches: 0 },
							});
						}

						// Phase 2: Extract snippets per session
						const snippetSql = `
							SELECT p.session_id, p.time_created,
								   json_extract(m.data, '$.role') AS role,
								   substr(json_extract(p.data, '$.text'), 1, ${SEARCH_CONFIG.snippetLength}) AS snippet
							FROM part p
							JOIN message m ON m.id = p.message_id
							WHERE json_extract(p.data, '$.type') = 'text'
							  AND json_extract(p.data, '$.text') IS NOT NULL
							  AND json_extract(m.data, '$.role') IN (${ROLE_LIST})
							  AND ${likeClauses}
							  AND p.time_created >= ?
							  AND p.session_id = ?
							ORDER BY p.time_created DESC
							LIMIT ?`;

						const results = sessions.map((s) => {
							const snippetParams = [
								...likeParams,
								cutoffMs,
								s.session_id,
								SEARCH_CONFIG.snippetsPerSession,
							];
							const snippets = db
								.prepare(snippetSql)
								.all(...snippetParams) as Array<{
								time_created: number;
								role: string;
								snippet: string;
							}>;

							return {
								sessionId: s.session_id,
								title: s.title,
								directory: s.directory,
								matchCount: s.match_count,
								lastMatch: formatTime(s.last_match_ms),
								snippets: snippets.map((sn) => ({
									time: formatTime(sn.time_created),
									role: sn.role,
									text: sn.snippet,
								})),
							};
						});

						const totalMatches = results.reduce(
							(sum, r) => sum + r.matchCount,
							0,
						);

						return JSON.stringify({
							query: trimmed,
							filters: {
								roles: SEARCH_CONFIG.roles,
								sinceHours: SEARCH_CONFIG.sinceHours,
								snippetsPerSession: SEARCH_CONFIG.snippetsPerSession,
								snippetLength: SEARCH_CONFIG.snippetLength,
							},
							stats: {
								totalSessions: results.length,
								totalMatches,
							},
							sessions: results,
							nextStep: {
								message:
									"Use read_session to get the full transcript. Present options to the user with the question tool.",
								suggestedCalls: results.slice(0, 3).map((s) => ({
									tool: "read_session",
									args: {
										session_id: s.sessionId,
										limit: 60,
										order: "asc",
									},
								})),
								suggestedQuestionCall: {
									tool: "question",
									args: {
										questions: [
											{
												header: "Pick session",
												question:
													"Which session should I open for full transcript context?",
												options: results.slice(0, 8).map((s, i) => ({
													label: `${s.sessionId.slice(0, 24)}${i === 0 ? " (Recommended)" : ""}`,
													description:
														s.title || s.directory || `${s.matchCount} matches`,
												})),
												multiple: false,
											},
										],
									},
								},
							},
						});
					} finally {
						db.close();
					}
				},
			}),

			read_session: tool({
				description: `Read session messages.
	
Example:
read_session({ session_id: "abc123" })
read_session({ session_id: "abc123", focus: "auth" })`,
				args: {
					session_id: tool.schema.string().describe("Session ID"),
					focus: tool.schema.string().optional().describe("Filter by keyword"),
				},
				async execute(args: {
					session_id: string;
					focus?: string;
					limit?: number;
					order?: string;
				}) {
					const { db, error } = openReadonlyDb();
					if (!db) {
						return JSON.stringify({
							error: "DB_OPEN_FAILED",
							message: error,
							dbPath: DEFAULT_DB_PATH,
						});
					}

					try {
						// Session metadata with project join
						const session = db
							.prepare(
								`SELECT s.id, s.title, s.directory, s.slug,
										s.time_created, s.time_updated,
										p.worktree, p.name AS project_name
								 FROM session s
								 LEFT JOIN project p ON p.id = s.project_id
								 WHERE s.id = ?
								 LIMIT 1`,
							)
							.get(args.session_id) as {
							id: string;
							title: string;
							directory: string;
							slug: string;
							time_created: number;
							time_updated: number;
							worktree: string;
							project_name: string;
						} | null;

						if (!session) {
							return JSON.stringify({
								sessionId: args.session_id,
								found: false,
								message: "Session not found",
							});
						}

						const entryLimit = Math.min(
							args.limit || TRANSCRIPT_CONFIG.defaultLimit,
							TRANSCRIPT_CONFIG.maxLimit,
						);
						const sortOrder = args.order === "desc" ? "DESC" : "ASC";

						// Build transcript query with optional focus filter
						const params: (string | number)[] = [args.session_id];
						let focusClauses = "";

						if (args.focus) {
							const words = args.focus
								.toLowerCase()
								.split(/\s+/)
								.filter(Boolean);
							for (const word of words) {
								focusClauses += ` AND lower(json_extract(p.data, '$.text')) LIKE ? ESCAPE '\\'`;
								params.push(`%${escapeLike(word)}%`);
							}
						}

						params.push(entryLimit);

						const entries = db
							.prepare(
								`SELECT p.id AS part_id, p.message_id, p.time_created,
										json_extract(m.data, '$.role') AS role,
										substr(json_extract(p.data, '$.text'), 1, ${TRANSCRIPT_CONFIG.maxCharsPerEntry}) AS text
								 FROM part p
								 JOIN message m ON m.id = p.message_id
								 WHERE p.session_id = ?
								   AND json_extract(p.data, '$.type') = 'text'
								   AND json_extract(m.data, '$.role') IN (${ROLE_LIST})
								   AND json_extract(p.data, '$.text') IS NOT NULL
								   AND length(trim(json_extract(p.data, '$.text'))) > 0
								   ${focusClauses}
								 ORDER BY p.time_created ${sortOrder}
								 LIMIT ?`,
							)
							.all(...params) as Array<{
							part_id: string;
							message_id: string;
							time_created: number;
							role: string;
							text: string;
						}>;

						return JSON.stringify({
							sessionId: args.session_id,
							found: true,
							session: {
								title: session.title,
								slug: session.slug,
								directory: session.directory,
								projectName: session.project_name,
								projectWorktree: session.worktree,
								timeCreated: session.time_created
									? formatTime(session.time_created)
									: null,
								timeUpdated: session.time_updated
									? formatTime(session.time_updated)
									: null,
							},
							filters: {
								roles: TRANSCRIPT_CONFIG.roles,
								order: sortOrder.toLowerCase(),
								maxCharsPerEntry: TRANSCRIPT_CONFIG.maxCharsPerEntry,
								...(args.focus ? { focus: args.focus } : {}),
							},
							stats: {
								entriesReturned: entries.length,
								limit: entryLimit,
							},
							entries: entries.map((e) => ({
								partId: e.part_id,
								messageId: e.message_id,
								timeMs: e.time_created,
								time: formatTime(e.time_created),
								role: e.role,
								text: e.text,
							})),
						});
					} finally {
						db.close();
					}
				},
			}),
		},
	};
};

export default SessionsPlugin;
