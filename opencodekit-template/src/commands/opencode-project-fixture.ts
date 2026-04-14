import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export interface OpencodeProjectFixtureOptions {
	installDependencies?: boolean;
}

export function createTempProject(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix));
}

export function createOpencodeProject(
	rootDir: string,
	options: OpencodeProjectFixtureOptions = {},
): string {
	const opencodeDir = join(rootDir, ".opencode");
	mkdirSync(opencodeDir, { recursive: true });
	if (options.installDependencies !== false) {
		mkdirSync(join(opencodeDir, "node_modules"), { recursive: true });
	}
	writeFileSync(
		join(opencodeDir, "opencode.json"),
		JSON.stringify({
			$schema: "https://opencode.ai/config.json",
			model: "openai/gpt-5.4",
			mcp: {},
			plugin: ["oh-my-openagent"],
		}),
	);
	writeFileSync(join(opencodeDir, "package.json"), JSON.stringify({ name: "fixture" }));
	return opencodeDir;
}
