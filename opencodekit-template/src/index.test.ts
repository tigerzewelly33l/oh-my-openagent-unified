import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

function getRegisteredCommandNames(source: string): string[] {
	const matches = source.matchAll(/\.command\(\s*"([^"]+)"/g);
	const commandNames = new Set<string>();

	for (const match of matches) {
		const rawName = match[1]?.trim() ?? "";
		if (rawName.length === 0) {
			continue;
		}

		commandNames.add(rawName.split(" ")[0] ?? rawName);
	}

	return [...commandNames].sort();
}

describe("ock CLI runtime front-door contract", () => {
	it("locks OCK to the bootstrap and management command surface", () => {
		const source = readFileSync(new URL("./index.ts", import.meta.url), "utf-8");
		const commandNames = getRegisteredCommandNames(source);

		expect(commandNames).toEqual([
			"activate",
			"agent",
			"command",
			"completion",
			"config",
			"doctor",
			"init",
			"license",
			"patch",
			"status",
			"tui",
			"upgrade",
		]);
	});

	it("keeps runtime-adjacent command names out of OCK's CLI entrypoint", () => {
		const source = readFileSync(new URL("./index.ts", import.meta.url), "utf-8");
		const commandNames = getRegisteredCommandNames(source);

		expect(commandNames).not.toContain("run");
		expect(commandNames).not.toContain("resume");
		expect(commandNames).not.toContain("session");
		expect(commandNames).not.toContain("attach");
		expect(commandNames).not.toContain("serve");
		expect(commandNames).not.toContain("server");
	});
});
