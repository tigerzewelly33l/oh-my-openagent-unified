import { requireOpencodePath } from "../utils/errors.js";
import {
	loadAgentItems,
	loadSkillItems,
	runBrowser,
} from "./components/Browser.js";
import { runConfigEditor } from "./components/ConfigEditor.js";
import { renderDashboard } from "./components/Dashboard.js";
import { runMCPMonitor } from "./components/MCPMonitor.js";
import { loadProjectData } from "./hooks/useData.js";
import { createKeyboardController } from "./utils/keyboard.js";

/**
 * Launch the TUI dashboard with interactive navigation.
 */
export async function launchTUI(): Promise<void> {
	if (!requireOpencodePath()) {
		return;
	}

	await mainMenu();
}

async function mainMenu(): Promise<void> {
	const data = loadProjectData();
	renderDashboard(data);

	return new Promise((resolve) => {
		const kb = createKeyboardController();

		const handleKey = async (key: string) => {
			switch (key) {
				case "a":
					kb.stop();
					await browseAgents();
					await mainMenu();
					resolve();
					break;
				case "s":
					kb.stop();
					await browseSkills();
					await mainMenu();
					resolve();
					break;
				case "c":
					kb.stop();
					await runConfigEditor();
					await mainMenu();
					resolve();
					break;
				case "m":
					kb.stop();
					await runMCPMonitor();
					await mainMenu();
					resolve();
					break;
				case "q":
				case "escape":
				case "quit":
					kb.stop();
					console.clear();
					resolve();
					break;
			}
		};

		kb.start(handleKey);
	});
}

async function browseAgents(): Promise<void> {
	const items = loadAgentItems();
	await runBrowser({
		title: "Agents",
		items,
		onSelect: (item) => {
			console.log(`Selected: ${item.name}`);
		},
	});
}

async function browseSkills(): Promise<void> {
	const items = loadSkillItems();
	await runBrowser({
		title: "Skills",
		items,
		onSelect: (item) => {
			console.log(`Selected: ${item.name}`);
		},
	});
}
