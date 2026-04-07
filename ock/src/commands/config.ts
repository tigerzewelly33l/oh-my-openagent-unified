import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";
import { requireOpencodePath, showError, unknownAction } from "../utils/errors.js";
import { ConfigActionSchema, parseAction } from "../utils/schemas.js";

// OpenCode Server API types (from types.gen.ts)
interface ServerProvider {
	id: string;
	name: string;
	models: Record<string, ServerModel>;
}

interface ServerModel {
	id: string;
	name: string;
	reasoning: boolean;
	attachment: boolean;
	limit: { context: number; output: number };
}

interface ServerAgent {
	name: string;
	description?: string;
	mode: "subagent" | "primary" | "all";
	builtIn: boolean;
	model?: { modelID: string; providerID: string };
}

interface ProviderListResponse {
	all: ServerProvider[];
	default: Record<string, string>;
	connected: string[];
}

interface OpenCodeConfig {
	$schema?: string;
	model?: string;
	small_model?: string;
	theme?: string;
	share?: "manual" | "auto" | "disabled";
	autoupdate?: boolean | "notify";
	mcp?: Record<string, MCPServer>;
	permission?: {
		bash?: Record<string, string>;
		edit?: string;
		external_directory?: string;
		webfetch?: string;
		doom_loop?: string;
	};
	keybinds?: Record<string, string>;
	provider?: Record<string, ProviderConfig>;
	agent?: Record<string, AgentConfig>;
	formatter?: Record<string, unknown>;
	plugin?: string[];
	tools?: Record<string, boolean>;
	// New properties from official schema
	tui?: TuiConfig;
	command?: Record<string, CommandConfig>;
	watcher?: WatcherConfig;
	snapshot?: boolean;
	disabled_providers?: string[];
	enabled_providers?: string[];
	username?: string;
	lsp?: Record<string, LspConfig>;
	instructions?: string[];
	enterprise?: EnterpriseConfig;
	experimental?: ExperimentalConfig;
	[key: string]: unknown;
}

interface ProviderConfig {
	name?: string;
	npm?: string;
	options?: Record<string, unknown>;
	models?: Record<string, ModelConfig>;
}

interface ModelConfig {
	name?: string;
	id?: string;
	attachment?: boolean;
	reasoning?: boolean;
	temperature?: boolean;
	tool_call?: boolean;
	limit?: { context?: number; output?: number };
	options?: Record<string, unknown>;
}

interface AgentConfig {
	description?: string;
	model?: string;
	disable?: boolean;
	// New properties from official schema
	temperature?: number;
	top_p?: number;
	prompt?: string;
	tools?: Record<string, boolean>;
	mode?: "subagent" | "primary" | "all";
	color?: string;
	maxSteps?: number;
	permission?: {
		bash?: Record<string, string>;
		edit?: string;
		external_directory?: string;
		webfetch?: string;
		doom_loop?: string;
	};
}

interface MCPServer {
	type: "local" | "remote";
	enabled?: boolean;
	command?: string[];
	url?: string;
	headers?: Record<string, string>;
	environment?: Record<string, string>;
	timeout?: number;
	oauth?: {
		type: "oauth";
		client_id: string;
		client_secret?: string;
		authorize_url: string;
		token_url: string;
		scopes?: string[];
	};
}

// TUI configuration
interface TuiConfig {
	scroll_speed?: number;
	scroll_acceleration?: number;
	diff_style?: "unified" | "split";
}

// Custom command configuration
interface CommandConfig {
	template?: string;
	description?: string;
	agent?: string;
	model?: string;
	subtask?: boolean;
}

// Watcher configuration
interface WatcherConfig {
	ignore?: string[];
}

// LSP server configuration
interface LspConfig {
	command?: string[];
	extensions?: string[];
}

// Enterprise configuration
interface EnterpriseConfig {
	url?: string;
}

// Experimental features
interface ExperimentalConfig {
	[key: string]: boolean | string | number;
}

interface ModelOption {
	value: string;
	label: string;
	hint?: string;
}

// Default OpenCode server port
const DEFAULT_SERVER_PORT = 4096;
const MODELS_DEV_URL = "https://models.dev/api.json";

interface ModelsDevProvider {
	id: string;
	name: string;
	models: Record<string, ModelsDevModel>;
}

interface ModelsDevModel {
	id: string;
	name: string;
	reasoning?: boolean;
	limit?: { context?: number; output?: number };
}

// models.dev returns a dictionary of providers
type ModelsDevResponse = Record<string, ModelsDevProvider>;

async function fetchFromServer<T>(endpoint: string): Promise<T | null> {
	try {
		const response = await fetch(
			`http://127.0.0.1:${DEFAULT_SERVER_PORT}${endpoint}`,
		);
		if (!response.ok) return null;
		return (await response.json()) as T;
	} catch {
		return null;
	}
}

async function fetchFromModelsDev(): Promise<ModelsDevResponse | null> {
	try {
		const response = await fetch(MODELS_DEV_URL);
		if (!response.ok) return null;
		return (await response.json()) as ModelsDevResponse;
	} catch {
		return null;
	}
}

async function getProvidersFromServer(): Promise<ProviderListResponse | null> {
	return fetchFromServer<ProviderListResponse>("/provider");
}

async function getAgentsFromServer(): Promise<ServerAgent[] | null> {
	return fetchFromServer<ServerAgent[]>("/agent");
}

export async function configCommand(action?: string) {
	const opencodePath = requireOpencodePath();
	if (!opencodePath) return;

	const configPath = join(opencodePath, "opencode.json");

	if (!existsSync(configPath)) {
		showError("opencode.json not found", "ock init --force");
		return;
	}

	// No action = interactive menu
	if (!action) {
		await configMenu(configPath);
		return;
	}

	const validatedAction = parseAction(ConfigActionSchema, action);
	if (!validatedAction) {
		unknownAction(action, [
			"model",
			"mcp",
			"permission",
			"keybinds",
			"theme",
			"tui",
			"tools",
			"share",
			"autoupdate",
			"show",
			"validate",
		]);
		return;
	}

	switch (validatedAction) {
		case "model":
			await editModel(configPath);
			break;
		case "mcp":
			await editMCP(configPath);
			break;
		case "permission":
			await editPermissions(configPath);
			break;
		case "keybinds":
			await editKeybinds(configPath);
			break;
		case "theme":
			await editTheme(configPath);
			break;
		case "tui":
			await editTui(configPath);
			break;
		case "tools":
			await editTools(configPath);
			break;
		case "share":
			await editShare(configPath);
			break;
		case "autoupdate":
			await editAutoupdate(configPath);
			break;
		case "show":
			showConfig(configPath);
			break;
		case "validate":
			await validateConfig(configPath);
			break;
		default:
			unknownAction(action, [
				"model",
				"mcp",
				"permission",
				"keybinds",
				"theme",
				"tui",
				"tools",
				"share",
				"autoupdate",
				"show",
				"validate",
			]);
	}
}

function loadConfig(configPath: string): OpenCodeConfig {
	const content = readFileSync(configPath, "utf-8");
	// Strip JSON comments before parsing (JSONC support)
	// Only strip line comments at start of line to avoid breaking URLs like https://
	const jsonWithoutComments = content
		.replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments /* */
		.replace(/^\s*\/\/.*$/gm, ""); // Remove full-line comments only
	return JSON.parse(jsonWithoutComments);
}

function saveConfig(configPath: string, config: OpenCodeConfig): void {
	writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
}

const OPENCODE_SCHEMA_URL = "https://opencode.ai/config.json";

