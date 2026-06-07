import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveGatewayAuthTokenSourceConflict } from "./auth-token-source-conflict.js";

describe("resolveGatewayAuthTokenSourceConflict", () => {
  it("warns when COREBLOW_GATEWAY_TOKEN shadows a different configured token source", () => {
    const conflict = resolveGatewayAuthTokenSourceConflict({
      cfg: {
        gateway: { auth: { token: "config-token" } },
      } as CoreBlowConfig,
      env: {
        COREBLOW_GATEWAY_TOKEN: "env-token",
      },
    });

    expect(conflict?.checkId).toBe("gateway.env_token_overrides_config");
    expect(conflict?.diagnostic).toContain("COREBLOW_GATEWAY_TOKEN conflicts");
  });

  it("does not warn inside the managed gateway service credential context", () => {
    expect(
      resolveGatewayAuthTokenSourceConflict({
        cfg: {
          gateway: { auth: { token: "config-token" } },
        } as CoreBlowConfig,
        env: {
          COREBLOW_GATEWAY_TOKEN: "env-token",
          COREBLOW_SERVICE_KIND: "gateway",
        },
      }),
    ).toBeNull();
  });

  it("does not warn when gateway.auth.token resolves from COREBLOW_GATEWAY_TOKEN", () => {
    expect(
      resolveGatewayAuthTokenSourceConflict({
        cfg: {
          gateway: { auth: { token: "${COREBLOW_GATEWAY_TOKEN}" } },
          secrets: { providers: { default: { source: "env" } } },
        } as CoreBlowConfig,
        env: {
          COREBLOW_GATEWAY_TOKEN: "env-token",
        },
      }),
    ).toBeNull();
  });

  it("does not warn about local gateway auth token precedence in remote mode", () => {
    expect(
      resolveGatewayAuthTokenSourceConflict({
        cfg: {
          gateway: {
            mode: "remote",
            remote: { token: "remote-token" },
            auth: { token: "local-token" },
          },
        } as CoreBlowConfig,
        env: {
          COREBLOW_GATEWAY_TOKEN: "env-token",
        },
      }),
    ).toBeNull();
  });
});
