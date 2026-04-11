import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";

function readCommand(projectDir: string, name: string): string {
	return readFileSync(
		join(projectDir, ".opencode", "command", `${name}.md`),
		"utf-8",
	);
}

export function assertBeadsRuntimeCommandContracts(projectDir: string) {
	const startCommand = readCommand(projectDir, "start");
	const resumeCommand = readCommand(projectDir, "resume");
	const shipCommand = readCommand(projectDir, "ship");
	const handoffCommand = readCommand(projectDir, "handoff");
	const verifyCommand = readCommand(projectDir, "verify");
	const statusCommand = readCommand(projectDir, "status");

	expect(startCommand).toContain("beads_runtime_attach({");
	expect(resumeCommand).toContain("beads_runtime_attach({");
	expect(shipCommand).toContain(
		"only authored path that closes the bead and runs `br sync --flush-only`",
	);
	expect(shipCommand).toContain(
		"`/verify` remains the only command that writes `.beads/verify.log`",
	);
	expect(handoffCommand).toContain(
		"`/ship` remains the only authored close + sync path",
	);
	expect(handoffCommand).not.toContain("br sync --flush-only");
	expect(verifyCommand).toContain(
		"`/verify` is the only authored command that writes `.beads/verify.log`",
	);
	expect(verifyCommand).toContain(
		"No other authored command should append PASS/FAIL markers to `.beads/verify.log`",
	);
	expect(statusCommand).toContain(
		"Don't create beads, attach runtime state, write verify logs, or modify bead status from status",
	);
}
