import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { isOckBeadFirstProject } from "./ock-bead-first-project";

function writeCommandFile(commandsDir: string, fileName: string): void {
	writeFileSync(join(commandsDir, fileName), `# ${fileName}\n`);
}

function writeOckWorkflowCommands(
	projectDir: string,
	directoryName = "command",
	extraCommands: string[] = [],
): void {
	const commandsDir = join(projectDir, ".opencode", directoryName);
	mkdirSync(commandsDir, { recursive: true });

	writeCommandFile(commandsDir, "create.md");

	for (const commandName of extraCommands) {
		writeCommandFile(commandsDir, commandName);
	}
}

describe("isOckBeadFirstProject", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "omo-ock-bead-first-project-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns true when nearest ancestor has .beads and OCK workflow commands", () => {
		// given
		const projectDir = join(testDir, "project");
		const childDir = join(projectDir, "apps", "cli");
		mkdirSync(join(projectDir, ".beads"), { recursive: true });
		writeOckWorkflowCommands(projectDir, "command", [
			"research.md",
			"start.md",
			"plan.md",
		]);

		// when
		const result = isOckBeadFirstProject(childDir);

		// then
		expect(result).toBe(true);
	});

	it("returns false when only .opencode exists", () => {
		// given
		const projectDir = join(testDir, "project");
		writeOckWorkflowCommands(projectDir, "command", [
			"research.md",
			"start.md",
			"plan.md",
		]);

		// when
		const result = isOckBeadFirstProject(projectDir);

		// then
		expect(result).toBe(false);
	});

	it("returns false when only .beads exists", () => {
		// given
		const projectDir = join(testDir, "project");
		mkdirSync(join(projectDir, ".beads"), { recursive: true });

		// when
		const result = isOckBeadFirstProject(projectDir);

		// then
		expect(result).toBe(false);
	});

	it("uses nearest matching ancestor inside nested directories", () => {
		// given
		const outerProjectDir = join(testDir, "outer-project");
		const innerProjectDir = join(outerProjectDir, "packages", "inner-project");
		const childDir = join(innerProjectDir, "src");

		mkdirSync(join(outerProjectDir, ".beads"), { recursive: true });
		writeOckWorkflowCommands(outerProjectDir, "commands", [
			"research.md",
			"start.md",
			"ship.md",
		]);

		mkdirSync(join(innerProjectDir, ".beads"), { recursive: true });
		writeOckWorkflowCommands(innerProjectDir, "command", [
			"research.md",
			"plan.md",
			"pr.md",
		]);

		// when
		const result = isOckBeadFirstProject(childDir);

		// then
		expect(result).toBe(true);
	});
});
