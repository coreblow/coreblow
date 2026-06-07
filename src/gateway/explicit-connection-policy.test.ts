import { describe, expect, it } from "vitest";
import {
  canSkipGatewayConfigLoad,
  isGatewayConfigBypassCommandPath,
} from "./explicit-connection-policy.js";

describe("canSkipGatewayConfigLoad", () => {
  it("skips config only when URL and explicit credentials fully define the connection", () => {
    expect(
      canSkipGatewayConfigLoad({
        urlOverride: " wss://gateway.example/ws ",
        explicitAuth: { token: " token " },
      }),
    ).toBe(true);
    expect(
      canSkipGatewayConfigLoad({
        urlOverride: "wss://gateway.example/ws",
        explicitAuth: { password: " password " },
      }),
    ).toBe(true);
  });

  it("requires absent config, a nonblank URL, and nonblank explicit auth", () => {
    expect(
      canSkipGatewayConfigLoad({
        config: {},
        urlOverride: "wss://gateway.example/ws",
        explicitAuth: { token: "token" },
      }),
    ).toBe(false);
    expect(canSkipGatewayConfigLoad({ urlOverride: " ", explicitAuth: { token: "token" } })).toBe(
      false,
    );
    expect(
      canSkipGatewayConfigLoad({
        urlOverride: "wss://gateway.example/ws",
        explicitAuth: { token: " ", password: "" },
      }),
    ).toBe(false);
  });
});

describe("isGatewayConfigBypassCommandPath", () => {
  it("recognizes only cron command paths", () => {
    expect(isGatewayConfigBypassCommandPath(["cron", "list"])).toBe(true);
    expect(isGatewayConfigBypassCommandPath(["status"])).toBe(false);
  });
});
