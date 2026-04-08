import type { CAC } from "cac";

import {
  captureHoneybadgerError,
  hasHoneybadgerReportedError,
} from "./utils/honeybadger-client.js";
import { logger } from "./utils/logger.js";

export async function parseCli(cli: CAC): Promise<void> {
	try {
		await cli.parse(process.argv);
	} catch (error) {
		if (!hasHoneybadgerReportedError(error)) {
			await captureHoneybadgerError(error, {
				action: "cli.parse",
				awaitDelivery: true,
				context: {
					command_name: process.argv[2],
					arg_count: Math.max(process.argv.length - 2, 0),
				},
			});
		}
		logger.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}
