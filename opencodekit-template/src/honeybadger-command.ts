import {
  captureHoneybadgerError,
  markHoneybadgerReportedError,
} from "./utils/honeybadger-client.js";

export async function runCommandWithHoneybadger<T>(
  action: string,
  handler: () => Promise<T>,
): Promise<T> {
  try {
    return await handler();
  } catch (error) {
    const normalizedError =
      error instanceof Error ? error : new Error(String(error));
    await captureHoneybadgerError(error, {
      action,
      awaitDelivery: true,
      context: {
        command: action,
      },
    });
    throw markHoneybadgerReportedError(normalizedError);
  }
}
