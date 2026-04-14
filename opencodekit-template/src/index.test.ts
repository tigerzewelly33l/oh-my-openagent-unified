import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { installFakeRuntimeBinaries } from "./commands/beads-runtime-test-binaries.js";
import { TSX_LOADER_PATH } from "./commands/test-cli-paths.js";

function getRegisteredCommandNames(source: string): string[] {
	const matches = source.matchAll(/\.command\(\s*"([^"]+)"/g);
	const commandNames: string[] = [];

	for (const match of matches) {
		const rawName = match[1]?.trim() ?? "";
		if (rawName.length === 0) {
			continue;
		}

		commandNames.push(rawName.split(" ")[0] ?? rawName);
	}

	return commandNames;
}

function getRegisteredCommandSurfaces(source: string): string[] {
	return Array.from(source.matchAll(/\.command\(\s*"([^"]+)"/g)).map(
		(match) => match[1]?.trim() ?? "",
	);
}

function getUniqueSortedCommandNames(commandNames: string[]): string[] {
	return [...new Set(commandNames)].sort();
}

const ORIGINAL_PATH = process.env.PATH;

function createCliFixture(prefix: string) {
	const projectDir = mkdtempSync(join(tmpdir(), prefix));
	mkdirSync(join(projectDir, ".opencode", "node_modules"), {
		recursive: true,
	});
	writeFileSync(
		join(projectDir, ".opencode", "opencode.json"),
		JSON.stringify({
			$schema: "https://opencode.ai/config.json",
			model: "openai/gpt-5.4",
			mcp: {},
			plugin: ["oh-my-openagent"],
		}),
	);
	writeFileSync(
		join(projectDir, ".opencode", "package.json"),
		JSON.stringify({ name: "fixture" }),
	);
	mkdirSync(join(projectDir, ".beads"), { recursive: true });
	writeFileSync(join(projectDir, ".beads", "config.yaml"), "version: 1\n");
	installFakeRuntimeBinaries(projectDir, ORIGINAL_PATH);
	return projectDir;
}

function runSourceCli(projectDir: string, args: string[]) {
	return spawnSync(
		"node",
		[
			"--import",
			TSX_LOADER_PATH,
			"/work/ock-omo-system/opencodekit-template/src/index.ts",
			...args,
		],
		{
			cwd: projectDir,
			encoding: "utf-8",
			env: process.env,
		},
	);
}

describe("ock CLI runtime front-door contract", () => {
	it("locks OCK to the bootstrap and management command surface", () => {
		const source = readFileSync(
			new URL("./index.ts", import.meta.url),
			"utf-8",
		);
		const commandNames = getRegisteredCommandNames(source);

		expect(commandNames).toHaveLength(
			getUniqueSortedCommandNames(commandNames).length,
		);
		expect(getUniqueSortedCommandNames(commandNames)).toEqual([
			"activate",
			"agent",
			"command",
			"completion",
			"config",
			"doctor",
			"init",
			"license",
			"patch",
			"plan",
			"status",
			"tui",
			"upgrade",
		]);
	});

	it("keeps runtime-adjacent command names out of OCK's CLI entrypoint", () => {
		const source = readFileSync(
			new URL("./index.ts", import.meta.url),
			"utf-8",
		);
		const commandNames = getRegisteredCommandNames(source);

		expect(commandNames).not.toContain("run");
		expect(commandNames).not.toContain("resume");
		expect(commandNames).not.toContain("session");
		expect(commandNames).not.toContain("attach");
		expect(commandNames).not.toContain("serve");
		expect(commandNames).not.toContain("server");
	});

	it("proves slice-one runtime execution stays on the OMO CLI", () => {
		const cliSource = readFileSync(
			new URL("./index.ts", import.meta.url),
			"utf-8",
		);
		const commandNames = getRegisteredCommandNames(cliSource);
		const readme = readFileSync(
			new URL("../README.md", import.meta.url),
			"utf-8",
		);

		expect(commandNames).not.toContain("run");
		expect(readme).toContain("The packaged CLI commands are:");
		expect(readme).toContain(
			"OCK is the public command authority for this integration story.",
		);
		expect(readme).toContain(
			"There is intentionally no `ock run` command in this slice",
		);
		expect(readme).toContain("ock init");
		expect(readme).toContain("ock upgrade");
	});

	it("registers the public durable plan publish surface", () => {
		const source = readFileSync(
			new URL("./index.ts", import.meta.url),
			"utf-8",
		);
		const cliDoc = readFileSync(new URL("../CLI.md", import.meta.url), "utf-8");
		const commandSurfaces = getRegisteredCommandSurfaces(source);

		expect(commandSurfaces).toContain("plan [action]");
		expect(getRegisteredCommandNames(source)).toContain("plan");
		expect(cliDoc).toContain("ock plan publish --bead <id> --plan <path>");
	});

	it("registers the public runtime-state repair flags on doctor", () => {
		const source = readFileSync(
			new URL("./index.ts", import.meta.url),
			"utf-8",
		);
		const cliDoc = readFileSync(new URL("../CLI.md", import.meta.url), "utf-8");

		expect(source).toContain('.command("doctor", "Check project health")');
		expect(source).toContain('"--repair <target>"');
		expect(source).toContain(
			"Repair the rebuildable .sisyphus runtime state from durable .beads artifacts (supported: runtime-state)",
		);
		expect(source).toContain(
			'.option("--json", "Emit machine-readable repair output")',
		);
		expect(source).toContain('"--bead <beadId>"');
		expect(source).toContain("Target bead identifier for runtime-state repair");
		expect(cliDoc).toContain(
			"ock doctor --repair runtime-state [--json] [--bead <id>]",
		);
	});

	it("shows publish as the supported plan action in CLI help", () => {
		const projectDir = createCliFixture("ock-index-plan-help-");
		const result = runSourceCli(projectDir, ["plan", "--help"]);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain(
			"ock plan publish --bead <id> --plan <path>",
		);
		expect(result.stdout).toContain("publish");
	});

	it("shows runtime-state as the supported doctor repair target in CLI help", () => {
		const projectDir = createCliFixture("ock-index-doctor-help-");
		const result = runSourceCli(projectDir, ["doctor", "--help"]);

		expect(result.status).toBe(0);
		expect(result.stdout).toContain("runtime-state");
		expect(result.stdout).toContain(
			"Repair the rebuildable .sisyphus runtime state from durable .beads artifacts",
		);
	});

	it("fails plan publish missing args as normal CLI UX without a raw stack trace", () => {
		const projectDir = createCliFixture("ock-index-plan-missing-args-");
		const result = runSourceCli(projectDir, ["plan", "publish"]);

		expect(result.status).toBe(1);
		expect(result.stdout).toContain(
			"Missing required --bead <bead-id> argument.",
		);
		expect(result.stdout).toContain(
			"Use: ock plan publish --bead <id> --plan <path>",
		);
		expect(result.stdout).not.toContain("[Honeybadger] Error report sent");
		expect(result.stderr).not.toContain("node:internal/process/promises");
		expect(result.stderr).not.toContain("triggerUncaughtException");
		expect(result.stderr).not.toContain("at planPublishCommand");
		expect(result.stderr).not.toContain("Error: Missing required --bead");
	});

	it("registers the public status json diagnostics surface", () => {
		const source = readFileSync(
			new URL("./index.ts", import.meta.url),
			"utf-8",
		);

		expect(source).toContain('.command("status", "Show project overview")');
		expect(source).toContain(
			'.option("--json", "Emit machine-readable diagnostic output")',
		);
	});
});