// Known top-level properties from official schema
const KNOWN_PROPERTIES = new Set([
	"$schema",
	"model",
	"small_model",
	"theme",
	"share",
	"autoupdate",
	"mcp",
	"permission",
	"keybinds",
	"provider",
	"agent",
	"formatter",
	"plugin",
	"tools",
	"tui",
	"command",
	"watcher",
	"snapshot",
	"disabled_providers",
	"enabled_providers",
	"username",
	"lsp",
	"instructions",
	"enterprise",
	"experimental",
	"compaction",
]);

interface ValidationIssue {
	type: "error" | "warning";
	path: string;
	message: string;
}

async function validateConfig(configPath: string): Promise<void> {
	p.intro(color.bgBlue(color.white(" Validate Configuration ")));

	const issues: ValidationIssue[] = [];

	// Step 1: Check if file is valid JSON
	let config: OpenCodeConfig;
	try {
		config = loadConfig(configPath);
		p.log.success("Valid JSON syntax");
	} catch (err) {
		p.log.error(
			`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
		);
		p.outro(color.red("Validation failed"));
		return;
	}

	// Step 2: Check $schema reference
	if (!config.$schema) {
		issues.push({
			type: "warning",
			path: "$schema",
			message:
				'Missing $schema reference. Add: "$schema": "https://opencode.ai/config.json"',
		});
	} else if (!config.$schema.includes("opencode.ai")) {
		issues.push({
			type: "warning",
			path: "$schema",
			message: `Unexpected schema URL: ${config.$schema}`,
		});
	}

	// Step 3: Check for unknown top-level properties
	for (const key of Object.keys(config)) {
		if (!KNOWN_PROPERTIES.has(key)) {
			issues.push({
				type: "warning",
				path: key,
				message: `Unknown property "${key}" - may be ignored by OpenCode`,
			});
		}
	}

	// Step 4: Validate specific property types
	if (config.model !== undefined && typeof config.model !== "string") {
		issues.push({
			type: "error",
			path: "model",
			message: "model must be a string",
		});
	}

	if (config.theme !== undefined && typeof config.theme !== "string") {
		issues.push({
			type: "error",
			path: "theme",
			message: "theme must be a string",
		});
	}

	if (config.share !== undefined) {
		const validShare = ["manual", "auto", "disabled"];
		if (!validShare.includes(config.share)) {
			issues.push({
				type: "error",
				path: "share",
				message: `share must be one of: ${validShare.join(", ")}`,
			});
		}
	}

	if (config.autoupdate !== undefined) {
		if (
			typeof config.autoupdate !== "boolean" &&
			config.autoupdate !== "notify"
		) {
			issues.push({
				type: "error",
				path: "autoupdate",
				message: 'autoupdate must be boolean or "notify"',
			});
		}
	}

	if (config.plugin !== undefined && !Array.isArray(config.plugin)) {
		issues.push({
			type: "error",
			path: "plugin",
			message: "plugin must be an array of strings",
		});
	}

	if (
		config.instructions !== undefined &&
		!Array.isArray(config.instructions)
	) {
		issues.push({
			type: "error",
			path: "instructions",
			message: "instructions must be an array of strings",
		});
	}

	// Step 5: Validate MCP servers
	if (config.mcp) {
		for (const [name, server] of Object.entries(config.mcp)) {
			if (!server.command && !server.url) {
				issues.push({
					type: "error",
					path: `mcp.${name}`,
					message: "MCP server must have either 'command' or 'url'",
				});
			}
			if (server.command && !Array.isArray(server.command)) {
				issues.push({
					type: "error",
					path: `mcp.${name}.command`,
					message: "command must be an array of strings",
				});
			}
		}
	}

	// Step 6: Validate agents
	if (config.agent) {
		for (const [name, agent] of Object.entries(config.agent)) {
			if (agent.mode !== undefined) {
				const validModes = ["subagent", "primary", "all"];
				if (!validModes.includes(agent.mode)) {
					issues.push({
						type: "error",
						path: `agent.${name}.mode`,
						message: `mode must be one of: ${validModes.join(", ")}`,
					});
				}
			}
			if (agent.temperature !== undefined) {
				if (
					typeof agent.temperature !== "number" ||
					agent.temperature < 0 ||
					agent.temperature > 2
				) {
					issues.push({
						type: "warning",
						path: `agent.${name}.temperature`,
						message: "temperature should be a number between 0 and 2",
					});
				}
			}
		}
	}

	// Step 7: Try to fetch schema for reference
	try {
		const response = await fetch(OPENCODE_SCHEMA_URL);
		if (response.ok) {
			p.log.success("Schema fetched from opencode.ai");
		}
	} catch {
		p.log.warn("Could not fetch schema from opencode.ai (offline?)");
	}

	// Report results
	const errors = issues.filter((i) => i.type === "error");
	const warnings = issues.filter((i) => i.type === "warning");

	if (errors.length > 0) {
		console.log();
		p.log.error(
			color.bold(`${errors.length} error${errors.length === 1 ? "" : "s"}`),
		);
		for (const issue of errors) {
			console.log(
				`  ${color.red("✗")} ${color.yellow(issue.path)}: ${issue.message}`,
			);
		}
	}

	if (warnings.length > 0) {
		console.log();
		p.log.warn(
			color.bold(
				`${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
			),
		);
		for (const issue of warnings) {
			console.log(
				`  ${color.yellow("!")} ${color.dim(issue.path)}: ${issue.message}`,
			);
		}
	}

	if (issues.length === 0) {
		p.outro(color.green("Configuration is valid!"));
	} else if (errors.length > 0) {
		p.outro(
			color.red(
				`Validation failed with ${errors.length} error${errors.length === 1 ? "" : "s"}`,
			),
		);
	} else {
		p.outro(
			color.yellow(
				`Valid with ${warnings.length} warning${warnings.length === 1 ? "" : "s"}`,
			),
		);
	}
}

function showConfig(configPath: string): void {
	const config = loadConfig(configPath);

	console.log();
	console.log(color.bold("  Model"));
	console.log(`    ${color.cyan(config.model || "not set")}`);

	if (config.small_model) {
		console.log(color.bold("  Small Model"));
		console.log(`    ${color.cyan(config.small_model)}`);
	}

	console.log(color.bold("  Theme"));
	console.log(`    ${color.cyan(config.theme || "system")}`);

	// Share setting
	console.log(color.bold("  Share"));
	console.log(`    ${color.cyan(config.share || "manual")}`);

	// Autoupdate setting
	const autoupdateDisplay =
		config.autoupdate === "notify"
			? "notify"
			: config.autoupdate === false
				? "disabled"
				: "enabled";
	console.log(color.bold("  Autoupdate"));
	console.log(`    ${color.cyan(autoupdateDisplay)}`);

	// TUI settings
	if (config.tui && Object.keys(config.tui).length > 0) {
		console.log(color.bold("  TUI"));
		if (config.tui.scroll_speed !== undefined) {
			console.log(
				`    scroll_speed: ${color.cyan(String(config.tui.scroll_speed))}`,
			);
		}
		if (config.tui.scroll_acceleration !== undefined) {
			console.log(
				`    scroll_acceleration: ${color.cyan(String(config.tui.scroll_acceleration))}`,
			);
		}
		if (config.tui.diff_style) {
			console.log(`    diff_style: ${color.cyan(config.tui.diff_style)}`);
		}
	}

	// MCP servers
	if (config.mcp && Object.keys(config.mcp).length > 0) {
		console.log(color.bold("  MCP Servers"));
		for (const [name, server] of Object.entries(config.mcp)) {
			const status =
				server.enabled === false ? color.dim("off") : color.green("on");
			console.log(`    ${status} ${name}`);
		}
	}

	// Tools
	if (config.tools && Object.keys(config.tools).length > 0) {
		console.log(color.bold("  Tools"));
		for (const [tool, enabled] of Object.entries(config.tools)) {
			const status = enabled === false ? color.red("off") : color.green("on");
			console.log(`    ${status} ${tool}`);
		}
	}

	// Keybinds
	if (config.keybinds && Object.keys(config.keybinds).length > 0) {
		console.log(color.bold("  Keybinds"));
		for (const [action, key] of Object.entries(config.keybinds)) {
			console.log(`    ${color.dim(action)}: ${color.cyan(key)}`);
		}
	}

	console.log();
}

