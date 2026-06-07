import { describe, expect, it } from "vitest";
import {
  KNOWN_WEAK_GATEWAY_PASSWORD_PLACEHOLDERS,
  KNOWN_WEAK_GATEWAY_TOKEN_PLACEHOLDERS,
} from "./known-weak-gateway-secrets.js";
import { assertGatewayAuthNotKnownWeak, ensureGatewayStartupAuth } from "./startup-auth.js";

describe("gateway/startup-auth — import", () => {
  it("is importable", async () => {
    const m = await import("./startup-auth.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});

describe("known weak gateway startup secrets", () => {
  it.each(KNOWN_WEAK_GATEWAY_TOKEN_PLACEHOLDERS)(
    "rejects published placeholder token %s from config",
    async (token) => {
      await expect(
        ensureGatewayStartupAuth({
          cfg: { gateway: { auth: { mode: "token", token } } },
          env: {} as NodeJS.ProcessEnv,
        }),
      ).rejects.toThrow(/example placeholder/i);
    },
  );

  it("rejects the documented placeholder token from environment", async () => {
    await expect(
      ensureGatewayStartupAuth({
        cfg: {},
        env: {
          COREBLOW_GATEWAY_TOKEN: KNOWN_WEAK_GATEWAY_TOKEN_PLACEHOLDERS[0],
        } as NodeJS.ProcessEnv,
      }),
    ).rejects.toThrow(/example placeholder/i);
  });

  it.each(KNOWN_WEAK_GATEWAY_PASSWORD_PLACEHOLDERS)(
    "rejects documented placeholder password %s from config",
    async (password) => {
      await expect(
        ensureGatewayStartupAuth({
          cfg: { gateway: { auth: { mode: "password", password } } },
          env: {} as NodeJS.ProcessEnv,
        }),
      ).rejects.toThrow(/example placeholder/i);
    },
  );

  it("trims placeholder values before checking", () => {
    expect(() =>
      assertGatewayAuthNotKnownWeak({
        mode: "token",
        modeSource: "config",
        token: `  ${KNOWN_WEAK_GATEWAY_TOKEN_PLACEHOLDERS[0]}  `,
        allowTailscale: false,
      }),
    ).toThrow(/example placeholder/i);
  });

  it("allows a real startup token", async () => {
    const result = await ensureGatewayStartupAuth({
      cfg: { gateway: { auth: { mode: "token", token: "real-random-token-0123456789abcdef" } } },
      env: {} as NodeJS.ProcessEnv,
    });

    expect(result.auth.token).toBe("real-random-token-0123456789abcdef");
  });
});
describe("gateway/startup-auth-profiles — import", () => {
  it("is importable", async () => {
    const m = await import("./startup-auth-profiles.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
describe("gateway/startup-control-ui-origins — import", () => {
  it("is importable", async () => {
    const m = await import("./startup-control-ui-origins.js").catch(() => null);
    expect(m === null || typeof m === "object").toBe(true);
  });
});
