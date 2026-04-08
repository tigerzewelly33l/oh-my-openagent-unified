import * as p from "@clack/prompts";

import { captureHoneybadgerError } from "./utils/honeybadger-client.js";
import { requireValidLicense } from "./utils/license.js";

export async function ensureLicenseFor(commandName: "init" | "upgrade") {
  try {
    const result = await requireValidLicense();
    if (result.mode === "offline-grace") {
      p.log.warn(
        "License server is unreachable. Running in offline grace mode.",
      );
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await captureHoneybadgerError(error, {
      action: `license.gate.${commandName}`,
      awaitDelivery: true,
      context: {
        command: commandName,
      },
    });
    p.log.error(`${commandName} requires a valid license`);
    p.log.info(message);
    p.log.info("Run: ock activate <LICENSE_KEY>");
    process.exitCode = 1;
    return false;
  }
}