async function configMenu(configPath: string) {
	p.intro(color.bgCyan(color.black(" Configuration ")));

	// Loop to allow configuring multiple settings
	while (true) {
		const action = await p.select({
			message: "What do you want to configure?",
			options: [
				{ value: "model" as const, label: "Model - change default model" },
				{
					value: "small_model" as const,
					label: "Small Model - change small model",
				},
				{ value: "agent" as const, label: "Agents - configure agent models" },
				{ value: "theme" as const, label: "Theme - change UI theme" },
				{ value: "tui" as const, label: "TUI - scroll speed, diff style" },
				{ value: "mcp" as const, label: "MCP - manage MCP servers" },
				{ value: "tools" as const, label: "Tools - enable/disable tools" },
				{
					value: "permission" as const,
					label: "Permissions - bash/edit permissions",
				},
				{ value: "keybinds" as const, label: "Keybinds - keyboard shortcuts" },
				{ value: "share" as const, label: "Share - sharing settings" },
				{ value: "autoupdate" as const, label: "Autoupdate - update behavior" },
				{ value: "show" as const, label: "Show - view current config" },
				{ value: "exit" as const, label: "Exit" },
			],
		});

		if (p.isCancel(action) || action === "exit") {
			p.outro("Done");
			return;
		}

		switch (action) {
			case "model":
				await editModel(configPath);
				break;
			case "small_model":
				await editModel(configPath, "small_model");
				break;
			case "agent":
				await editAgentModel(configPath);
				break;
			case "theme":
				await editTheme(configPath);
				break;
			case "tui":
				await editTui(configPath);
				break;
			case "mcp":
				await editMCP(configPath);
				break;
			case "tools":
				await editTools(configPath);
				break;
			case "permission":
				await editPermissions(configPath);
				break;
			case "keybinds":
				await editKeybinds(configPath);
				break;
			case "share":
				await editShare(configPath);
				break;
			case "autoupdate":
				await editAutoupdate(configPath);
				break;
			case "show":
				showConfig(configPath);
				break;
		}

		// Add a small separator before showing menu again
		console.log();
	}
}

async function editModel(
	configPath: string,
	modelType: "model" | "small_model" = "model",
) {
	const config = loadConfig(configPath);
	const currentModel = config[modelType] || "not set";
	const modelLabel = modelType === "small_model" ? "Small Model" : "Model";

	p.log.info(`Current ${modelLabel}: ${color.cyan(currentModel)}`);

	// Fetch models from models.dev public API (no server needed)
	p.log.info(color.dim("Fetching models from models.dev..."));
	const modelsDevData = await fetchFromModelsDev();

	if (!modelsDevData || Object.keys(modelsDevData).length === 0) {
		// Fallback to text input if API fails
		p.log.warn("models.dev unavailable - please enter manually");
		const newModel = await p.text({
			message: `New ${modelLabel}`,
			placeholder: "e.g. anthropic/claude-sonnet-4, openai/gpt-4o",
			initialValue: config[modelType] || "",
			validate: (value) => {
				if (!value) return `${modelLabel} is required`;
				if (!value.includes("/")) return "Format: provider/model-name";
			},
		});

		if (p.isCancel(newModel)) {
			p.cancel("Cancelled");
			return;
		}

		config[modelType] = newModel;
		saveConfig(configPath, config);
		p.log.success(`${modelLabel} set to ${color.cyan(newModel)}`);
		return;
	}

	p.log.success("Fetched models from models.dev");

	// Get configured providers from local config
	const localProviders = config.provider || {};
	const _configuredProviderIds = new Set(Object.keys(localProviders));

	// Step 1: Ask user to search or pick from configured providers
	const allProviders = Object.values(modelsDevData);

	// Show quick pick for configured providers + search option
	const quickOptions: { value: string; label: string; hint?: string }[] = [];

	// Add back option first
	quickOptions.push({
		value: "__back__",
		label: "← Back",
		hint: "return to menu",
	});

	// Add ALL configured providers from local config (including custom ones not in models.dev)
	for (const [providerId, providerConfig] of Object.entries(localProviders)) {
		const modelsDevProvider = modelsDevData[providerId];
		const localModels = (providerConfig as ProviderConfig).models || {};
		const modelCount = modelsDevProvider
			? Object.keys(modelsDevProvider.models || {}).length
			: Object.keys(localModels).length;
		const providerName =
			(providerConfig as ProviderConfig).name ||
			modelsDevProvider?.name ||
			providerId;
		const isCustom = !modelsDevProvider;

		quickOptions.push({
			value: providerId,
			label: providerName,
			hint: `${modelCount} models${isCustom ? ", custom" : ", configured"}`,
		});
	}

	// Add search option
	quickOptions.push({
		value: "__search__",
		label: "Search all providers...",
		hint: `${allProviders.length} providers available`,
	});

	// Add custom option
	quickOptions.push({
		value: "__custom__",
		label: "Custom - enter manually",
		hint: "type provider/model directly",
	});

	const quickPick = await p.select({
		message: "Select provider",
		options: quickOptions,
	});

	if (p.isCancel(quickPick)) {
		return;
	}

	let providerId = quickPick as string;

	if (providerId === "__back__") {
		return;
	}

	if (providerId === "__custom__") {
		const customModel = await p.text({
			message: `Enter ${modelLabel}`,
			placeholder: "e.g. anthropic/claude-sonnet-4, openai/gpt-4o",
			validate: (value) => {
				if (!value) return `${modelLabel} is required`;
				if (!value.includes("/")) return "Format: provider/model-name";
			},
		});

		if (p.isCancel(customModel)) {
			p.cancel("Cancelled");
			return;
		}

		config[modelType] = customModel;
		saveConfig(configPath, config);
		p.log.success(`${modelLabel} set to ${color.cyan(customModel)}`);
		return;
	}

	if (providerId === "__search__") {
		// Text search for provider
		const searchTerm = await p.text({
			message: "Search provider (type name)",
			placeholder: "e.g. anthropic, openai, google, groq...",
		});

		if (p.isCancel(searchTerm)) {
			p.cancel("Cancelled");
			return;
		}

		const search = (searchTerm as string).toLowerCase();
		const matches = allProviders
			.filter(
				(prov) =>
					prov.id.toLowerCase().includes(search) ||
					prov.name.toLowerCase().includes(search),
			)
			.slice(0, 15); // Limit to 15 results to avoid rendering issues

		if (matches.length === 0) {
			p.log.warn(`No providers found matching "${searchTerm}"`);
			return;
		}

		const matchOptions = matches.map((prov) => ({
			value: prov.id,
			label: prov.name,
			hint: `${Object.keys(prov.models || {}).length} models`,
		}));

		const selectedMatch = await p.select({
			message: `Found ${matches.length} providers`,
			options: matchOptions,
		});

		if (p.isCancel(selectedMatch)) {
			p.cancel("Cancelled");
			return;
		}

		providerId = selectedMatch as string;
	}

	// Step 2: Select model from chosen provider
	// Check models.dev first, then fall back to local config for custom providers
	const modelsDevProvider = modelsDevData[providerId];
	const localProviderConfig = localProviders[providerId] as
		| ProviderConfig
		| undefined;

	let modelOptions: { value: string; label: string; hint?: string }[] = [];

	// Add back option first
	modelOptions.push({
		value: "__back__",
		label: "← Back",
		hint: "return to provider selection",
	});

	if (
		modelsDevProvider &&
		Object.keys(modelsDevProvider.models || {}).length > 0
	) {
		// Use models from models.dev
		modelOptions = [
			modelOptions[0],
			...getModelsForProvider(modelsDevProvider),
		];
	} else if (
		localProviderConfig?.models &&
		Object.keys(localProviderConfig.models).length > 0
	) {
		// Use models from local config (custom provider)
		modelOptions = [
			modelOptions[0],
			...getModelsFromLocalConfig(localProviderConfig.models),
		];
	} else {
		p.log.warn(`No models found for ${providerId}`);
		return;
	}

	const selectedModel = await p.select({
		message: `Select model from ${providerId}`,
		options: modelOptions,
	});

	if (p.isCancel(selectedModel) || selectedModel === "__back__") {
		return;
	}

	const fullModelId = `${providerId}/${selectedModel}`;
	config[modelType] = fullModelId;
	saveConfig(configPath, config);

	p.log.success(`${modelLabel} set to ${color.cyan(fullModelId)}`);
}

