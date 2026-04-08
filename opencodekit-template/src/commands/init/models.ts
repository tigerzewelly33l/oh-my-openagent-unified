import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as p from "@clack/prompts";
import color from "picocolors";

export type ModelPreset = "free" | "recommend";

const MODEL_PRESETS: Record<
	ModelPreset,
	{ model: string; agents: Record<string, string> }
> = {
	free: {
		model: "opencode/glm-5-free",
		agents: {
			build: "opencode/minimax-m2.5-free",
			plan: "opencode/minimax-m2.5-free",
			review: "opencode/minimax-m2.5-free",
			explore: "opencode/glm-5-free",
			general: "opencode/glm-5-free",
			vision: "opencode/minimax-m2.5-free",
			scout: "opencode/glm-5-free",
			painter: "opencode/minimax-m2.5-free",
		},
	},
	recommend: {
		model: "github-copilot/gpt-5.4",
		agents: {
			build: "github-copilot/claude-opus-4.6",
			plan: "github-copilot/gpt-5.4",
			review: "github-copilot/claude-opus-4.6",
			explore: "github-copilot/claude-haiku-4.5",
			general: "github-copilot/gpt-5.3-codex",
			vision: "github-copilot/gemini-3.1-pro-preview",
			scout: "github-copilot/claude-sonnet-4.6",
			painter: "proxypal/gemini-3.1-flash-image",
		},
	},
};

const AGENT_DESCRIPTIONS: Record<string, string> = {
	build: "Main coding agent (complex tasks)",
	plan: "Planning and design agent",
	review: "Code review and debugging",
	explore: "Fast codebase search",
	general: "Quick, simple tasks",
	painter: "Image generation and editing",
	vision: "Visual analysis (quality)",
	scout: "External research/docs",
	compaction: "Context summarization",
};

export function applyModelPreset(targetDir: string, preset: ModelPreset): void {
	const configPath = join(targetDir, ".opencode", "opencode.json");
	if (!existsSync(configPath)) return;

	const config = JSON.parse(readFileSync(configPath, "utf-8"));
	const presetConfig = MODEL_PRESETS[preset];

	config.model = presetConfig.model;

	if (config.agent) {
		for (const [agentName, model] of Object.entries(presetConfig.agents)) {
			if (config.agent[agentName]) {
				config.agent[agentName].model = model;
			}
		}
	}

	writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export async function promptCustomModels(targetDir: string): Promise<void> {
	const configPath = join(targetDir, ".opencode", "opencode.json");
	if (!existsSync(configPath)) return;

	const config = JSON.parse(readFileSync(configPath, "utf-8"));

	p.log.info(
		color.dim(
			"Enter model IDs (e.g., github-copilot/gpt-5.4, proxypal/gemini-3.1-flash-image)",
		),
	);
	p.log.info(color.dim("Press Enter to keep current value\n"));

	const mainModel = await p.text({
		message: "Main session model",
		placeholder: config.model || "github-copilot/gpt-5.4",
		defaultValue: config.model,
	});

	if (p.isCancel(mainModel)) {
		p.log.warn("Cancelled - keeping defaults");
		return;
	}

	if (mainModel) {
		config.model = mainModel;
	}

	const agents = Object.keys(AGENT_DESCRIPTIONS);
	for (const agent of agents) {
		if (!config.agent?.[agent]) continue;

		const currentModel = config.agent[agent].model || config.model;
		const agentModel = await p.text({
			message: `${agent} - ${AGENT_DESCRIPTIONS[agent]}`,
			placeholder: currentModel,
			defaultValue: currentModel,
		});

		if (p.isCancel(agentModel)) {
			p.log.warn("Cancelled - saving partial config");
			break;
		}

		if (agentModel) {
			config.agent[agent].model = agentModel;
		}
	}

	writeFileSync(configPath, JSON.stringify(config, null, 2));
}
