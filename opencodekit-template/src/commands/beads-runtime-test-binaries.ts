import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";

export function installFakeRuntimeBinaries(
	projectDir: string,
	originalPath: string | undefined,
	platform = process.platform,
) {
	const binDir = join(projectDir, "bin");
	mkdirSync(binDir, { recursive: true });
	const fakeNpmScript = [
		"#!/usr/bin/env node",
		'const { mkdirSync } = require("node:fs");',
		'const { join } = require("node:path");',
		'mkdirSync(join(process.cwd(), "node_modules"), { recursive: true });',
	].join("\n");
	const npmScriptPath = join(binDir, platform === "win32" ? "npm.js" : "npm");
	writeFileSync(npmScriptPath, `${fakeNpmScript}\n`);
	chmodSync(npmScriptPath, 0o755);
	if (platform === "win32") {
		writeFileSync(
			join(binDir, "npm.cmd"),
			'@echo off\r\nnode "%~dp0\\npm.js" %*\r\n',
		);
	}

	const fakeBrScript = [
		"#!/usr/bin/env node",
		'const { mkdirSync, existsSync, readFileSync, writeFileSync } = require("node:fs");',
		'const { join } = require("node:path");',
		"const cwd = process.cwd();",
		'const beadsDir = join(cwd, ".beads");',
		'const ledgerPath = join(beadsDir, "ledger.json");',
		"const args = process.argv.slice(2);",
		"function loadLedger() {",
		"  if (!existsSync(ledgerPath)) return { next: 1, tasks: [], deps: [], syncs: 0 };",
		'  return JSON.parse(readFileSync(ledgerPath, "utf-8"));',
		"}",
		"function saveLedger(ledger) {",
		"  mkdirSync(beadsDir, { recursive: true });",
		"  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));",
		"}",
		'if (args.length === 1 && args[0] === "--help") {',
		'  process.stdout.write("usage\\nready\\nlist\\nshow\\n");',
		"  process.exit(0);",
		"}",
		'if (args[0] === "ready" && args[1] === "--help") {',
		'  process.stdout.write("--json\\n");',
		"  process.exit(0);",
		"}",
		'if (args[0] === "list" && args[1] === "--help") {',
		'  process.stdout.write("--status\\n--json\\n");',
		"  process.exit(0);",
		"}",
		'if (args[0] === "show" && args[1] === "--help") {',
		'  process.stdout.write("--json\\n");',
		"  process.exit(0);",
		"}",
		'if (args[0] === "init") {',
		'  mkdirSync(join(beadsDir, "artifacts"), { recursive: true });',
		'  writeFileSync(join(beadsDir, "config.yaml"), "version: 1\\n");',
		"  saveLedger(loadLedger());",
		"  process.exit(0);",
		"}",
		"const ledger = loadLedger();",
		'if (args[0] === "create") {',
		'  const id = "bd-" + ledger.next++;',
		'  ledger.tasks.push({ id, title: args[1], status: "open" });',
		"  saveLedger(ledger);",
		"  process.stdout.write(JSON.stringify({ id }));",
		"  process.exit(0);",
		"}",
		'if (args[0] === "dep" && args[1] === "add") {',
		"  ledger.deps.push({ child: args[2], parent: args[3] });",
		"  saveLedger(ledger);",
		"  process.exit(0);",
		"}",
		'if (args[0] === "ready" && args.includes("--json")) {',
		"  const blocked = new Set(ledger.deps.map((dep) => dep.child));",
		"  process.stdout.write(JSON.stringify(ledger.tasks.filter((task) => !blocked.has(task.id))));",
		"  process.exit(0);",
		"}",
		'if (args[0] === "list" && args[1] === "--status" && args[2] === "in_progress" && args[3] === "--json") {',
		"  process.stdout.write(JSON.stringify({ issues: ledger.tasks, total: ledger.tasks.length, limit: 50, offset: 0, has_more: false }));",
		"  process.exit(0);",
		"}",
		'if (args[0] === "show" && args.includes("--json")) {',
		"  process.stdout.write(JSON.stringify(ledger.tasks.filter((task) => task.id === args[1])));",
		"  process.exit(0);",
		"}",
		'if (args[0] === "sync" && args[1] === "--flush-only") {',
		"  ledger.syncs += 1;",
		"  saveLedger(ledger);",
		"  process.exit(0);",
		"}",
		'process.stderr.write("unsupported command: " + args.join(" "));',
		"process.exit(1);",
	].join("\n");

	const brScriptPath = join(binDir, platform === "win32" ? "br.js" : "br");
	writeFileSync(brScriptPath, fakeBrScript);
	chmodSync(brScriptPath, 0o755);
	if (platform === "win32") {
		writeFileSync(
			join(binDir, "br.cmd"),
			'@echo off\r\nnode "%~dp0\\br.js" %*\r\n',
		);
	}
	process.env.PATH = [binDir, originalPath ?? ""]
		.filter((value) => value.length > 0)
		.join(delimiter);
}
