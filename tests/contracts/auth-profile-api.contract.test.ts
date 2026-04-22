/**
 * tests/contracts/auth-profile-api.contract.test.ts
 *
 * Contract test: verifikasi bahwa auth-profiles public API
 * tidak berubah secara breaking.
 *
 * Import langsung dari sub-modules untuk menghindari barrel file
 * yang menarik extension import chain (matrix, telegram, google).
 */
import { describe, expect, it } from "vitest";

// ── Constants contract ──────────────────────────────────────────────────────

describe("auth-profiles/constants — contract", () => {
  it("exports CLAUDE_CLI_PROFILE_ID and CODEX_CLI_PROFILE_ID as strings", async () => {
    const mod = await import("../../src/agents/auth-profiles/constants.js");
    expect(typeof mod.CLAUDE_CLI_PROFILE_ID).toBe("string");
    expect(mod.CLAUDE_CLI_PROFILE_ID.length).toBeGreaterThan(0);
    expect(typeof mod.CODEX_CLI_PROFILE_ID).toBe("string");
  });

  it("AUTH_STORE_VERSION is a positive integer", async () => {
    const mod = await import("../../src/agents/auth-profiles/constants.js");
    const ver = (mod as Record<string, unknown>).AUTH_STORE_VERSION;
    expect(typeof ver).toBe("number");
    expect(ver as number).toBeGreaterThan(0);
  });
});

// ── Order contract ──────────────────────────────────────────────────────────

describe("auth-profiles/order — contract", () => {
  it("resolveAuthProfileOrder is exported as function", async () => {
    const mod = await import("../../src/agents/auth-profiles/order.js");
    expect(typeof (mod as Record<string, unknown>).resolveAuthProfileOrder).toBe("function");
  });

  it("resolveAuthProfileOrder returns array for empty store", async () => {
    const { resolveAuthProfileOrder } = await import("../../src/agents/auth-profiles/order.js");
    const result = resolveAuthProfileOrder({
      store: { version: 1, profiles: {} },
      provider: "openai",
    });
    expect(Array.isArray(result)).toBe(true);
  });
});

// ── Profiles contract ───────────────────────────────────────────────────────

describe("auth-profiles/profiles — contract", () => {
  it("exports all required profile management functions", async () => {
    const mod = await import("../../src/agents/auth-profiles/profiles.js");
    const required = [
      "markAuthProfileGood",
      "upsertAuthProfile",
      "dedupeProfileIds",
      "listProfilesForProvider",
      "setAuthProfileOrder",
    ];
    for (const fn of required) {
      expect(
        typeof (mod as Record<string, unknown>)[fn],
        `${fn} must be exported as function`,
      ).toBe("function");
    }
  });
});

// ── Usage / cooldown contract ───────────────────────────────────────────────

describe("auth-profiles/usage — contract", () => {
  it("markAuthProfileFailure is exported as function", async () => {
    const mod = await import("../../src/agents/auth-profiles/usage.js");
    expect(typeof (mod as Record<string, unknown>).markAuthProfileFailure).toBe("function");
  });

  it("calculateAuthProfileCooldownMs returns positive bounded values", async () => {
    const { calculateAuthProfileCooldownMs } = await import(
      "../../src/agents/auth-profiles/usage.js"
    );
    for (const count of [1, 2, 3, 5, 10]) {
      const ms = calculateAuthProfileCooldownMs(count);
      expect(ms, `errorCount=${count} must have positive cooldown`).toBeGreaterThan(0);
    }
    // Contract: capped at max 5 minutes
    expect(calculateAuthProfileCooldownMs(100)).toBeLessThanOrEqual(5 * 60_000);
  });
});

// ── Store contract ──────────────────────────────────────────────────────────

describe("auth-profiles/store — contract", () => {
  it("ensureAuthProfileStore returns object with profiles and version", async () => {
    const { ensureAuthProfileStore } = await import(
      "../../src/agents/auth-profiles/store.js"
    );
    const tmpDir = "/tmp/coreblow-contract-test-" + Date.now();
    const store = ensureAuthProfileStore(tmpDir);
    expect(store).toHaveProperty("profiles");
    expect(typeof store.profiles).toBe("object");
    expect(store).toHaveProperty("version");
    expect(typeof store.version).toBe("number");
  });

  it("loadAuthProfileStoreForRuntime is exported", async () => {
    const mod = await import("../../src/agents/auth-profiles/store.js");
    expect(
      typeof (mod as Record<string, unknown>).loadAuthProfileStoreForRuntime,
    ).toBe("function");
  });
});