function _getProviderOptions(
	providersData: ModelsDevResponse,
	configuredProviders: Set<string>,
): { value: string; label: string; hint?: string }[] {
	const options: { value: string; label: string; hint?: string }[] = [];
	const providers = Object.values(providersData);

	// Separate configured and other providers
	const configured: ModelsDevProvider[] = [];
	const others: ModelsDevProvider[] = [];

	for (const provider of providers) {
		if (configuredProviders.has(provider.id)) {
			configured.push(provider);
		} else {
			others.push(provider);
		}
	}

	// Sort each group alphabetically
	configured.sort((a, b) => a.name.localeCompare(b.name));
	others.sort((a, b) => a.name.localeCompare(b.name));

	// Add configured providers first with indicator
	if (configured.length > 0) {
		for (const provider of configured) {
			const modelCount = Object.keys(provider.models || {}).length;
			options.push({
				value: provider.id,
				label: `${provider.name}`,
				hint: `${modelCount} models, configured`,
			});
		}
	}

	// Add separator if we have both
	if (configured.length > 0 && others.length > 0) {
		options.push({
			value: "__separator__",
			label: color.dim("─── Other Providers ───"),
			hint: "",
		});
	}

	// Add other providers
	for (const provider of others) {
		const modelCount = Object.keys(provider.models || {}).length;
		options.push({
			value: provider.id,
			label: provider.name,
			hint: `${modelCount} models`,
		});
	}

	// Add custom option at the end
	options.push({
		value: "__custom__",
		label: "Custom - enter manually",
		hint: "type your own provider/model",
	});

	return options;
}

function getModelsForProvider(
	provider: ModelsDevProvider,
): { value: string; label: string; hint?: string }[] {
	const options: { value: string; label: string; hint?: string }[] = [];

	for (const [modelId, model] of Object.entries(provider.models)) {
		const hints: string[] = [];

		if (model.reasoning) hints.push("reasoning");
		if (model.limit?.context) {
			hints.push(`${Math.round(model.limit.context / 1000)}k ctx`);
		}

		options.push({
			value: modelId,
			label: model.name || modelId,
			hint: hints.length > 0 ? hints.join(", ") : undefined,
		});
	}

	// Sort by name
	options.sort((a, b) => a.label.localeCompare(b.label));

	return options;
}

function getModelsFromLocalConfig(
	models: Record<string, ModelConfig>,
): { value: string; label: string; hint?: string }[] {
	const options: { value: string; label: string; hint?: string }[] = [];

	for (const [modelId, model] of Object.entries(models)) {
		const hints: string[] = [];

		if (model.reasoning) hints.push("reasoning");
		if (model.limit?.context) {
			hints.push(`${Math.round(model.limit.context / 1000)}k ctx`);
		}

		options.push({
			value: modelId,
			label: model.name || modelId,
			hint: hints.length > 0 ? hints.join(", ") : undefined,
		});
	}

	// Sort by name
	options.sort((a, b) => a.label.localeCompare(b.label));

	return options;
}

function _getModelOptionsFromServer(
	providers: ServerProvider[],
	connected: string[],
): ModelOption[] {
	const options: ModelOption[] = [];

	// Sort providers: connected first, then alphabetically
	const sortedProviders = [...providers].sort((a, b) => {
		const aConnected = connected.includes(a.id);
		const bConnected = connected.includes(b.id);
		if (aConnected && !bConnected) return -1;
		if (!aConnected && bConnected) return 1;
		return a.name.localeCompare(b.name);
	});

	for (const provider of sortedProviders) {
		const isConnected = connected.includes(provider.id);
		if (!provider.models) continue;

		for (const [modelId, model] of Object.entries(provider.models)) {
			const fullModelId = `${provider.id}/${modelId}`;
			const hints: string[] = [];

			if (!isConnected) hints.push(color.yellow("not connected"));
			if (model.reasoning) hints.push("reasoning");
			if (model.attachment) hints.push("attachments");
			if (model.limit?.context) {
				hints.push(`${Math.round(model.limit.context / 1000)}k ctx`);
			}

			options.push({
				value: fullModelId,
				label: `${provider.id}/${model.name || modelId}`,
				hint: hints.length > 0 ? hints.join(", ") : undefined,
			});
		}
	}

	return options;
}

function _getModelOptionsFromModelsDev(
	providersData: ModelsDevResponse,
): ModelOption[] {
	const options: ModelOption[] = [];

	// Convert object to array
	const providers = Object.values(providersData);

	// Sort providers alphabetically, but put common ones first
	const priorityProviders = [
		"opencode",
		"anthropic",
		"openai",
		"google",
		"xai",
		"deepseek",
		"groq",
	];
	const sortedProviders = [...providers].sort((a, b) => {
		const aIdx = priorityProviders.indexOf(a.id);
		const bIdx = priorityProviders.indexOf(b.id);
		if (aIdx !== -1 && bIdx === -1) return -1;
		if (aIdx === -1 && bIdx !== -1) return 1;
		if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
		return a.name.localeCompare(b.name);
	});

	for (const provider of sortedProviders) {
		if (!provider.models || Object.keys(provider.models).length === 0) continue;

		for (const [modelId, model] of Object.entries(provider.models)) {
			const fullModelId = `${provider.id}/${modelId}`;
			const hints: string[] = [];

			if (model.reasoning) hints.push("reasoning");
			if (model.limit?.context) {
				hints.push(`${Math.round(model.limit.context / 1000)}k ctx`);
			}

			options.push({
				value: fullModelId,
				label: `${provider.id}/${model.name || modelId}`,
				hint: hints.length > 0 ? hints.join(", ") : undefined,
			});
		}
	}

	return options;
}

