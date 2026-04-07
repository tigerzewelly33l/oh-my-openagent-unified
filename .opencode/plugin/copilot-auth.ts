/**
 * GitHub Copilot Auth Plugin
 * Simplified auth provider without token expiration checks
 *
 * Claude Reasoning Support:
 * This plugin adds `thinking_budget` to the request body for Claude models.
 * The Copilot API accepts this parameter and returns reasoning in the response.
 *
 * NOTE: Response parsing for reasoning_text/reasoning_opaque is handled by
 * the custom SDK at .opencode/plugin/sdk/copilot/ which properly converts
 * these fields to AI SDK's reasoning content parts.
 */

import type { Plugin } from "@opencode-ai/plugin";

const CLIENT_ID = "Ov23li8tweQw6odWQebz";

// Logger function that will be set by the plugin
let log: (
	level: "debug" | "info" | "warn" | "error",
	message: string,
	extra?: Record<string, any>,
) => void = () => {};

/**
 * Set the logger function from the plugin context
 */
function setLogger(client: any) {
	log = (level, message, extra) => {
		client.app
			.log({
				service: "copilot-auth",
				level,
				message,
				extra,
			})
			.catch(() => {}); // Fire and forget, don't block on logging
	};
}

// Add a small safety buffer when polling to avoid hitting the server
// slightly too early due to clock skew / timer drift.
const OAUTH_POLLING_SAFETY_MARGIN_MS = 3000; // 3 seconds

const HEADERS = {
	"User-Agent": "GitHubCopilotChat/0.35.0",
	"Editor-Version": "vscode/1.107.0",
	"Editor-Plugin-Version": "copilot-chat/0.35.0",
	"Copilot-Integration-Id": "vscode-chat",
};

const RESPONSES_API_ALTERNATE_INPUT_TYPES = [
	"file_search_call",
	"computer_call",
	"computer_call_output",
	"web_search_call",
	"function_call",
	"function_call_output",
	"image_generation_call",
	"code_interpreter_call",
	"local_shell_call",
	"local_shell_call_output",
	"mcp_list_tools",
	"mcp_approval_request",
	"mcp_approval_response",
	"mcp_call",
	"reasoning",
];

// Expected ID prefixes per Responses API item type.
// The OpenAI Responses API validates that item IDs start with specific prefixes.
// GitHub Copilot's backend (especially GPT models) returns non-standard prefixes
// (e.g., "h_" instead of "fc_") or no prefix at all that the API then rejects on replay.
const RESPONSES_API_EXPECTED_PREFIXES: Record<string, string> = {
	function_call: "fc_",
	local_shell_call: "fc_",
	// function_call_output.call_id prefix is validated directly in sanitizeResponseInputIds
};

// Role-based items (role: "assistant", "user", etc.) are internally typed as "message"
// by the OpenAI Responses API and their IDs must start with "msg_".
const RESPONSES_API_ROLE_PREFIX = "msg_";

