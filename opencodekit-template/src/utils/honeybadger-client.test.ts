import Honeybadger from "@honeybadger-io/js";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  captureHoneybadgerError,
  hasHoneybadgerReportedError,
  initHoneybadger,
  markHoneybadgerReportedError,
  resetHoneybadgerStateForTest,
} from "./honeybadger-client.js";
import { setSentryModuleForTest } from "./sentry-client.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
  resetHoneybadgerStateForTest();
});

describe("honeybadger-client", () => {
  it("does not notify in test by default", async () => {
    process.env.NODE_ENV = "test";
    const notifySpy = vi.spyOn(Honeybadger, "notify").mockReturnValue(true);

    initHoneybadger({ component: "ock-cli", surface: "ock-cli", runtime: "node" });
    await captureHoneybadgerError(new Error("boom"), { action: "cli.parse" });

    expect(notifySpy).not.toHaveBeenCalled();
  });

  it("sanitizes sensitive context before reporting", async () => {
    process.env.HONEYBADGER_REPORT_DATA = "1";
    const notifyAsyncSpy = vi.spyOn(Honeybadger, "notifyAsync").mockResolvedValue();
    let capturedSentryOptions:
      | {
          tags: Record<string, string>;
          contexts: { telemetry: Record<string, unknown> };
        }
      | undefined;
    const sentryCaptureSpy = vi.fn((...args: [unknown, unknown?]) => {
      const options = args[1];
      capturedSentryOptions = options as {
        tags: Record<string, string>;
        contexts: { telemetry: Record<string, unknown> };
      };
      return "evt_1";
    });
    const sentryFlushSpy = vi.fn().mockResolvedValue(true);
    setSentryModuleForTest({
      init: vi.fn(),
      captureException: sentryCaptureSpy,
      flush: sentryFlushSpy,
    });

    initHoneybadger({ component: "ock-cli", surface: "ock-cli", runtime: "node" });
    await captureHoneybadgerError(new Error("boom"), {
      action: "license.activate",
      awaitDelivery: true,
      context: {
        licenseKey: "OCK-TEST-TEST-TEST",
        directory: "/work/ock-omo-system/opencodekit-template",
      },
    });

    const notice = notifyAsyncSpy.mock.calls[0]?.[1] as {
      context: Record<string, unknown>;
    };
    expect(sentryCaptureSpy).toHaveBeenCalled();
    expect(capturedSentryOptions).toBeDefined();
    const sentryContext = capturedSentryOptions as {
      tags: Record<string, string>;
      contexts: { telemetry: Record<string, unknown> };
    };
    expect(notice.context.licenseKey).toBe("[REDACTED]");
    expect(notice.context.directory).toBe("opencodekit-template");
    expect(sentryContext.tags.repo).toBe("opencodekit-template");
    expect(sentryContext.tags.action).toBe("license.activate");
    expect(sentryContext.contexts.telemetry.licenseKey).toBe("[REDACTED]");
    expect(sentryContext.contexts.telemetry.directory).toBe("opencodekit-template");
    expect(sentryFlushSpy).toHaveBeenCalled();
  });

  it("swallows notifier failures to preserve app errors", async () => {
    process.env.HONEYBADGER_REPORT_DATA = "1";
    vi.spyOn(Honeybadger, "notifyAsync").mockRejectedValue(new Error("notify failed"));
    setSentryModuleForTest({
      init: vi.fn(),
      captureException: vi.fn(() => "evt_1"),
      flush: vi.fn().mockRejectedValue(new Error("flush failed")),
    });

    initHoneybadger({ component: "ock-cli", surface: "ock-cli", runtime: "node" });
    await expect(
      captureHoneybadgerError(new Error("boom"), {
        action: "license.activate",
        awaitDelivery: true,
      }),
    ).resolves.toBeUndefined();
  });

  it("marks reported errors for duplicate suppression", () => {
    const error = markHoneybadgerReportedError(new Error("boom"));
    expect(hasHoneybadgerReportedError(error)).toBe(true);
  });
});