// Common OpenCode built-in providers/models for when server isn't running
function _getBuiltInModelOptions(): ModelOption[] {
	return [
		// OpenCode
		{
			value: "opencode/claude-sonnet-4",
			label: "opencode/claude-sonnet-4",
			hint: "reasoning",
		},
		{ value: "opencode/gpt-4.1", label: "opencode/gpt-4.1", hint: "reasoning" },
		{
			value: "opencode/gemini-2.5-pro",
			label: "opencode/gemini-2.5-pro",
			hint: "reasoning, 1000k ctx",
		},
		{
			value: "opencode/big-pickle",
			label: "opencode/big-pickle",
			hint: "multi-model",
		},
		{
			value: "opencode/gpt-5-nano",
			label: "opencode/gpt-5-nano",
			hint: "fast, cheap",
		},
		// Anthropic
		{
			value: "anthropic/claude-sonnet-4-20250514",
			label: "anthropic/claude-sonnet-4",
			hint: "reasoning, 200k ctx",
		},
		{
			value: "anthropic/claude-opus-4-20250514",
			label: "anthropic/claude-opus-4",
			hint: "reasoning, 200k ctx",
		},
		{
			value: "anthropic/claude-haiku-3-5-20241022",
			label: "anthropic/claude-haiku-3.5",
			hint: "fast, 200k ctx",
		},
		// OpenAI
		{ value: "openai/gpt-4o", label: "openai/gpt-4o", hint: "128k ctx" },
		{
			value: "openai/gpt-4o-mini",
			label: "openai/gpt-4o-mini",
			hint: "fast, 128k ctx",
		},
		{ value: "openai/o1", label: "openai/o1", hint: "reasoning, 200k ctx" },
		{ value: "openai/o3", label: "openai/o3", hint: "reasoning, 200k ctx" },
		{
			value: "openai/o4-mini",
			label: "openai/o4-mini",
			hint: "reasoning, fast",
		},
		{ value: "openai/codex-1", label: "openai/codex-1", hint: "code-focused" },
		// Google
		{
			value: "google/gemini-2.5-pro",
			label: "google/gemini-2.5-pro",
			hint: "reasoning, 1000k ctx",
		},
		{
			value: "google/gemini-2.5-flash",
			label: "google/gemini-2.5-flash",
			hint: "fast, 1000k ctx",
		},
		{
			value: "google/gemini-2.0-flash",
			label: "google/gemini-2.0-flash",
			hint: "fast, 1000k ctx",
		},
		// xAI
		{ value: "xai/grok-3", label: "xai/grok-3", hint: "reasoning, 131k ctx" },
		{
			value: "xai/grok-3-mini",
			label: "xai/grok-3-mini",
			hint: "fast, 131k ctx",
		},
		// DeepSeek
		{
			value: "deepseek/deepseek-chat",
			label: "deepseek/deepseek-chat",
			hint: "cheap, 64k ctx",
		},
		{
			value: "deepseek/deepseek-reasoner",
			label: "deepseek/deepseek-reasoner",
			hint: "reasoning, 64k ctx",
		},
		// Groq
		{
			value: "groq/llama-3.3-70b-versatile",
			label: "groq/llama-3.3-70b",
			hint: "fast, free tier",
		},
	];
}

function _getModelOptionsFromConfig(config: OpenCodeConfig): ModelOption[] {
	const options: ModelOption[] = [];

	if (!config.provider) {
		return options;
	}

	for (const [providerName, providerConfig] of Object.entries(
		config.provider,
	)) {
		if (!providerConfig.models) continue;

		for (const [modelId, modelConfig] of Object.entries(
			providerConfig.models,
		)) {
			const fullModelId = `${providerName}/${modelId}`;
			const displayName = modelConfig.name || modelId;
			const hints: string[] = [];

			if (modelConfig.reasoning) hints.push("reasoning");
			if (modelConfig.attachment) hints.push("attachments");
			if (modelConfig.limit?.context) {
				hints.push(`${Math.round(modelConfig.limit.context / 1000)}k ctx`);
			}

			options.push({
				value: fullModelId,
				label: `${providerName}/${displayName}`,
				hint: hints.length > 0 ? hints.join(", ") : undefined,
			});
		}
	}

	return options;
}

