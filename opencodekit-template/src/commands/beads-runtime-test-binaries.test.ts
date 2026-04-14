import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { installFakeRuntimeBinaries } from "./beads-runtime-test-binaries.js";

const tempDirs: string[] = [];

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
	delete process.env.PATH;
});

function createTempDir(prefix: string): string {
	const dir = mkdtempSync(join(tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

describe("installFakeRuntimeBinaries", () => {
	it("creates POSIX shims without Windows command wrappers on non-Windows platforms", () => {
		const projectDir = createTempDir("ock-fake-runtime-posix-");

		installFakeRuntimeBinaries(projectDir, "/usr/bin", "linux");

		expect(existsSync(join(projectDir, "bin", "npm"))).toBe(true);
		expect(existsSync(join(projectDir, "bin", "br"))).toBe(true);
		expect(existsSync(join(projectDir, "bin", "npm.cmd"))).toBe(false);
		expect(existsSync(join(projectDir, "bin", "br.cmd"))).toBe(false);
		expect(process.env.PATH).toBe(
			[join(projectDir, "bin"), "/usr/bin"].join(delimiter),
		);
	});

	it("creates Windows command wrappers that point to .js shims", () => {
		const projectDir = createTempDir("ock-fake-runtime-win-");

		installFakeRuntimeBinaries(projectDir, "C:\\Windows\\System32", "win32");

		expect(existsSync(join(projectDir, "bin", "npm.js"))).toBe(true);
		expect(existsSync(join(projectDir, "bin", "br.js"))).toBe(true);
		expect(existsSync(join(projectDir, "bin", "npm.cmd"))).toBe(true);
		expect(existsSync(join(projectDir, "bin", "br.cmd"))).toBe(true);
		expect(existsSync(join(projectDir, "bin", "npm"))).toBe(false);
		expect(existsSync(join(projectDir, "bin", "br"))).toBe(false);
		expect(readFileSync(join(projectDir, "bin", "npm.cmd"), "utf-8")).toContain(
			'node "%~dp0\\npm.js" %*',
		);
		expect(readFileSync(join(projectDir, "bin", "br.cmd"), "utf-8")).toContain(
			'node "%~dp0\\br.js" %*',
		);
		expect(process.env.PATH).toBe(
			[join(projectDir, "bin"), "C:\\Windows\\System32"].join(delimiter),
		);
	});
});
