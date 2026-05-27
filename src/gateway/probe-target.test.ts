import { describe, expect, it } from "vitest";
import { resolveGatewayProbeTarget } from "./probe-target.js";

describe("resolveGatewayProbeTarget", () => {
  it("uses local mode by default", () => {
    expect(resolveGatewayProbeTarget({})).toEqual({
      gatewayMode: "local",
      mode: "local",
      remoteUrlMissing: false,
    });
  });

  it("falls back to local probe mode when remote mode has no usable url", () => {
    expect(resolveGatewayProbeTarget({ gateway: { mode: "remote", remote: { url: "  " } } })).toEqual({
      gatewayMode: "remote",
      mode: "local",
      remoteUrlMissing: true,
    });
  });

  it("keeps remote probe mode when a remote url is configured", () => {
    expect(
      resolveGatewayProbeTarget({
        gateway: { mode: "remote", remote: { url: "wss://gateway.example" } },
      }),
    ).toEqual({
      gatewayMode: "remote",
      mode: "remote",
      remoteUrlMissing: false,
    });
  });
});
