import { describe, expect, it } from "vitest";
import {
  formatGatewayCommandFailure,
  formatInvalidConfigPort,
  formatInvalidPortOption,
  formatLookupMiss,
  formatMissingPluginMessage,
  formatPortRangeHint,
  formatStrictJsonParseFailure,
  formatUnknownChannelMessage,
  formatUnsupportedChannelActionMessage,
} from "./error-format.js";

describe("error-format", () => {
  it("formats port range hints and invalid options", () => {
    expect(formatPortRangeHint(18789)).toBe(
      "Use a port number from 1 to 65535, for example 18789.",
    );
    expect(formatInvalidPortOption("--port", 18789)).toBe(
      "Invalid --port. Use a port number from 1 to 65535, for example 18789.",
    );
    expect(formatInvalidConfigPort("gateway.port", 18789)).toBe(
      "Invalid gateway.port in config. Set gateway.port to a number from 1 to 65535, or pass --port 18789.",
    );
  });

  it("formats unknown and unsupported channel messages", () => {
    expect(formatUnknownChannelMessage({ channel: "matrix" })).toContain(
      'Unknown channel "matrix". Run `coreblow channels list --all` to see configured and installable channels.',
    );
    expect(
      formatUnsupportedChannelActionMessage({ channel: "matrix", action: "pairing" }),
    ).toContain(
      'Channel "matrix" does not support pairing. Run `coreblow channels capabilities --channel matrix` to inspect supported actions.',
    );
  });

  it("formats strict json parse failure", () => {
    const message = formatStrictJsonParseFailure({
      value: "bad-json",
      cause: new Error("Unexpected token"),
    });
    expect(message).toContain('Could not parse "bad-json" as JSON for --strict-json');
    expect(message).toContain("Unexpected token");
  });

  it("formats gateway command failure and lookup misses", () => {
    expect(
      formatGatewayCommandFailure({
        action: "restart",
        error: new Error("connection refused"),
      }),
    ).toContain(
      "Could not restart because the Gateway did not respond: connection refused. Run `coreblow gateway status --deep` to inspect the active Gateway.",
    );

    expect(
      formatLookupMiss({
        noun: "Task",
        value: "task_123",
        listCommand: "coreblow tasks list",
      }),
    ).toBe("Task not found: task_123. Run `coreblow tasks list` to see recent tasks.");

    expect(
      formatMissingPluginMessage({
        id: "my-plugin",
        includeSearch: true,
      }),
    ).toContain("Plugin not found: my-plugin.");
  });
});
