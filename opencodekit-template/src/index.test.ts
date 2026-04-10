import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

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

function getUniqueSortedCommandNames(commandNames: string[]): string[] {
	return [...new Set(commandNames)].sort();
}

	describe("ock CLI runtime front-door contract", () => {
		it("locks OCK to the bootstrap and management command surface", () => {
			const source = readFileSync(new URL("./index.ts", import.meta.url), "utf-8");
			const commandNames = getRegisteredCommandNames(source);

			expect(commandNames).toHaveLength(getUniqueSortedCommandNames(commandNames).length);
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

	it("proves slice-one runtime execution stays on the OMO CLI", () => {
		const cliSource = readFileSync(new URL("./index.ts", import.meta.url), "utf-8");
		const commandNames = getRegisteredCommandNames(cliSource);
		const readme = readFileSync(new URL("../README.md", import.meta.url), "utf-8");

		expect(commandNames).not.toContain("run");
		expect(readme).toContain("The packaged CLI commands are:");
		expect(readme).toContain("Runtime execution stays on the OMO CLI");
		expect(readme).toContain("there is intentionally no `ock run` command in this slice");
		expect(readme).toContain("ock init");
		expect(readme).toContain("ock upgrade");
	});
});
