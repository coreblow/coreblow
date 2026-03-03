import { describe, expect, it } from "vitest";
import { resolveAuthProfileOrder } from "./auth-profiles.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";

function makeStoreWithProfiles(): AuthProfileStore {
  return {
    version: 1,
    profiles: {
      "anthropic:default": {
        type: "api_key",
        provider: "anthropic",
        key: "sk-default",
      },
      "anthropic:secondary": {
        type: "api_key",
        provider: "anthropic",
        key: "sk-secondary",
      },
    },
  };
}

function isProfileInCooldown(store: AuthProfileStore, profileId: string): boolean {
  const now = Date.now();
  const cooldownUntil = store.usageStats?.[profileId]?.cooldownUntil;
  return typeof cooldownUntil === "number" && cooldownUntil > now;
}

describe("resolveAuthProfileOrder cooldown auto-expiry", () => {
  it("treats profile with expired cooldown as available", () => {
    const store = makeStoreWithProfiles();
    store.usageStats = {
      "anthropic:default": {
        cooldownUntil: Date.now() - 1_000, // expired 1 second ago
        errorCount: 3,
      },
    };

    const order = resolveAuthProfileOrder({ store, provider: "anthropic" });

    expect(order).toContain("anthropic:default");
    expect(isProfileInCooldown(store, "anthropic:default")).toBe(false);

    // Expired cooldown cleared
    expect(store.usageStats?.["anthropic:default"]?.cooldownUntil).toBeUndefined();
    expect(store.usageStats?.["anthropic:default"]?.errorCount).toBe(0);
  });

  it("keeps profile with active cooldown in cooldown list", () => {
    const futureMs = Date.now() + 300_000;
    const store = makeStoreWithProfiles();
    store.usageStats = {
      "anthropic:default": {
        cooldownUntil: futureMs,
        errorCount: 3,
      },
    };

    const order = resolveAuthProfileOrder({ store, provider: "anthropic" });

    expect(order).toContain("anthropic:default");
    expect(isProfileInCooldown(store, "anthropic:default")).toBe(true);
    expect(store.usageStats?.["anthropic:default"]?.errorCount).toBe(3);
  });

  it("expired cooldown resets error count — prevents escalation on next failure", () => {
    const store = makeStoreWithProfiles();
    store.usageStats = {
      "anthropic:default": {
        cooldownUntil: Date.now() - 1_000,
        errorCount: 4,
        failureCounts: { rate_limit: 4 },
        lastFailureAt: Date.now() - 3_700_000,
      },
    };

    resolveAuthProfileOrder({ store, provider: "anthropic" });

    expect(store.usageStats?.["anthropic:default"]?.errorCount).toBe(0);
    expect(store.usageStats?.["anthropic:default"]?.failureCounts).toBeUndefined();
  });

  it("mixed active and expired cooldowns across profiles", () => {
    const store = makeStoreWithProfiles();
    store.usageStats = {
      "anthropic:default": {
        cooldownUntil: Date.now() - 1_000, // expired
        errorCount: 3,
      },
      "anthropic:secondary": {
        cooldownUntil: Date.now() + 300_000, // still active
        errorCount: 2,
      },
    };

    const order = resolveAuthProfileOrder({ store, provider: "anthropic" });

    // anthropic:default should be available (expired, cleared)
    expect(store.usageStats?.["anthropic:default"]?.cooldownUntil).toBeUndefined();
    expect(store.usageStats?.["anthropic:default"]?.errorCount).toBe(0);

    // anthropic:secondary should still be in cooldown
    expect(store.usageStats?.["anthropic:secondary"]?.cooldownUntil).toBeGreaterThan(Date.now());
    expect(store.usageStats?.["anthropic:secondary"]?.errorCount).toBe(2);

    // Available profile should come first
    expect(order[0]).toBe("anthropic:default");
  });
});
