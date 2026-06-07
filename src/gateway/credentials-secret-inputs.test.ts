import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveGatewayCredentialsWithSecretInputs } from "./credentials-secret-inputs.js";

describe("resolveGatewayCredentialsWithSecretInputs", () => {
  it("returns trimmed explicit auth without resolving configured secrets", async () => {
    await expect(
      resolveGatewayCredentialsWithSecretInputs({
        config: {
          gateway: {
            auth: {
              token: { source: "env", provider: "default", id: "MISSING_GATEWAY_TOKEN" },
            },
          },
          secrets: { providers: { default: { source: "env" } } },
        } as CoreBlowConfig,
        explicitAuth: { token: " explicit-token " },
        env: {},
      }),
    ).resolves.toEqual({
      token: "explicit-token",
      password: undefined,
    });
  });

  it("resolves local gateway auth token SecretRef before credential selection", async () => {
    await expect(
      resolveGatewayCredentialsWithSecretInputs({
        config: {
          gateway: {
            auth: {
              mode: "token",
              token: { source: "env", provider: "default", id: "CUSTOM_GATEWAY_TOKEN" },
            },
          },
          secrets: { providers: { default: { source: "env" } } },
        } as CoreBlowConfig,
        env: { CUSTOM_GATEWAY_TOKEN: "resolved-token" },
      }),
    ).resolves.toEqual({
      token: "resolved-token",
      password: undefined,
    });
  });

  it("resolves remote gateway token SecretRef in remote mode", async () => {
    await expect(
      resolveGatewayCredentialsWithSecretInputs({
        config: {
          gateway: {
            mode: "remote",
            remote: {
              url: "wss://remote.example/ws",
              token: { source: "env", provider: "default", id: "REMOTE_GATEWAY_TOKEN" },
            },
          },
          secrets: { providers: { default: { source: "env" } } },
        } as CoreBlowConfig,
        env: { REMOTE_GATEWAY_TOKEN: "remote-token" },
      }),
    ).resolves.toEqual({
      token: "remote-token",
      password: undefined,
    });
  });

  it("keeps scanning fallback refs when a preferred remote token ref is unresolved", async () => {
    await expect(
      resolveGatewayCredentialsWithSecretInputs({
        config: {
          gateway: {
            mode: "remote",
            auth: {
              token: { source: "env", provider: "default", id: "LOCAL_GATEWAY_TOKEN" },
            },
            remote: {
              url: "wss://remote.example/ws",
              token: { source: "env", provider: "default", id: "MISSING_REMOTE_TOKEN" },
            },
          },
          secrets: { providers: { default: { source: "env" } } },
        } as CoreBlowConfig,
        env: { LOCAL_GATEWAY_TOKEN: "local-token" },
      }),
    ).resolves.toEqual({
      token: "local-token",
      password: undefined,
    });
  });
});
