import { beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../infra/i18n/index.js";
import { logGatewayStartup } from "./server-startup-log.js";

describe("gateway startup log", () => {
  beforeEach(async () => {
    await i18n.setLocale("en");
  });

  it("warns when dangerous config flags are enabled", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {
        gateway: {
          controlUi: {
            dangerouslyDisableDeviceAuth: true,
          },
        },
      },
      bindHost: "127.0.0.1",
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("dangerous config flags enabled"));
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("gateway.controlUi.dangerouslyDisableDeviceAuth=true"),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("coreblow security audit"));
  });

  it("does not warn when dangerous config flags are disabled", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {},
      bindHost: "127.0.0.1",
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    expect(warn).not.toHaveBeenCalled();
  });

  it("logs all listen endpoints on a single line", () => {
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {},
      bindHost: "127.0.0.1",
      bindHosts: ["127.0.0.1", "::1"],
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    const listenMessages = info.mock.calls
      .map((call) => call[0])
      .filter((message) => message.startsWith("Listening on "));
    expect(listenMessages).toEqual([
      `Listening on ws://127.0.0.1:18789, ws://[::1]:18789 (PID ${process.pid})`,
    ]);
  });

  it("localizes user-facing listen and log-file messages", async () => {
    await i18n.setLocale("id");
    const info = vi.fn();
    const warn = vi.fn();

    logGatewayStartup({
      cfg: {},
      bindHost: "127.0.0.1",
      port: 18789,
      log: { info, warn },
      isNixMode: false,
    });

    const messages = info.mock.calls.map((call) => call[0]);
    expect(messages).toContain(`Mendengarkan di ws://127.0.0.1:18789 (PID ${process.pid})`);
    expect(messages.some((message) => message.startsWith("File log: "))).toBe(true);
  });
});
