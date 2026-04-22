/**
 * tests/contracts/auth-profile-api.contract.test.ts
 *
 * Contract test: verifikasi bahwa auth-profiles public API
 * tidak berubah secara breaking — fungsi kritis harus selalu ada
 * dan return type-nya konsisten.
 */
import { describe, expect, it } from "vitest";

describe("auth-profiles — public API contract", () => {
  it("exports required functions without throwing", async () => {
    const mod = await import("../../src/agents/auth-profiles.js");
    const required = [
      "ensureAuthProfileStore",
      "loadAuthProfileStoreForRuntime",
      "markAuthProfileFailure",
      "markAuthProfileGood",
      "resolveAuthProfileOrder",
      "resolveApiKeyForProfile",
      "upsertAuthProfile",
      "clearRuntimeAuthProfileStoreSnapshots",
    ] as const;

    for (const fn of required) {
      expect(
        typeof (mod as Record<string, unknown>)[fn],
        `${fn} must be exported as a function`,
      ).toBe("function");
    }
  });

  it("exports required constants", async () => {
    const mod = await import("../../src/agents/auth-profiles.js");
    expect(typeof mod.CLAUDE_CLI_PROFILE_ID).toBe("string");
    expect(typeof mod.CODEX_CLI_PROFILE_ID).toBe("string");
  });

  it("resolveAuthProfileOrder returns array", async () => {
    const { resolveAuthProfileOrder } = await import("../../src/agents/auth-profiles/order.js");
    const result = resolveAuthProfileOrder({
      store: { version: 1, profiles: {} },
      provider: "openai",  // required param in CB
    });
    expect(Array.isArray(result)).toBe(true);
  });

  it("AUTH_STORE_VERSION is a positive integer", async () => {
    const mod = await import("../../src/agents/auth-profiles/constants.js");
    const ver = (mod as Record<string, unknown>).AUTH_STORE_VERSION;
    expect(typeof ver).toBe("number");
    expect(ver as number).toBeGreaterThan(0);
  });
});

describe("auth-profiles — failure reason contract", () => {
  it("calculateAuthProfileCooldownMs returns positive bounded values", async () => {
    const { calculateAuthProfileCooldownMs } = await import(
      "../../src/agents/auth-profiles/usage.js"
    );

    // Contract: cooldown must be positive for any error count
    for (const count of [1, 2, 3, 5, 10]) {
      const ms = calculateAuthProfileCooldownMs(count);
      expect(ms, `errorCount=${count} must have positive cooldown`).toBeGreaterThan(0);
    }

    // Contract: cooldown must be capped (max 5 minutes)
    const MAX_COOLDOWN_MS = 5 * 60_000;
    expect(calculateAuthProfileCooldownMs(100)).toBeLessThanOrEqual(MAX_COOLDOWN_MS);
  });
});