async function editAgentModel(configPath: string) {
	const config = loadConfig(configPath);

	if (!config.agent) {
		config.agent = {};
	}

	// Try to fetch agents from running OpenCode server first
	const serverAgents = await getAgentsFromServer();
	const _serverData = await getProvidersFromServer();

	let agentNames: string[] = [];
	const agentInfoMap: Map<
		string,
		{ description?: string; model?: string; builtIn?: boolean }
	> = new Map();

	if (serverAgents && serverAgents.length > 0) {
		p.log.info(color.dim("Fetched agents from OpenCode server"));
		for (const agent of serverAgents) {
			agentNames.push(agent.name);
			agentInfoMap.set(agent.name, {
				description: agent.description,
				model: agent.model
					? `${agent.model.providerID}/${agent.model.modelID}`
					: undefined,
				builtIn: agent.builtIn,
			});
		}
	} else {
		// Fallback to local config - include all agents
		agentNames = Object.keys(config.agent);
		for (const name of agentNames) {
			const agent = config.agent[name] as AgentConfig;
			agentInfoMap.set(name, {
				description: agent?.description,
				model: agent?.model,
			});
		}
	}

	if (agentNames.length === 0) {
		p.log.warn("No agents found");
		return;
	}

	// Show current agent models
	console.log();
	console.log(color.bold("  Agent Models"));
	for (const name of agentNames) {
		const info = agentInfoMap.get(name);
		const model = info?.model || color.dim("(default)");
		const builtIn = info?.builtIn ? color.dim(" [built-in]") : "";
		const localConfig = config.agent[name] as AgentConfig | undefined;
		const disabled = localConfig?.disable ? color.red(" [disabled]") : "";
		console.log(`    ${color.cyan(name)}: ${model}${builtIn}${disabled}`);
	}
	console.log();

	// Select agent to configure
	const agentOptions = [
		{ value: "__back__", label: "← Back", hint: "return to menu" },
		...agentNames.map((name) => {
			const info = agentInfoMap.get(name);
			return {
				value: name,
				label: name,
				hint: info?.model || "(default)",
			};
		}),
	];

	const selectedAgent = await p.select({
		message: "Select agent to configure",
		options: agentOptions,
	});

	if (p.isCancel(selectedAgent) || selectedAgent === "__back__") {
		return;
	}

	const agentName = selectedAgent as string;
	const currentAgent = (config.agent[agentName] as AgentConfig) || {};

	// Action menu for the agent
	const action = await p.select({
		message: `Configure ${agentName}`,
		options: [
			{
				value: "__back__" as const,
				label: "← Back",
				hint: "return to agent list",
			},
			{ value: "model" as const, label: "Change model" },
			{
				value: "toggle" as const,
				label: currentAgent.disable ? "Enable agent" : "Disable agent",
			},
			{ value: "description" as const, label: "Edit description" },
		],
	});

	if (p.isCancel(action) || action === "__back__") {
		return;
	}

	if (action === "toggle") {
		if (!config.agent[agentName]) {
			config.agent[agentName] = {};
		}
		(config.agent[agentName] as AgentConfig).disable = !currentAgent.disable;
		saveConfig(configPath, config);
		const status = (config.agent[agentName] as AgentConfig).disable
			? color.red("disabled")
			: color.green("enabled");
		p.log.success(`Agent ${agentName}: ${status}`);
		return;
	}

	if (action === "description") {
		const newDesc = await p.text({
			message: "Agent description",
			initialValue: currentAgent.description || "",
		});

		if (p.isCancel(newDesc)) {
			return;
		}

		if (!config.agent[agentName]) {
			config.agent[agentName] = {};
		}
		(config.agent[agentName] as AgentConfig).description = newDesc as string;
		saveConfig(configPath, config);
		p.log.success("Description updated");
		return;
	}

	// Model selection - use two-step flow like editModel
	const agentInfo = agentInfoMap.get(agentName);
	p.log.info(
		`Current model: ${color.cyan(agentInfo?.model || currentAgent.model || "(default)")}`,
	);

	// Fetch models from models.dev
	p.log.info(color.dim("Fetching models from models.dev..."));
	const modelsDevData = await fetchFromModelsDev();

	if (!modelsDevData || Object.keys(modelsDevData).length === 0) {
		// Fallback to text input if API fails
		p.log.warn("models.dev unavailable - please enter manually");
		const newModel = await p.text({
			message: "Enter model",
			placeholder: "e.g. anthropic/claude-sonnet-4",
			validate: (value) => {
				if (!value) return "Model is required";
				if (!value.includes("/")) return "Format: provider/model-name";
			},
		});

		if (p.isCancel(newModel)) {
			return;
		}

		if (!config.agent[agentName]) {
			config.agent[agentName] = {};
		}
		(config.agent[agentName] as AgentConfig).model = newModel as string;
		saveConfig(configPath, config);
		p.log.success(`${agentName} model set to ${color.cyan(newModel)}`);
		return;
	}

	// Get configured providers from local config
	const localProviders = config.provider || {};
	const allProviders = Object.values(modelsDevData);

	// Build quick pick options for providers
	const quickOptions: { value: string; label: string; hint?: string }[] = [];

	// Add back option first
	quickOptions.push({
		value: "__back__",
		label: "← Back",
		hint: "return to agent list",
	});

	// Add default option
	quickOptions.push({
		value: "__default__",
		label: "Default - use session model",
		hint: "inherits from main model setting",
	});

	// Add ALL configured providers from local config
	for (const [providerId, providerConfig] of Object.entries(localProviders)) {
		const modelsDevProvider = modelsDevData[providerId];
		const localModels = (providerConfig as ProviderConfig).models || {};
		const modelCount = modelsDevProvider
			? Object.keys(modelsDevProvider.models || {}).length
			: Object.keys(localModels).length;
		const providerName =
			(providerConfig as ProviderConfig).name ||
			modelsDevProvider?.name ||
			providerId;
		const isCustom = !modelsDevProvider;

		quickOptions.push({
			value: providerId,
			label: providerName,
			hint: `${modelCount} models${isCustom ? ", custom" : ", configured"}`,
		});
	}

	// Add search option
	quickOptions.push({
		value: "__search__",
		label: "Search all providers...",
		hint: `${allProviders.length} providers available`,
	});

	// Add custom option
	quickOptions.push({
		value: "__custom__",
		label: "Custom - enter manually",
		hint: "type provider/model directly",
	});

	const quickPick = await p.select({
		message: "Select provider",
		options: quickOptions,
	});

	if (p.isCancel(quickPick)) {
		return;
	}

	let providerId = quickPick as string;

	if (providerId === "__back__") {
		return;
	}

	if (providerId === "__default__") {
		if (!config.agent[agentName]) {
			config.agent[agentName] = {};
		}
		const agentConfig = config.agent[agentName] as AgentConfig;
		if (agentConfig.model) {
			agentConfig.model = undefined;
		}
		saveConfig(configPath, config);
		p.log.success(`${agentName} model set to ${color.cyan("(default)")}`);
		return;
	}

	if (providerId === "__custom__") {
		const customModel = await p.text({
			message: "Enter model",
			placeholder: "e.g. anthropic/claude-sonnet-4",
			validate: (value) => {
				if (!value) return "Model is required";
				if (!value.includes("/")) return "Format: provider/model-name";
			},
		});

		if (p.isCancel(customModel)) {
			return;
		}

		if (!config.agent[agentName]) {
			config.agent[agentName] = {};
		}
		(config.agent[agentName] as AgentConfig).model = customModel as string;
		saveConfig(configPath, config);
		p.log.success(`${agentName} model set to ${color.cyan(customModel)}`);
		return;
	}

	if (providerId === "__search__") {
		// Text search for provider
		const searchTerm = await p.text({
			message: "Search provider (type name)",
			placeholder: "e.g. anthropic, openai, google, groq...",
		});

		if (p.isCancel(searchTerm)) {
			return;
		}

		const search = (searchTerm as string).toLowerCase();
		const matches = allProviders
			.filter(
				(prov) =>
					prov.id.toLowerCase().includes(search) ||
					prov.name.toLowerCase().includes(search),
			)
			.slice(0, 15);

		if (matches.length === 0) {
			p.log.warn(`No providers found matching "${searchTerm}"`);
			return;
		}

		const matchOptions = matches.map((prov) => ({
			value: prov.id,
			label: prov.name,
			hint: `${Object.keys(prov.models || {}).length} models`,
		}));

		const selectedMatch = await p.select({
			message: `Found ${matches.length} providers`,
			options: matchOptions,
		});

		if (p.isCancel(selectedMatch)) {
			return;
		}

		providerId = selectedMatch as string;
	}

	// Step 2: Select model from chosen provider
	const modelsDevProvider = modelsDevData[providerId];
	const localProviderConfig = localProviders[providerId] as
		| ProviderConfig
		| undefined;

	let modelOptions: { value: string; label: string; hint?: string }[] = [];

	if (
		modelsDevProvider &&
		Object.keys(modelsDevProvider.models || {}).length > 0
	) {
		modelOptions = getModelsForProvider(modelsDevProvider);
	} else if (
		localProviderConfig?.models &&
		Object.keys(localProviderConfig.models).length > 0
	) {
		modelOptions = getModelsFromLocalConfig(localProviderConfig.models);
	} else {
		p.log.warn(`No models found for ${providerId}`);
		return;
	}

	const selectedModel = await p.select({
		message: `Select model from ${providerId}`,
		options: modelOptions,
	});

	if (p.isCancel(selectedModel)) {
		return;
	}

	const fullModelId = `${providerId}/${selectedModel}`;

	if (!config.agent[agentName]) {
		config.agent[agentName] = {};
	}
	(config.agent[agentName] as AgentConfig).model = fullModelId;
	saveConfig(configPath, config);

	p.log.success(`${agentName} model set to ${color.cyan(fullModelId)}`);
}

async function editMCP(configPath: string) {
	const config = loadConfig(configPath);

	if (!config.mcp) {
		config.mcp = {};
	}

	const servers = Object.keys(config.mcp);

	if (servers.length === 0) {
		const add = await p.confirm({
			message: "No MCP servers configured. Add one?",
		});

		if (p.isCancel(add) || !add) {
			return;
		}

		await addMCPServer(configPath, config);
		return;
	}

	// Show current MCP servers
	console.log();
	console.log(color.bold("  MCP Servers"));
	for (const [name, server] of Object.entries(config.mcp)) {
		const status =
			server.enabled === false ? color.red("off") : color.green("on");
		const type =
			server.type === "remote" ? color.dim("remote") : color.dim("local");
		const endpoint =
			server.type === "remote"
				? color.dim(` → ${server.url}`)
				: color.dim(` → ${(server.command || []).join(" ")}`);
		console.log(`    ${status} ${name} ${type}${endpoint}`);
	}
	console.log();

	const action = await p.select({
		message: "MCP Servers",
		options: [
			{ value: "__back__" as const, label: "← Back", hint: "return to menu" },
			{ value: "toggle" as const, label: "Toggle server on/off" },
			{ value: "add" as const, label: "Add new server" },
			{ value: "remove" as const, label: "Remove server" },
		],
	});

	if (p.isCancel(action) || action === "__back__") {
		return;
	}

	switch (action) {
		case "toggle":
			await toggleMCP(configPath, config);
			break;
		case "add":
			await addMCPServer(configPath, config);
			break;
		case "remove":
			await removeMCP(configPath, config);
			break;
	}
}

async function toggleMCP(configPath: string, config: OpenCodeConfig) {
	const servers = Object.entries(config.mcp || {}).map(([name, server]) => ({
		value: name,
		label: name,
		hint: server.enabled === false ? "off" : "on",
	}));

	const selected = await p.select({
		message: "Select server to toggle",
		options: servers,
	});

	if (p.isCancel(selected)) {
		return;
	}

	const serverName = selected as string;
	const server = config.mcp?.[serverName];
	if (!server) {
		p.log.error(`Server "${serverName}" not found`);
		return;
	}
	const wasEnabled = server.enabled !== false;
	server.enabled = !wasEnabled;

	saveConfig(configPath, config);

	const status = server.enabled
		? color.green("enabled")
		: color.dim("disabled");
	p.log.success(`${serverName}: ${status}`);
}

