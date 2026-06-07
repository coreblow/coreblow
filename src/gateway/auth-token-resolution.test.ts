import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveGatewayAuthToken } from "./auth-token-resolution.js";

describe("resolveGatewayAuthToken", () => {
  it("prefers an explicit token over config and env tokens", async () => {
    await expect(
      resolveGatewayAuthToken({
        cfg: { gateway: { auth: { token: "config-token" } } } as CoreBlowConfig,
        env: { COREBLOW_GATEWAY_TOKEN: "env-token" },
        explicitToken: " explicit-token ",
      }),
    ).resolves.toEqual({
      token: "explicit-token",
      source: "explicit",
      secretRefConfigured: false,
    });
  });

  it("returns plaintext gateway.auth.token before COREBLOW_GATEWAY_TOKEN", async () => {
    await expect(
      resolveGatewayAuthToken({
        cfg: { gateway: { auth: { token: "config-token" } } } as CoreBlowConfig,
        env: { COREBLOW_GATEWAY_TOKEN: "env-token" },
      }),
    ).resolves.toEqual({
      token: "config-token",
      source: "config",
      secretRefConfigured: false,
    });
  });

  it("resolves SecretRef-backed gateway.auth.token", async () => {
    await expect(
      resolveGatewayAuthToken({
        cfg: {
          gateway: {
            auth: {
              token: {
                source: "env",
                provider: "default",
                id: "CUSTOM_GATEWAY_TOKEN",
              },
            },
          },
          secrets: {
            providers: {
              default: { source: "env" },
            },
          },
        } as CoreBlowConfig,
        env: {
          CUSTOM_GATEWAY_TOKEN: "resolved-token",
          COREBLOW_GATEWAY_TOKEN: "env-token",
        },
      }),
    ).resolves.toEqual({
      token: "resolved-token",
      source: "secretRef",
      secretRefConfigured: true,
    });
  });

  it("falls back to COREBLOW_GATEWAY_TOKEN when SecretRef is unresolved", async () => {
    await expect(
      resolveGatewayAuthToken({
        cfg: {
          gateway: {
            auth: {
              token: {
                source: "env",
                provider: "default",
                id: "MISSING_GATEWAY_TOKEN",
              },
            },
          },
          secrets: {
            providers: {
              default: { source: "env" },
            },
          },
        } as CoreBlowConfig,
        env: {
          COREBLOW_GATEWAY_TOKEN: "env-fallback-token",
        },
      }),
    ).resolves.toEqual({
      token: "env-fallback-token",
      source: "env",
      secretRefConfigured: true,
    });
  });

  it("does not use COREBLOW_GATEWAY_TOKEN when env fallback is disabled", async () => {
    const resolved = await resolveGatewayAuthToken({
      cfg: {
        gateway: {
          auth: {
            token: {
              source: "env",
              provider: "default",
              id: "MISSING_GATEWAY_TOKEN",
            },
          },
        },
        secrets: {
          providers: {
            default: { source: "env" },
          },
        },
      } as CoreBlowConfig,
      env: {
        COREBLOW_GATEWAY_TOKEN: "env-fallback-token",
      },
      envFallback: "no-secret-ref",
      unresolvedReasonStyle: "detailed",
    });

    expect(resolved.token).toBeUndefined();
    expect(resolved.source).toBeUndefined();
    expect(resolved.secretRefConfigured).toBe(true);
    expect(resolved.unresolvedRefReason).toBe(
      "gateway.auth.token SecretRef is unresolved (env:default:MISSING_GATEWAY_TOKEN).",
    );
  });
});
