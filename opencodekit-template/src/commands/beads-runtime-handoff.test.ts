import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const TEMPLATE_ROOT = process.cwd();

function readCommand(name: "start" | "resume"): string {
	return readFileSync(
		join(TEMPLATE_ROOT, ".opencode", "command", `${name}.md`),
		"utf-8",
	);
}

describe("beads runtime handoff commands", () => {
	it("/start hands off to beads_runtime_attach only after the in-progress claim step", () => {
		const startCommand = readCommand("start");
		const claimIndex = startCommand.indexOf("br update $ARGUMENTS --status in_progress");
		const attachIndex = startCommand.indexOf("beads_runtime_attach({");

		expect(claimIndex).toBeGreaterThanOrEqual(0);
		expect(attachIndex).toBeGreaterThan(claimIndex);
		expect(startCommand).toContain('source_command: "start"');
		expect(startCommand).toContain('bead_id: "$ARGUMENTS"');
		expect(startCommand).toContain("If `beads_runtime_attach` fails, stop immediately");
	});

	it("/resume hands off to beads_runtime_attach after claim and refuses detached continuation", () => {
		const resumeCommand = readCommand("resume");
		const claimIndex = resumeCommand.indexOf("br update $ARGUMENTS --status in_progress");
		const attachIndex = resumeCommand.indexOf("beads_runtime_attach({");

		expect(claimIndex).toBeGreaterThanOrEqual(0);
		expect(attachIndex).toBeGreaterThan(claimIndex);
		expect(resumeCommand).toContain('source_command: "resume"');
		expect(resumeCommand).toContain('bead_id: "$ARGUMENTS"');
		expect(resumeCommand).toContain("If attach validation fails, stop and report the attach error");
	});
});