async function addMCPServer(configPath: string, config: OpenCodeConfig) {
	const name = await p.text({
		message: "Server name",
		placeholder: "e.g. my-server",
		validate: (value) => {
			if (!value) return "Name is required";
			if (config.mcp?.[value]) return "Server already exists";
		},
	});

	if (p.isCancel(name)) {
		return;
	}

	const serverType = await p.select({
		message: "Server type",
		options: [
			{ value: "remote" as const, label: "Remote (URL)" },
			{ value: "local" as const, label: "Local (command)" },
		],
	});

	if (p.isCancel(serverType)) {
		return;
	}

	const serverName = name as string;

	if (serverType === "remote") {
		const url = await p.text({
			message: "Server URL",
			placeholder: "https://example.com/mcp",
			validate: (value) => {
				if (!value) return "URL is required";
				if (!value.startsWith("http")) return "Must be a valid URL";
			},
		});

		if (p.isCancel(url)) {
			return;
		}

		config.mcp = config.mcp ?? {};
		config.mcp[serverName] = {
			type: "remote",
			url: url as string,
			enabled: true,
		};
	} else {
		const command = await p.text({
			message: "Command (space-separated)",
			placeholder: "npx -y @example/mcp-server",
			validate: (value) => {
				if (!value) return "Command is required";
			},
		});

		if (p.isCancel(command)) {
			return;
		}

		config.mcp = config.mcp ?? {};
		config.mcp[serverName] = {
			type: "local",
			command: (command as string).split(" "),
			enabled: true,
		};
	}

	saveConfig(configPath, config);
	p.log.success(`Added MCP server: ${color.cyan(serverName)}`);
}

async function removeMCP(configPath: string, config: OpenCodeConfig) {
	const servers = Object.keys(config.mcp || {}).map((name) => ({
		value: name,
		label: name,
	}));

	const selected = await p.select({
		message: "Select server to remove",
		options: servers,
	});

	if (p.isCancel(selected)) {
		return;
	}

	const serverName = selected as string;

	const confirm = await p.confirm({
		message: `Remove "${serverName}"?`,
	});

	if (p.isCancel(confirm) || !confirm) {
		return;
	}

	delete config.mcp?.[serverName];
	saveConfig(configPath, config);

	p.log.success(`Removed: ${serverName}`);
}

async function editPermissions(configPath: string) {
	const config = loadConfig(configPath);

	if (!config.permission) {
		config.permission = {};
	}

	// Show current
	console.log();
	console.log(color.bold("  Current Permissions"));
	console.log(`    edit: ${color.cyan(config.permission.edit || "ask")}`);
	console.log(
		`    external_directory: ${color.cyan(config.permission.external_directory || "ask")}`,
	);

	if (config.permission.bash) {
		console.log(color.bold("  Bash"));
		for (const [pattern, perm] of Object.entries(config.permission.bash)) {
			console.log(`    ${color.dim(pattern)}: ${color.cyan(perm)}`);
		}
	}
	console.log();

	const action = await p.select({
		message: "Edit permission",
		options: [
			{ value: "__back__" as const, label: "← Back", hint: "return to menu" },
			{ value: "edit" as const, label: "edit - file editing" },
			{
				value: "external" as const,
				label: "external_directory - access outside project",
			},
			{ value: "bash" as const, label: "bash - add command pattern" },
		],
	});

	if (p.isCancel(action) || action === "__back__") {
		return;
	}

	const permValue = await p.select({
		message: "Permission level",
		options: [
			{ value: "allow" as const, label: "allow - always allow" },
			{ value: "ask" as const, label: "ask - prompt each time" },
			{ value: "deny" as const, label: "deny - always deny" },
		],
	});

	if (p.isCancel(permValue)) {
		return;
	}

	const permValueStr = permValue as string;

	if (action === "edit") {
		config.permission.edit = permValueStr;
	} else if (action === "external") {
		config.permission.external_directory = permValueStr;
	} else if (action === "bash") {
		const pattern = await p.text({
			message: "Bash command pattern",
			placeholder: "e.g. rm *, git push *",
			validate: (value) => {
				if (!value) return "Pattern is required";
			},
		});

		if (p.isCancel(pattern)) {
			return;
		}

		if (!config.permission.bash) {
			config.permission.bash = {};
		}
		config.permission.bash[pattern as string] = permValueStr;
	}

	saveConfig(configPath, config);
	p.log.success("Permissions updated");
}

async function editKeybinds(configPath: string) {
	const config = loadConfig(configPath);

	if (!config.keybinds) {
		config.keybinds = {};
	}

	// Show current
	if (Object.keys(config.keybinds).length > 0) {
		console.log();
		console.log(color.bold("  Current Keybinds"));
		for (const [action, key] of Object.entries(config.keybinds)) {
			console.log(`    ${color.dim(action)}: ${color.cyan(key)}`);
		}
		console.log();
	}

	const action = await p.select({
		message: "Select keybind to edit",
		options: [
			{ value: "__back__" as const, label: "← Back", hint: "return to menu" },
			{ value: "leader" as const, label: "leader - prefix key" },
			{
				value: "command_list" as const,
				label: "command_list - open command palette",
			},
			{
				value: "session_child_cycle" as const,
				label: "session_child_cycle - next session",
			},
			{
				value: "session_child_cycle_reverse" as const,
				label: "session_child_cycle_reverse - prev session",
			},
			{ value: "custom" as const, label: "Custom keybind" },
		],
	});

	if (p.isCancel(action) || action === "__back__") {
		return;
	}

	let keybindName = action as string;

	if (action === "custom") {
		const customName = await p.text({
			message: "Keybind name",
			placeholder: "e.g. my_action",
		});

		if (p.isCancel(customName)) {
			return;
		}

		keybindName = customName as string;
	}

	const currentValue = config.keybinds[keybindName] || "";

	const newKey = await p.text({
		message: `Key for ${keybindName}`,
		placeholder: "e.g. ctrl+k, ;, `",
		initialValue: currentValue,
		validate: (value) => {
			if (!value) return "Key is required";
		},
	});

	if (p.isCancel(newKey)) {
		return;
	}

	config.keybinds[keybindName] = newKey as string;
	saveConfig(configPath, config);

	p.log.success(`${keybindName} → ${color.cyan(newKey as string)}`);
}

// OpenCode built-in themes
const OPENCODE_THEMES = [
	{ value: "system", label: "System", hint: "follows OS preference" },
	{ value: "opencode", label: "OpenCode", hint: "default theme" },
	{ value: "aura", label: "Aura", hint: "dark purple" },
	{ value: "ayu", label: "Ayu", hint: "warm dark" },
	{ value: "catppuccin", label: "Catppuccin", hint: "pastel dark" },
	{
		value: "catppuccin-macchiato",
		label: "Catppuccin Macchiato",
		hint: "warm pastel",
	},
	{ value: "cobalt2", label: "Cobalt2", hint: "blue dark" },
	{ value: "dracula", label: "Dracula", hint: "dark purple/pink" },
	{ value: "everforest", label: "Everforest", hint: "green dark" },
	{ value: "flexoki", label: "Flexoki", hint: "warm minimal" },
	{ value: "github", label: "GitHub", hint: "light/dark" },
	{ value: "gruvbox", label: "Gruvbox", hint: "retro warm" },
	{ value: "kanagawa", label: "Kanagawa", hint: "japanese inspired" },
	{ value: "material", label: "Material", hint: "google material" },
	{ value: "matrix", label: "Matrix", hint: "green terminal" },
	{ value: "mercury", label: "Mercury", hint: "minimal dark" },
	{ value: "monokai", label: "Monokai", hint: "classic dark" },
	{ value: "nightowl", label: "Night Owl", hint: "blue dark" },
	{ value: "nord", label: "Nord", hint: "arctic blue" },
	{ value: "one-dark", label: "One Dark", hint: "atom inspired" },
	{ value: "orng", label: "Orng", hint: "orange accent" },
	{ value: "palenight", label: "Palenight", hint: "purple dark" },
	{ value: "rosepine", label: "Rose Pine", hint: "soft pink" },
	{ value: "solarized", label: "Solarized", hint: "precision colors" },
	{ value: "synthwave84", label: "Synthwave '84", hint: "retro neon" },
	{ value: "tokyonight", label: "Tokyo Night", hint: "vibrant dark" },
	{ value: "vercel", label: "Vercel", hint: "minimal black" },
	{ value: "vesper", label: "Vesper", hint: "warm dark" },
	{ value: "zenburn", label: "Zenburn", hint: "low contrast" },
] as const;

