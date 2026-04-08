import { describe, expect, it, vi, afterEach } from "vitest";

import { parseCli } from "./parse-cli.js";
import * as honeybadger from "./utils/honeybadger-client.js";
import { logger } from "./utils/logger.js";

afterEach(() => {
	vi.restoreAllMocks();
});

describe("parseCli", () => {
	it("does not report errors that were already reported", async () => {
		const error = honeybadger.markHoneybadgerReportedError(new Error("boom"));
		const cli = {
			parse: vi.fn().mockRejectedValue(error),
		} as unknown as { parse: (argv: string[]) => Promise<void> };

		const captureSpy = vi.spyOn(honeybadger, "captureHoneybadgerError").mockResolvedValue();
		vi.spyOn(logger, "error").mockImplementation(() => undefined);
		vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

		await parseCli(cli as never);

		expect(captureSpy).not.toHaveBeenCalled();
	});
});
