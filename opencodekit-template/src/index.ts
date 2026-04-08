#!/usr/bin/env node

import { cac } from "cac";
import packageInfo from "../package.json" with { type: "json" };

import { activateCommand } from "./commands/activate.js";
import { agentCommand } from "./commands/agent.js";
import { commandCommand } from "./commands/command.js";
import { completionCommand } from "./commands/completion.js";
import { configCommand } from "./commands/config.js";
import { initCommand } from "./commands/init.js";
import { licenseCommand } from "./commands/license.js";
import {
	doctorCommand,
	interactiveMenu,
	statusCommand,
} from "./commands/menu.js";
import { configureUtf8Output } from "./configure-utf8-output.js";
import { runCommandWithHoneybadger } from "./honeybadger-command.js";
import { ensureLicenseFor } from "./license-gate.js";
import { parseCli } from "./parse-cli.js";
import { patchCommand } from "./commands/patch.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { launchTUI } from "./tui/index.js";
import { initHoneybadger } from "./utils/honeybadger-client.js";

configureUtf8Output();
initHoneybadger({ component: "ock-cli", surface: "ock-cli", runtime: "node" });

const packageVersion = packageInfo.version;

const cli = cac("ock");

// Global options
cli.option("--verbose", "Enable verbose logging");
cli.option("--quiet", "Suppress all output");

// Set version
cli.version(`${packageVersion}`);

// Register commands
cli
	.command("init", "Initialize OpenCodeKit in current directory")
	.option("--force", "Reinitialize even if already exists")
	.option("--beads", "Also initialize .beads/ for multi-agent coordination")
	.option("--global", "Install to global OpenCode config (~/.config/opencode/)")
	.option("--free", "Use free models (default)")
	.option("--recommend", "Use recommended premium models")
	.option("-y, --yes", "Skip prompts, use defaults (for CI)")
	.option("--backup", "Backup existing .opencode before overwriting")
	.option("--prune", "Manually select orphan files to delete")
	.option("--prune-all", "Auto-delete all orphan files")
	.option(
		"--project-only",
		"Only init project-scope files (skip if global config has agents/skills/commands/tools)",
	)
	.action(async (options) => {
		if (!(await ensureLicenseFor("init"))) {
			return;
		}
		await runCommandWithHoneybadger("init", () => initCommand(options));
	});

cli
	.command("activate [key]", "Activate paid license key")
	.action(async (key?: string) => {
		await runCommandWithHoneybadger("activate", () => activateCommand(key));
	});

cli
	.command("license [action]", "Manage license (status, deactivate)")
	.action(async (action?: string) => {
		await runCommandWithHoneybadger("license", () => licenseCommand(action));
	});

cli
	.command("agent [action]", "Manage agents (list, add, view)")
	.action(async (action?: string) => {
		if (!action) {
			// Show help for agent command
			console.log("\nUsage: ock agent <action>\n");
			console.log("Actions:");
			console.log("  list    List all agents");
			console.log("  add     Create a new agent");
			console.log("  view    View agent details\n");
			return;
		}
		await agentCommand(action);
	});

cli
	.command(
		"command [action]",
		"Manage slash commands (list, create, show, delete)",
	)
	.action(async (action?: string) => {
		if (!action) {
			console.log("\nUsage: ock command <action>\n");
			console.log("Actions:");
			console.log("  list    List all slash commands");
			console.log("  create  Create a new command");
			console.log("  show    Show command content");
			console.log("  delete  Delete a command\n");
			return;
		}
		await commandCommand(action);
	});

cli
	.command("agent [action]", "Manage agents (list, create, view, remove)")
	.action(async (action?: string) => {
		if (!action) {
			console.log("\nUsage: ock agent <action>\n");
			console.log("Actions:");
			console.log("  list    List all agents");
			console.log("  create  Create a new agent");
			console.log("  view    View agent details");
			console.log("  remove  Remove an agent\n");
			return;
		}
		await agentCommand(action);
	});

cli.command("doctor", "Check project health").action(doctorCommand);

cli.command("status", "Show project overview").action(statusCommand);

cli
	.command(
		"config [action]",
		"Edit opencode.json (model, mcp, permission, validate, show)",
	)
	.action(async (action?: string) => {
		await configCommand(action);
	});

cli
	.command("upgrade", "Update .opencode/ templates to latest version")
	.option("--force", "Force upgrade even if already up to date")
	.option("--check", "Check for updates without upgrading")
	.option("--prune", "Manually select orphan files to delete")
	.option("--prune-all", "Auto-delete all orphan files")
	.action(
		async (options: {
			force?: boolean;
			check?: boolean;
			prune?: boolean;
			pruneAll?: boolean;
		}) => {
			if (!(await ensureLicenseFor("upgrade"))) {
				return;
			}
			await runCommandWithHoneybadger("upgrade", () => upgradeCommand(options));
		},
	);

cli
	.command(
		"patch [action]",
		"Manage template patches (list, create, apply, diff, remove, disable, enable)",
	)
	.action(async (action?: string) => {
		await patchCommand(action);
	});

cli
	.command(
		"completion [shell]",
		"Generate shell completion script (bash, zsh, fish)",
	)
	.action(async (shell?: string) => {
		await completionCommand(shell);
	});

cli.command("tui", "Launch interactive dashboard").action(async () => {
	await launchTUI();
});

// Default command (no args) -> interactive menu
cli.command("", "Interactive menu").action(async () => {
	await interactiveMenu(packageVersion);
});

// Help
cli.help();

void parseCli(cli);

export { cli };
