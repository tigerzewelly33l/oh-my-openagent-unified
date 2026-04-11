import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ARTIFACTS_DIR = join(".beads", "artifacts");

export const RUNTIME_ATTACHMENTS_FILE = join(
	ARTIFACTS_DIR,
	"runtime-attachments.json",
);

export const BOULDER_STATE_FILE = join(".sisyphus", "boulder.json");

export function readJsonObject(
	filePath: string,
): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(readFileSync(filePath, "utf-8"));
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

export function getLatestCheckpointPath(projectDir: string): string | null {
	const artifactsDir = join(projectDir, ARTIFACTS_DIR);
	if (!existsSync(artifactsDir)) {
		return null;
	}

	const checkpoints = readdirSync(artifactsDir)
		.filter(
			(entry) => entry.startsWith("checkpoint-") && entry.endsWith(".json"),
		)
		.map((entry) => join(artifactsDir, entry))
		.sort((left, right) => statSync(right).mtimeMs - statSync(left).mtimeMs);

	return checkpoints[0] ?? null;
}
