import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { findProjectOpencodeCommandDirs } from "./project-discovery-dirs";

const REQUIRED_WORKFLOW_COMMANDS = [
	"research.md",
	"start.md",
	"plan.md",
	"ship.md",
	"pr.md",
] as const;

function getProjectRootFromCommandDir(commandDirectory: string): string {
	return dirname(dirname(commandDirectory));
}

function hasCanonicalOckWorkflowMarker(commandDirectory: string): boolean {
	if (!existsSync(join(commandDirectory, "create.md"))) {
		return false;
	}

	let matchingCommandCount = 0;
	for (const commandFile of REQUIRED_WORKFLOW_COMMANDS) {
		if (existsSync(join(commandDirectory, commandFile))) {
			matchingCommandCount += 1;
		}
	}

	return matchingCommandCount >= 3;
}

export function isOckBeadFirstProject(startDirectory: string): boolean {
	const commandDirectories = findProjectOpencodeCommandDirs(startDirectory);
	const projectRoots = new Set(
		commandDirectories.map(getProjectRootFromCommandDir),
	);

	for (const projectRoot of projectRoots) {
		if (!existsSync(join(projectRoot, ".beads"))) {
			continue;
		}

		const projectCommandDirectories = commandDirectories.filter(
			(commandDirectory) =>
				getProjectRootFromCommandDir(commandDirectory) === projectRoot,
		);

		if (projectCommandDirectories.some(hasCanonicalOckWorkflowMarker)) {
			return true;
		}
	}

	return false;
}
