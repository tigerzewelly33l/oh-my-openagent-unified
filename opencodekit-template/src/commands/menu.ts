import * as p from "@clack/prompts";
import color from "picocolors";
import { agentCommand } from "./agent.js";
import { configCommand } from "./config.js";
import { doctorCommand } from "./doctor.js";
import { initCommand } from "./init.js";
import { skillCommand } from "./skill.js";
import { statusCommand } from "./status.js";
import { upgradeCommand } from "./upgrade.js";

export async function interactiveMenu(version: string) {
	p.intro(color.bgCyan(color.black(` OpenCodeKit v${version} `)));

	const action = await p.select({
		message: "What do you want to do?",
		options: [
			{ value: "init" as const, label: "Initialize project" },
			{ value: "config" as const, label: "Config - edit opencode.json" },
			{ value: "upgrade" as const, label: "Upgrade - update templates" },
			{ value: "agent-list" as const, label: "List agents" },
			{ value: "agent-add" as const, label: "Add agent" },
			{ value: "skill-list" as const, label: "List skills" },
			{ value: "skill-add" as const, label: "Add skill" },
			{ value: "status" as const, label: "Status - project overview" },
			{ value: "doctor" as const, label: "Doctor - check project health" },
			{ value: "exit" as const, label: "Exit" },
		],
	});

	if (p.isCancel(action) || action === "exit") {
		p.outro("Bye!");
		return;
	}

	switch (action) {
		case "init":
			console.clear();
			await initCommand({});
			break;
		case "config":
			await configCommand();
			break;
		case "upgrade":
			await upgradeCommand({});
			break;
		case "agent-list":
			await agentCommand("list");
			break;
		case "agent-add":
			await agentCommand("add");
			break;
		case "skill-list":
			await skillCommand("list");
			break;
		case "skill-add":
			await skillCommand("add");
			break;
		case "status":
			await statusCommand();
			break;
		case "doctor":
			await doctorCommand();
			break;
	}
}
