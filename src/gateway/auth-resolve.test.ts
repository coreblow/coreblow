import { describe, expect, it } from "vitest";
import { resolveEffectiveSharedGatewayAuth, resolveGatewayAuth } from "./auth-resolve.js";

describe("resolveGatewayAuth", () => {
  it("resolves token mode from configured token", () => {
    expect(
      resolveGatewayAuth({
        authConfig: { token: "config-token" },
        env: { COREBLOW_GATEWAY_TOKEN: "env-token" },
      }),
    ).toMatchObject({
      mode: "token",
      modeSource: "token",
      token: "config-token",
      allowTailscale: false,
    });
  });

  it("lets auth override mode and credentials win", () => {
    expect(
      resolveGatewayAuth({
        authConfig: { mode: "token", token: "config-token" },
        authOverride: { mode: "password", password: "override-password" },
        env: {},
      }),
    ).toMatchObject({
      mode: "password",
      modeSource: "override",
      password: "override-password",
    });
  });
});

describe("resolveEffectiveSharedGatewayAuth", () => {
  it("returns token shared auth when token mode is active", () => {
    expect(
      resolveEffectiveSharedGatewayAuth({
        authConfig: { token: "config-token" },
        env: {},
      }),
    ).toEqual({
      mode: "token",
      secret: "config-token",
    });
  });

  it("returns null for tokenless trusted-proxy auth", () => {
    expect(
      resolveEffectiveSharedGatewayAuth({
        authConfig: {
          mode: "trusted-proxy",
          trustedProxy: { userHeader: "x-user" },
        },
        env: {},
      }),
    ).toBeNull();
  });
});