function normalizeDomain(url: string): string {
	return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function getUrls(domain: string) {
	return {
		DEVICE_CODE_URL: `https://${domain}/login/device/code`,
		ACCESS_TOKEN_URL: `https://${domain}/login/oauth/access_token`,
	};
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Rate limit handling configuration
const RATE_LIMIT_CONFIG = {
	maxDelayMs: 60000, // Cap at 60 seconds
	defaultCooldownMs: 60000, // Default cooldown when Retry-After header is missing
};

// Local request shaping to smooth bursts before they hit Copilot limits
const REQUEST_SHAPING_CONFIG = {
	tokensPerSecond: 1,
	burstCapacity: 2,
	maxQueueDelayMs: 15000,
};

// Per-model rate limit state (in-memory, resets on restart)
interface RateLimitEntry {
	rateLimitedUntil: number; // Unix timestamp (ms)
}
const rateLimitState = new Map<string, RateLimitEntry>();
const familyCircuitBreakerState = new Map<string, number>();

interface TokenBucketState {
	tokens: number;
	lastRefillAt: number;
}
const modelTokenBuckets = new Map<string, TokenBucketState>();
const modelQueueTail = new Map<string, Promise<void>>();

// Model fallback chains: same-family alternatives when a model is rate-limited
const MODEL_FALLBACK_CHAINS: Record<string, string[]> = {
	// Claude family
	"claude-opus-4.6": [
		"claude-opus-4.5",
		"claude-sonnet-4.6",
		"claude-sonnet-4.5",
	],
	"claude-opus-4.5": [
		"claude-opus-4.6",
		"claude-sonnet-4.5",
		"claude-sonnet-4.6",
	],
	"claude-sonnet-4.6": [
		"claude-sonnet-4.5",
		"claude-opus-4.6",
		"claude-opus-4.5",
	],
	"claude-sonnet-4.5": [
		"claude-sonnet-4.6",
		"claude-opus-4.5",
		"claude-opus-4.6",
	],
};

/**
 * Parse the Retry-After header from a 429 response.
 * Returns cooldown in milliseconds, or null if header is missing/unparseable.
 */
function parseRetryAfter(response: Response): number | null {
	const header = response.headers.get("retry-after");
	if (!header) return null;
	// Try as seconds first (most common)
	const seconds = parseInt(header, 10);
	if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
	// Try as HTTP date
	const date = Date.parse(header);
	if (!isNaN(date)) return Math.max(0, date - Date.now());
	return null;
}

function clampCooldownMs(
	value: number | null | undefined,
	fallbackMs = 0,
): number {
	return Math.min(
		Math.max(value ?? fallbackMs, 0),
		RATE_LIMIT_CONFIG.maxDelayMs,
	);
}

function getRateLimitRemainingMs(model: string): number | null {
	const entry = rateLimitState.get(model);
	if (!entry) return null;
	const remaining = entry.rateLimitedUntil - Date.now();
	if (remaining <= 0) {
		rateLimitState.delete(model);
		return null;
	}
	return remaining;
}

function getModelFamily(model: string): string[] {
	const family = new Set<string>([
		model,
		...(MODEL_FALLBACK_CHAINS[model] || []),
	]);
	return [...family];
}

function getFamilyCircuitKey(model: string): string {
	return getModelFamily(model).sort().join("|");
}

function getFamilyCircuitRemainingMs(model: string): number {
	const key = getFamilyCircuitKey(model);
	const until = familyCircuitBreakerState.get(key);
	if (!until) return 0;
	const remaining = until - Date.now();
	if (remaining <= 0) {
		familyCircuitBreakerState.delete(key);
		return 0;
	}
	return remaining;
}

function openFamilyCircuitBreaker(model: string, cooldownMs: number): void {
	const key = getFamilyCircuitKey(model);
	familyCircuitBreakerState.set(key, Date.now() + clampCooldownMs(cooldownMs));
}

function getFamilyMaxCooldownRemainingMs(model: string): number {
	let maxRemaining = 0;
	for (const candidate of getModelFamily(model)) {
		const remaining = getRateLimitRemainingMs(candidate) ?? 0;
		if (remaining > maxRemaining) maxRemaining = remaining;
	}
	return maxRemaining;
}

function formatRetryAfter(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

async function shapeRequestForModel(model: string): Promise<void> {
	if (!model) return;

	const previousTail = modelQueueTail.get(model) ?? Promise.resolve();
	let releaseQueue: (() => void) | undefined;
	const currentGate = new Promise<void>((resolve) => {
		releaseQueue = resolve;
	});
	const currentTail = previousTail.then(() => currentGate);
	modelQueueTail.set(model, currentTail);

	let queueTimeout: ReturnType<typeof setTimeout> | undefined;
	try {
		await Promise.race([
			previousTail,
			new Promise<void>((_, reject) => {
				queueTimeout = setTimeout(() => {
					reject(
						new Error(
							`[Copilot] Local request queue saturated for ${model}. Retry in ${formatRetryAfter(Math.ceil(REQUEST_SHAPING_CONFIG.maxQueueDelayMs / 1000))}.`,
						),
					);
				}, REQUEST_SHAPING_CONFIG.maxQueueDelayMs);
			}),
		]);

		const now = Date.now();
		const bucket = modelTokenBuckets.get(model) ?? {
			tokens: REQUEST_SHAPING_CONFIG.burstCapacity,
			lastRefillAt: now,
		};

		const elapsedMs = Math.max(0, now - bucket.lastRefillAt);
		const refillTokens =
			(elapsedMs / 1000) * REQUEST_SHAPING_CONFIG.tokensPerSecond;
		bucket.tokens = Math.min(
			REQUEST_SHAPING_CONFIG.burstCapacity,
			bucket.tokens + refillTokens,
		);
		bucket.lastRefillAt = now;

		if (bucket.tokens < 1) {
			const deficit = 1 - bucket.tokens;
			const waitMs = Math.ceil(
				(deficit / REQUEST_SHAPING_CONFIG.tokensPerSecond) * 1000,
			);
			if (waitMs > REQUEST_SHAPING_CONFIG.maxQueueDelayMs) {
				throw new Error(
					`[Copilot] Local request queue saturated for ${model}. Retry in ${formatRetryAfter(Math.ceil(waitMs / 1000))}.`,
				);
			}
			log("info", `Local request shaping wait for ${model}`, {
				wait_ms: waitMs,
			});
			await sleep(waitMs);
			bucket.tokens = 0;
			bucket.lastRefillAt = Date.now();
		} else {
			bucket.tokens -= 1;
		}

		modelTokenBuckets.set(model, bucket);
	} finally {
		if (queueTimeout) clearTimeout(queueTimeout);
		releaseQueue?.();
		if (modelQueueTail.get(model) === currentTail) {
			modelQueueTail.delete(model);
		}
	}
}

function markModelRateLimited(model: string, cooldownMs: number): void {
	const boundedCooldownMs = clampCooldownMs(cooldownMs);
	rateLimitState.set(model, {
		rateLimitedUntil: Date.now() + boundedCooldownMs,
	});
	log(
		"info",
		`Marked ${model} as rate-limited for ${Math.round(boundedCooldownMs / 1000)}s`,
	);
}

// Maximum length for item IDs in the OpenAI Responses API
const MAX_RESPONSE_API_ID_LENGTH = 64;
// OpenAI Responses API only allows: letters, numbers, underscores, dashes
const INVALID_ID_CHARS = /[^a-zA-Z0-9_-]/g;

/** Check if an ID contains characters not allowed by the Responses API */
function hasInvalidIdChars(id: string): boolean {
	// Use a non-global regex for .test() to avoid lastIndex state bug
	return /[^a-zA-Z0-9_-]/.test(id);
}

/**
 * Sanitize an ID for the Responses API.
 * Handles three issues from GitHub Copilot:
 * 1. Invalid characters — Copilot IDs contain +, |, /, = (base64-like encoding)
 * 2. Wrong prefix — GPT models return "h_" instead of "fc_" for function_call items
 * 3. Excessive length — Copilot returns 400+ char IDs (max is 64)
 *
 * Approach matches anomalyco/opencode: replace invalid chars with "_", preserve prefix,
 * truncate to 64 chars, strip trailing underscores.
 *
 * @param id - The original ID to sanitize
 * @param forcedPrefix - If provided, use this prefix instead of the detected one.
 * See: https://github.com/vercel/ai/issues/5171
 */
function sanitizeResponseId(id: string, forcedPrefix?: string): string {
	if (!id) return id;

	// Detect the original prefix (e.g., "fc_", "msg_", "call_", "resp_", "h_")
	const prefixMatch = id.match(/^([a-z]+_)/);
	const detectedPrefix = prefixMatch ? prefixMatch[1] : "";
	const prefix = forcedPrefix ?? detectedPrefix;

	// Strip the original prefix to get the core ID
	const rawCore = id.slice(detectedPrefix.length);
	// Replace invalid characters with underscores (same as anomalyco/opencode)
	const cleanCore = rawCore.replace(INVALID_ID_CHARS, "_").replace(/_+$/g, "");

	// Check if any sanitization is actually needed
	const needsSanitization =
		forcedPrefix ||
		hasInvalidIdChars(rawCore) ||
		id.length > MAX_RESPONSE_API_ID_LENGTH;

	if (!needsSanitization) return id;

	// If result fits within length and core is non-empty, use cleaned core directly
	if (
		cleanCore.length > 0 &&
		prefix.length + cleanCore.length <= MAX_RESPONSE_API_ID_LENGTH
	) {
		return `${prefix}${cleanCore}`;
	}

	// Hash the full original ID for deterministic uniqueness when truncating
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = ((hash << 5) - hash + id.charCodeAt(i)) | 0;
	}
	const hashStr = Math.abs(hash).toString(36);
	const maxMiddleLen =
		MAX_RESPONSE_API_ID_LENGTH - prefix.length - hashStr.length - 1;
	const middle = cleanCore.slice(0, Math.max(0, maxMiddleLen));
	// Format: prefix + middle + "_" + hash (ensure total <= 64)
	const result = `${prefix}${middle}_${hashStr}`.slice(
		0,
		MAX_RESPONSE_API_ID_LENGTH,
	);
	// Strip trailing underscores from truncation
	return result.replace(/_+$/, "");
}

/**
 * Check if an ID has the expected prefix for its item type.
 * Handles both type-based items (function_call → "fc_") and
 * role-based items (assistant/user/developer/system → "msg_").
 * Returns the expected prefix if the ID is wrong, or null if it's fine.
 */
function getExpectedPrefix(item: any): string | null {
	if (!item || typeof item !== "object") return null;
	if (typeof item.id !== "string") return null;

	// Type-based items: function_call, local_shell_call, etc.
	if (item.type) {
		const expected = RESPONSES_API_EXPECTED_PREFIXES[item.type];
		if (expected && !item.id.startsWith(expected)) {
			return expected;
		}
	}

	// Role-based items: assistant, user, developer, system → "msg_" prefix
	if (item.role && !item.id.startsWith(RESPONSES_API_ROLE_PREFIX)) {
		return RESPONSES_API_ROLE_PREFIX;
	}

	return null;
}

/** Check if a string ID needs sanitization (invalid chars or too long) */
function idNeedsSanitization(id: string): boolean {
	return id.length > MAX_RESPONSE_API_ID_LENGTH || hasInvalidIdChars(id);
}

/**
 * Sanitize all IDs in a Responses API input array.
 *
 * Handles THREE classes of invalid IDs:
 * 1. Invalid characters — Copilot IDs contain +, |, /, = (only [a-zA-Z0-9_-] allowed)
 * 2. Wrong prefix — Copilot GPT models return IDs like "h_xxx" instead of "fc_xxx"
 * 3. Excessive length — Copilot returns 400+ char IDs that exceed the 64-char limit.
 *
 * Uses a two-pass approach:
 * - Pass 1: Build an ID remap for all invalid IDs
 * - Pass 2: Apply the remap to both `id` and `call_id` fields consistently,
 *   so function_call_output.call_id stays in sync with function_call.id
 */
function sanitizeResponseInputIds(input: any[]): any[] {
	// Pass 1: Build ID remapping
	const idRemap = new Map<string, string>();

	for (const item of input) {
		if (!item || typeof item !== "object") continue;

		// Check for wrong prefix (e.g., function_call with "h_" instead of "fc_")
		const expectedPrefix = getExpectedPrefix(item);
		if (
			expectedPrefix &&
			typeof item.id === "string" &&
			!idRemap.has(item.id)
		) {
			const newId = sanitizeResponseId(item.id, expectedPrefix);
			if (newId !== item.id) {
				idRemap.set(item.id, newId);
			}
		}

		// Check for invalid chars or excessive length on id
		if (
			typeof item.id === "string" &&
			idNeedsSanitization(item.id) &&
			!idRemap.has(item.id)
		) {
			idRemap.set(item.id, sanitizeResponseId(item.id));
		}

		// Check for wrong prefix on call_id (defensive: handles truncated conversations
		// where function_call_output appears without its corresponding function_call)
		if (
			item.type === "function_call_output" &&
			typeof item.call_id === "string" &&
			!item.call_id.startsWith("fc_") &&
			!idRemap.has(item.call_id)
		) {
			const newCallId = sanitizeResponseId(item.call_id, "fc_");
			if (newCallId !== item.call_id) {
				idRemap.set(item.call_id, newCallId);
			}
		}

		// Check for invalid chars or excessive length on call_id
		if (
			typeof item.call_id === "string" &&
			idNeedsSanitization(item.call_id) &&
			!idRemap.has(item.call_id)
		) {
			idRemap.set(item.call_id, sanitizeResponseId(item.call_id));
		}
	}

	// No changes needed
	if (idRemap.size === 0) return input;

	// Pass 2: Apply remapping to both id and call_id fields
	return input.map((item: any) => {
		if (!item || typeof item !== "object") return item;
		const sanitized = { ...item };
		if (typeof sanitized.id === "string" && idRemap.has(sanitized.id)) {
			sanitized.id = idRemap.get(sanitized.id);
		}
		if (
			typeof sanitized.call_id === "string" &&
			idRemap.has(sanitized.call_id)
		) {
			sanitized.call_id = idRemap.get(sanitized.call_id);
		}
		return sanitized;
	});
}

export const CopilotAuthPlugin: Plugin = async ({ client: sdk }) => {
	// Initialize logger with the SDK client
	setLogger(sdk);

	return {
		auth: {
			provider: "github-copilot",
			loader: async (getAuth, provider) => {
				const info = await getAuth();
				if (!info || info.type !== "oauth") return {};

				// Enterprise URL support for baseURL
				const enterpriseUrl = (info as any).enterpriseUrl;
				const baseURL = enterpriseUrl
					? `https://copilot-api.${normalizeDomain(enterpriseUrl)}`
					: undefined;

				if (provider && provider.models) {
					for (const [_modelId, model] of Object.entries(provider.models)) {
						model.cost = {
							input: 0,
							output: 0,
							cache: {
								read: 0,
								write: 0,
							},
						};

						// All models use the standard github-copilot SDK
						// Reasoning support for Claude models is handled via:
						// 1. The fetch wrapper adds thinking_budget to request body
						// 2. The fetch wrapper strips invalid thinking blocks from messages
						model.api.npm = "@ai-sdk/github-copilot";
					}
				}

				return {
					baseURL,
					apiKey: "",
					async fetch(input, init) {
						const info = await getAuth();
						if (info.type !== "oauth") return fetch(input, init);

						let isAgentCall = false;
						let isVisionRequest = false;
						let modifiedBody: any;
						let isClaudeModel = false;

						try {
							const body =
								typeof init?.body === "string"
									? JSON.parse(init.body)
									: init?.body;

							const url = input.toString();

							// Check if this is a Claude model request
							const modelId = body?.model || "";
							isClaudeModel = modelId.toLowerCase().includes("claude");

							// Completions API
							if (body?.messages && url.includes("completions")) {
								// Keep local logic: detect if any message is assistant/tool
								isAgentCall = body.messages.some((msg: any) =>
									["tool", "assistant"].includes(msg.role),
								);
								isVisionRequest = body.messages.some(
									(msg: any) =>
										Array.isArray(msg.content) &&
										msg.content.some((part: any) => part.type === "image_url"),
								);

								// For Claude models, add thinking_budget to enable reasoning
								// The Copilot API accepts this parameter and returns reasoning_text/reasoning_opaque
								if (isClaudeModel) {
									// Use configured thinking_budget from model options, or default to 10000
									const thinkingBudget = body.thinking_budget || 10000;

									// Fix for "Invalid signature in thinking block" error:
									// The Copilot API uses reasoning_text/reasoning_opaque format for thinking
									// When these are passed back without proper signature, it causes errors
									// Solution: Ensure reasoning_opaque is present when reasoning_text exists,
									// or remove reasoning content entirely if signature is invalid/missing
									const cleanedMessages = body.messages.map(
										(msg: any, idx: number) => {
											if (msg.role !== "assistant") return msg;

											// Log message structure for debugging
											log("debug", `Processing assistant message ${idx}`, {
												has_reasoning_text: !!msg.reasoning_text,
												has_reasoning_opaque: !!msg.reasoning_opaque,
												content_type: typeof msg.content,
												content_is_array: Array.isArray(msg.content),
											});

											// If message has reasoning_text but no/invalid reasoning_opaque, remove reasoning
											if (msg.reasoning_text && !msg.reasoning_opaque) {
												log(
													"warn",
													`Removing reasoning_text without reasoning_opaque from message ${idx}`,
												);
												const { reasoning_text: _unused, ...cleanedMsg } = msg;
												return cleanedMsg;
											}

											// If content is an array, strip ALL thinking blocks.
											// Reasoning is communicated via reasoning_text/reasoning_opaque
											// fields, not via thinking blocks in the content array.
											// Even thinking blocks WITH signatures can cause
											// "Invalid signature in thinking block" errors when
											// signatures are expired or from a different context.
											if (Array.isArray(msg.content)) {
												const hasThinkingBlock = msg.content.some(
													(part: any) => part.type === "thinking",
												);
												if (hasThinkingBlock) {
													log(
														"debug",
														`Stripping all thinking blocks from message ${idx}`,
													);
													const cleanedContent = msg.content.filter(
														(part: any) => part.type !== "thinking",
													);
													return {
														...msg,
														content:
															cleanedContent.length > 0 ? cleanedContent : null,
													};
												}
											}

											return msg;
										},
									);

									modifiedBody = {
										...body,
										messages: cleanedMessages,
										thinking_budget: thinkingBudget,
									};
									log("info", `Adding thinking_budget for Claude model`, {
										model: modelId,
										thinking_budget: thinkingBudget,
									});
								}

								// For GPT models (o1, gpt-5, etc.), add reasoning parameter
								const isGptModel =
									modelId.toLowerCase().includes("gpt") ||
									modelId.toLowerCase().includes("o1") ||
									modelId.toLowerCase().includes("o3") ||
									modelId.toLowerCase().includes("o4");

								if (isGptModel && !isClaudeModel) {
									// Get reasoning effort from body options or default to "medium"
									const reasoningEffort =
										body.reasoning?.effort ||
										body.reasoningEffort ||
										body.reasoning_effort ||
										"medium";

									modifiedBody = {
										...(modifiedBody || body),
										reasoning: {
											effort: reasoningEffort,
										},
									};

									// Also pass through other reasoning options if present
									if (body.reasoningSummary || body.reasoning?.summary) {
										modifiedBody.reasoning.summary =
											body.reasoningSummary || body.reasoning?.summary;
									}

									log("info", `Adding reasoning for GPT model`, {
										model: modelId,
										reasoning_effort: reasoningEffort,
									});
								}
							}

							// Responses API
							if (body?.input) {
								// Log raw IDs before sanitization for debugging
								const rawIds = body.input
									.filter((item: any) => item && typeof item === "object")
									.flatMap((item: any) => [
										item.id ? `id=${item.id}` : null,
										item.call_id ? `call_id=${item.call_id}` : null,
									])
									.filter(Boolean);
								if (rawIds.length > 0) {
									log(
										"debug",
										"[ID-SANITIZE] Raw input IDs before sanitization",
										{
											ids: rawIds,
											count: rawIds.length,
										},
									);
								}

								// Sanitize IDs from Copilot backend:
								// 1. Wrong prefix — GPT models return "h_xxx" instead of "fc_xxx"
								// 2. Excessive length — Copilot returns 400+ char IDs (max is 64)
								const sanitizedInput = sanitizeResponseInputIds(body.input);
								const refDiffers = sanitizedInput !== body.input;
								const jsonDiffers =
									refDiffers &&
									JSON.stringify(sanitizedInput) !== JSON.stringify(body.input);
								const inputWasSanitized = refDiffers && jsonDiffers;

								log("debug", "[ID-SANITIZE] Sanitization result", {
									was_sanitized: inputWasSanitized,
									ref_differs: refDiffers,
									json_differs: jsonDiffers,
								});

								if (inputWasSanitized) {
									const fixes = body.input
										.map((item: any, i: number) => ({
											item,
											i,
											si: sanitizedInput[i],
										}))
										.filter(
											({ item, si }: any) =>
												item &&
												si &&
												(item.id !== si.id || item.call_id !== si.call_id),
										);
									log(
										"info",
										"[ID-SANITIZE] Fixed IDs in Responses API input",
										{
											items_fixed: fixes.length,
											fixes: fixes.map(({ item, si }: any) => ({
												type: item.type,
												old_id: item.id,
												new_id: si?.id,
												old_call_id: item.call_id,
												new_call_id: si?.call_id,
											})),
										},
									);
									modifiedBody = {
										...(modifiedBody || body),
										input: sanitizedInput,
									};
								} else {
									log(
										"debug",
										"[ID-SANITIZE] No sanitization needed — all IDs valid",
									);
								}

								isAgentCall = (sanitizedInput || body.input).some(
									(item: any) =>
										item?.role === "assistant" ||
										(item?.type &&
											RESPONSES_API_ALTERNATE_INPUT_TYPES.includes(item.type)),
								);

								isVisionRequest = body.input.some(
									(item: any) =>
										Array.isArray(item?.content) &&
										item.content.some(
											(part: any) => part.type === "input_image",
										),
								);
							}

							// Messages API (Anthropic style)
							if (body?.messages && !url.includes("completions")) {
								isAgentCall = body.messages.some((msg: any) =>
									["tool", "assistant"].includes(msg.role),
								);
								isVisionRequest = body.messages.some(
									(item: any) =>
										Array.isArray(item?.content) &&
										item.content.some(
											(part: any) =>
												part?.type === "image" ||
												(part?.type === "tool_result" &&
													Array.isArray(part?.content) &&
													part.content.some(
														(nested: any) => nested?.type === "image",
													)),
										),
								);
							}
						} catch {}

						const headers: Record<string, string> = {
							"x-initiator": isAgentCall ? "agent" : "user",
							...(init?.headers as Record<string, string>),
							...HEADERS,
							Authorization: `Bearer ${info.refresh}`,
							"Openai-Intent": "conversation-edits",
						};

						if (isVisionRequest) {
							headers["Copilot-Vision-Request"] = "true";
						}

						// Official only deletes lowercase "authorization"
						delete headers["x-api-key"];
						delete headers["authorization"];

						// Prepare the final init object with potentially modified body
						const finalInit = {
							...init,
							headers,
							...(modifiedBody ? { body: JSON.stringify(modifiedBody) } : {}),
						};

						// Extract model from request body for rate limit tracking
						let currentModel = "";
						try {
							const bodyObj =
								typeof finalInit.body === "string"
									? JSON.parse(finalInit.body)
									: finalInit.body;
							currentModel = bodyObj?.model || "";
						} catch {}

						// Pre-flight: fail fast if current model family is cooling down
						const activeFinalInit: RequestInit = finalInit;
						if (currentModel) {
							const familyCooldownMs = Math.max(
								getFamilyCircuitRemainingMs(currentModel),
								getFamilyMaxCooldownRemainingMs(currentModel),
							);
							if (familyCooldownMs > 0) {
								throw new Error(
									`[Copilot] Rate limited: all fallback models cooling down. Retry in ${formatRetryAfter(Math.ceil(familyCooldownMs / 1000))}.`,
								);
							}
						}

						try {
							if (currentModel) {
								await shapeRequestForModel(currentModel);
							}
							const response = await fetch(input, activeFinalInit);

							if (response.status === 429) {
								try {
									await response.body?.cancel();
								} catch {}

								const retryAfterMs = parseRetryAfter(response);
								const cooldownMs = clampCooldownMs(
									retryAfterMs,
									RATE_LIMIT_CONFIG.defaultCooldownMs,
								);

								if (currentModel) {
									markModelRateLimited(currentModel, cooldownMs);
									openFamilyCircuitBreaker(currentModel, cooldownMs);
								}

								throw new Error(
									`[Copilot] Rate limited: ${currentModel || "model"} cooling down. Retry in ${formatRetryAfter(Math.ceil(cooldownMs / 1000))}.`,
								);
							}

							// Response transformation is handled by the custom SDK at
							// .opencode/plugin/sdk/copilot/
							return response;
						} catch (error) {
							const lastError = error as Error;
							if (
								lastError.message.includes("Rate limited") ||
								lastError.message.includes("Local request queue saturated")
							) {
								throw lastError;
							}
							throw error;
						}
					},
				};
			},
			methods: [
				{
					type: "oauth",
					label: "Login with GitHub Copilot",
					prompts: [
						{
							type: "select",
							key: "deploymentType",
							message: "Select GitHub deployment type",
							options: [
								{
									label: "GitHub.com",
									value: "github.com",
									hint: "Public",
								},
								{
									label: "GitHub Enterprise",
									value: "enterprise",
									hint: "Data residency or self-hosted",
								},
							],
						},
						{
							type: "text",
							key: "enterpriseUrl",
							message: "Enter your GitHub Enterprise URL or domain",
							placeholder: "company.ghe.com or https://company.ghe.com",
							condition: (inputs: any) =>
								inputs.deploymentType === "enterprise",
							validate: (value: string) => {
								if (!value) return "URL or domain is required";
								try {
									const url = value.includes("://")
										? new URL(value)
										: new URL(`https://${value}`);
									if (!url.hostname)
										return "Please enter a valid URL or domain";
									return undefined;
								} catch {
									return "Please enter a valid URL (e.g., company.ghe.com or https://company.ghe.com)";
								}
							},
						},
					],
					async authorize(inputs: any = {}) {
						const deploymentType = inputs.deploymentType || "github.com";

						let domain = "github.com";
						let actualProvider = "github-copilot";

						if (deploymentType === "enterprise") {
							const enterpriseUrl = inputs.enterpriseUrl;
							domain = normalizeDomain(enterpriseUrl);
							actualProvider = "github-copilot-enterprise";
						}

						const urls = getUrls(domain);

						const deviceResponse = await fetch(urls.DEVICE_CODE_URL, {
							method: "POST",
							headers: {
								Accept: "application/json",
								"Content-Type": "application/json",
								"User-Agent": "GitHubCopilotChat/0.35.0",
							},
							body: JSON.stringify({
								client_id: CLIENT_ID,
								scope: "read:user",
							}),
						});

						if (!deviceResponse.ok) {
							throw new Error("Failed to initiate device authorization");
						}

						const deviceData = await deviceResponse.json();

						return {
							url: deviceData.verification_uri,
							instructions: `Enter code: ${deviceData.user_code}`,
							method: "auto",
							callback: async () => {
								while (true) {
									const response = await fetch(urls.ACCESS_TOKEN_URL, {
										method: "POST",
										headers: {
											Accept: "application/json",
											"Content-Type": "application/json",
											"User-Agent": "GitHubCopilotChat/0.35.0",
										},
										body: JSON.stringify({
											client_id: CLIENT_ID,
											device_code: deviceData.device_code,
											grant_type:
												"urn:ietf:params:oauth:grant-type:device_code",
										}),
									});

									if (!response.ok) return { type: "failed" };

									const data = await response.json();

									if (data.access_token) {
										const result: {
											type: "success";
											refresh: string;
											access: string;
											expires: number;
											provider?: string;
											enterpriseUrl?: string;
										} = {
											type: "success",
											refresh: data.access_token,
											access: data.access_token,
											expires: 0,
										};

										if (actualProvider === "github-copilot-enterprise") {
											result.provider = "github-copilot-enterprise";
											result.enterpriseUrl = domain;
										}

										return result;
									}

									if (data.error === "authorization_pending") {
										await sleep(
											deviceData.interval * 1000 +
												OAUTH_POLLING_SAFETY_MARGIN_MS,
										);
										continue;
									}

									if (data.error === "slow_down") {
										// Based on the RFC spec, we must add 5 seconds to our current polling interval.
										let newInterval = (deviceData.interval + 5) * 1000;

										if (
											data.interval &&
											typeof data.interval === "number" &&
											data.interval > 0
										) {
											newInterval = data.interval * 1000;
										}

										await sleep(newInterval + OAUTH_POLLING_SAFETY_MARGIN_MS);
										continue;
									}

									if (data.error) return { type: "failed" };

									await sleep(
										deviceData.interval * 1000 + OAUTH_POLLING_SAFETY_MARGIN_MS,
									);
								}
							},
						};
					},
				},
			],
		},
		// Hook to add custom headers for Claude reasoning support
		"chat.headers": async (input: any, output: any) => {
			// Only apply to GitHub Copilot provider
			if (!input.model?.providerID?.includes("github-copilot")) return;

			// Add Anthropic beta header for interleaved thinking (extended reasoning)
			// This is required for Claude models to return thinking blocks
			if (input.model?.api?.npm === "@ai-sdk/anthropic") {
				output.headers["anthropic-beta"] = "interleaved-thinking-2025-05-14";
			}

			// Mark subagent sessions as agent-initiated (matching standard Copilot tools)
			try {
				const session = await sdk.session
					.get({
						path: {
							id: input.sessionID,
						},
						throwOnError: true,
					})
					.catch(() => undefined);
				if (session?.data?.parentID) {
					output.headers["x-initiator"] = "agent";
				}
			} catch {
				// Ignore errors from session lookup
			}
		},
	};
};