async function editTheme(configPath: string) {
	const config = loadConfig(configPath);
	const currentTheme = config.theme || "system";

	p.log.info(`Current theme: ${color.cyan(currentTheme)}`);

	// Ensure initialValue exists in options to prevent rendering issues
	const validTheme = OPENCODE_THEMES.some((t) => t.value === currentTheme)
		? currentTheme
		: "system";

	const selectedTheme = await p.select({
		message: "Select theme",
		options: OPENCODE_THEMES.map((t) => ({
			value: t.value,
			label: t.label,
			hint: t.hint,
		})),
		initialValue: validTheme,
	});

	if (p.isCancel(selectedTheme)) {
		p.cancel("Cancelled");
		return;
	}

	config.theme = selectedTheme as string;
	saveConfig(configPath, config);

	p.log.success(`Theme set to ${color.cyan(selectedTheme as string)}`);
}

async function editTui(configPath: string) {
	const config = loadConfig(configPath);

	if (!config.tui) {
		config.tui = {};
	}

	const setting = await p.select({
		message: "TUI Setting",
		options: [
			{
				value: "__back__" as const,
				label: "← Back",
				hint: "return to menu",
			},
			{
				value: "scroll_speed" as const,
				label: "Scroll Speed",
				hint: `current: ${config.tui.scroll_speed ?? "default"}`,
			},
			{
				value: "scroll_acceleration" as const,
				label: "Scroll Acceleration",
				hint: `current: ${config.tui.scroll_acceleration ?? "default"}`,
			},
			{
				value: "diff_style" as const,
				label: "Diff Style",
				hint: `current: ${config.tui.diff_style ?? "unified"}`,
			},
		],
	});

	if (p.isCancel(setting) || setting === "__back__") {
		return;
	}

	if (setting === "diff_style") {
		const style = await p.select({
			message: "Diff style",
			options: [
				{ value: "unified" as const, label: "Unified", hint: "single column" },
				{ value: "split" as const, label: "Split", hint: "side by side" },
			],
		});

		if (p.isCancel(style)) {
			return;
		}

		config.tui.diff_style = style as "unified" | "split";
		saveConfig(configPath, config);
		p.log.success(`Diff style set to ${color.cyan(style as string)}`);
	} else {
		const settingKey = setting as "scroll_speed" | "scroll_acceleration";
		const value = await p.text({
			message: `${settingKey === "scroll_speed" ? "Scroll speed" : "Scroll acceleration"}`,
			placeholder: "e.g. 1.0, 2.0",
			initialValue: String(config.tui[settingKey] ?? ""),
			validate: (v) => {
				if (v && Number.isNaN(Number(v))) return "Must be a number";
			},
		});

		if (p.isCancel(value)) {
			return;
		}

		config.tui[settingKey] = value ? Number(value) : undefined;
		saveConfig(configPath, config);
		p.log.success(`${settingKey} set to ${color.cyan(value || "default")}`);
	}
}

async function editTools(configPath: string) {
	const config = loadConfig(configPath);

	if (!config.tools) {
		config.tools = {};
	}

	// Common OpenCode tools
	const commonTools = [
		"read",
		"glob",
		"grep",
		"edit",
		"write",
		"bash",
		"webfetch",
		"todowrite",
		"todoread",
	];

	// Show current status
	console.log();
	console.log(color.bold("  Tool Status"));
	for (const tool of commonTools) {
		const status =
			config.tools[tool] === false ? color.red("off") : color.green("on");
		console.log(`    ${status} ${tool}`);
	}
	console.log();

	const action = await p.select({
		message: "Select action",
		options: [
			{ value: "__back__" as const, label: "← Back", hint: "return to menu" },
			{ value: "toggle" as const, label: "Toggle tool on/off" },
			{ value: "custom" as const, label: "Add custom tool" },
		],
	});

	if (p.isCancel(action) || action === "__back__") {
		return;
	}

	if (action === "toggle") {
		const allTools = [
			...new Set([...commonTools, ...Object.keys(config.tools)]),
		];
		const selected = await p.select({
			message: "Select tool to toggle",
			options: allTools.map((tool) => ({
				value: tool,
				label: tool,
				hint: config.tools?.[tool] === false ? "off" : "on",
			})),
		});

		if (p.isCancel(selected)) {
			return;
		}

		const toolName = selected as string;
		const wasEnabled = config.tools[toolName] !== false;
		config.tools[toolName] = !wasEnabled;
		saveConfig(configPath, config);

		const status = config.tools[toolName]
			? color.green("enabled")
			: color.red("disabled");
		p.log.success(`${toolName}: ${status}`);
	} else {
		const toolName = await p.text({
			message: "Tool name",
			placeholder: "e.g. my-custom-tool",
			validate: (v) => {
				if (!v) return "Tool name is required";
			},
		});

		if (p.isCancel(toolName)) {
			return;
		}

		const enabled = await p.confirm({
			message: "Enable this tool?",
			initialValue: true,
		});

		if (p.isCancel(enabled)) {
			return;
		}

		config.tools[toolName as string] = enabled;
		saveConfig(configPath, config);
		p.log.success(
			`Added ${toolName}: ${enabled ? color.green("on") : color.red("off")}`,
		);
	}
}

async function editShare(configPath: string) {
	const config = loadConfig(configPath);
	const current = config.share || "manual";

	p.log.info(`Current share setting: ${color.cyan(current)}`);

	const selected = await p.select({
		message: "Share setting",
		options: [
			{
				value: "manual" as const,
				label: "Manual",
				hint: "share when requested",
			},
			{
				value: "auto" as const,
				label: "Auto",
				hint: "automatically share sessions",
			},
			{ value: "disabled" as const, label: "Disabled", hint: "never share" },
		],
	});

	if (p.isCancel(selected)) {
		return;
	}

	const shareValue = selected as "manual" | "auto" | "disabled";
	config.share = shareValue;
	saveConfig(configPath, config);
	p.log.success(`Share set to ${color.cyan(shareValue)}`);
}

async function editAutoupdate(configPath: string) {
	const config = loadConfig(configPath);
	const current = config.autoupdate ?? true;

	const display =
		current === "notify" ? "notify" : current ? "enabled" : "disabled";
	p.log.info(`Current autoupdate: ${color.cyan(display)}`);

	const selected = await p.select({
		message: "Autoupdate behavior",
		options: [
			{
				value: "true" as const,
				label: "Enabled",
				hint: "auto-update OpenCode",
			},
			{
				value: "notify" as const,
				label: "Notify",
				hint: "notify but don't auto-update",
			},
			{
				value: "false" as const,
				label: "Disabled",
				hint: "never update automatically",
			},
		],
	});

	if (p.isCancel(selected)) {
		return;
	}

	const selectedValue = selected as string;
	if (selectedValue === "notify") {
		config.autoupdate = "notify";
	} else {
		config.autoupdate = selectedValue === "true";
	}

	saveConfig(configPath, config);
	p.log.success(`Autoupdate set to ${color.cyan(selectedValue)}`);
}
