#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { cac } from "cac";
import packageInfo from "../package.json" with { type: "json" };

import { activateCommand } from "./commands/activate.js";
import { agentCommand } from "./commands/agent.js";
import { commandCommand } from "./commands/command.js";
import { completionCommand } from "./commands/completion.js";
import { configCommand } from "./commands/config.js";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { licenseCommand } from "./commands/license.js";
import { interactiveMenu } from "./commands/menu.js";
import { patchCommand } from "./commands/patch.js";
import { planPublishCommand } from "./commands/plan-publish.js";
import { statusCommand } from "./commands/status.js";
import { upgradeCommand } from "./commands/upgrade.js";
import { configureUtf8Output } from "./configure-utf8-output.js";
import { runCommandWithHoneybadger } from "./honeybadger-command.js";
import { ensureLicenseFor } from "./license-gate.js";
import { parseCli } from "./parse-cli.js";
import { launchTUI } from "./tui/index.js";
import { showError } from "./utils/errors.js";
import { initHoneybadger } from "./utils/honeybadger-client.js";

configureUtf8Output();
initHoneybadger({ component: "ock-cli", surface: "ock-cli", runtime: "node" });

const packageVersion = packageInfo.version;

function showPlanUsage() {
	console.log("\nUsage: ock plan publish --bead <id> --plan <path>\n");
	console.log("Actions:");
	console.log("  publish  Publish a durable plan snapshot\n");
}

function isPlanPublishCliError(error: unknown): error is Error {
	if (!(error instanceof Error)) {
		return false;
	}

	return [
		"Missing required --bead <bead-id> argument.",
		"Missing required --plan <absolute-or-relative-plan-path> argument.",
		"Plan path must point to a .sisyphus/plans/*.md file inside the current project.",
		"Plan file not found:",
		"This command requires a .beads directory in the current project.",
		"Bead not visible through supported br lookups:",
		"Unable to read bead state through br:",
	].some((prefix) => error.message.startsWith(prefix));
}

export function buildCli() {
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
		.option(
			"--global",
			"Install to global OpenCode config (~/.config/opencode/)",
		)
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

	cli
		.command("doctor", "Check project health")
		.usage("doctor [--repair runtime-state] [--json] [--bead <id>]")
		.option(
			"--repair <target>",
			"Repair the rebuildable .sisyphus runtime state from durable .beads artifacts (supported: runtime-state)",
		)
		.option("--json", "Emit machine-readable repair output")
		.option(
			"--bead <beadId>",
			"Target bead identifier for runtime-state repair",
		)
		.example("$ ock doctor --repair runtime-state --bead <id>")
		.action(doctorCommand);

	cli
		.command("status", "Show project overview")
		.option("--json", "Emit machine-readable diagnostic output")
		.action(statusCommand);

	cli
		.command("plan [action]", "Manage durable plan snapshots")
		.usage("plan publish --bead <id> --plan <path>")
		.option("--bead <beadId>", "Target bead identifier")
		.option(
			"--plan <planPath>",
			"Absolute or relative path to a .sisyphus/plans/*.md file",
		)
		.example("$ ock plan publish --bead <id> --plan <path>")
		.action(
			async (
				action: string | undefined,
				options: { bead?: string; plan?: string },
			) => {
				if (!action) {
					showPlanUsage();
					return;
				}

				if (action !== "publish") {
					showError(
						`Unknown plan action: ${action}`,
						"Use: ock plan publish --bead <id> --plan <path>",
					);
					process.exitCode = 1;
					return;
				}

				try {
					await planPublishCommand(options);
				} catch (error) {
					if (isPlanPublishCliError(error)) {
						showError(
							error.message,
							"Use: ock plan publish --bead <id> --plan <path>",
						);
						process.exitCode = 1;
						return;
					}

					await runCommandWithHoneybadger("plan.publish", async () => {
						throw error;
					});
				}
			},
		);

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
				await runCommandWithHoneybadger("upgrade", () =>
					upgradeCommand(options),
				);
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

	return cli;
}

const cli = buildCli();

if (
	process.argv[1] &&
	import.meta.url === pathToFileURL(process.argv[1]).href
) {
	void parseCli(cli);
}

export { cli };
