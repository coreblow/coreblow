import { describe, expect, it } from "vitest";
import { resolveAuthProfileOrder } from "./auth-profiles.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";

describe("resolveAuthProfileOrder — does not prioritize lastGood round-robin ordering", () => {
  const baseProfiles: AuthProfileStore["profiles"] = {
    "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-default" },
    "anthropic:work": { type: "api_key", provider: "anthropic", key: "sk-work" },
  };

  it("does not prioritize lastGood over round-robin ordering", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          order: { anthropic: ["anthropic:default", "anthropic:work"] },
          profiles: {
            "anthropic:default": { provider: "anthropic", mode: "api_key" },
            "anthropic:work": { provider: "anthropic", mode: "api_key" },
          },
        },
      },
      store: {
        version: 1,
        profiles: baseProfiles,
        lastGood: { anthropic: "anthropic:work" },
        usageStats: {
          "anthropic:default": { lastUsed: 100 },
          "anthropic:work": { lastUsed: 200 },
        },
      } as AuthProfileStore,
      provider: "anthropic",
    });

    // Explicit order should take precedence — not lastGood
    expect(order[0]).toBe("anthropic:default");
  });

  it("uses explicit profiles when order is missing", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          profiles: {
            "anthropic:default": { provider: "anthropic", mode: "api_key" },
            "anthropic:work": { provider: "anthropic", mode: "api_key" },
          },
        },
      },
      store: {
        version: 1,
        profiles: baseProfiles,
      },
      provider: "anthropic",
    });

    expect(order).toContain("anthropic:default");
    expect(order).toContain("anthropic:work");
  });

  it("uses configured order when provided", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          order: { anthropic: ["anthropic:work", "anthropic:default"] },
          profiles: {
            "anthropic:default": { provider: "anthropic", mode: "api_key" },
            "anthropic:work": { provider: "anthropic", mode: "api_key" },
          },
        },
      },
      store: {
        version: 1,
        profiles: baseProfiles,
      },
      provider: "anthropic",
    });

    expect(order).toEqual(["anthropic:work", "anthropic:default"]);
  });

  it("prefers store order over config order", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          order: { anthropic: ["anthropic:default", "anthropic:work"] },
          profiles: {
            "anthropic:default": { provider: "anthropic", mode: "api_key" },
            "anthropic:work": { provider: "anthropic", mode: "api_key" },
          },
        },
      },
      store: {
        version: 1,
        profiles: baseProfiles,
        order: { anthropic: ["anthropic:work", "anthropic:default"] },
      } as AuthProfileStore,
      provider: "anthropic",
    });

    expect(order).toEqual(["anthropic:work", "anthropic:default"]);
  });

  it.each(["store", "config"] as const)(
    "pushes cooldown profiles to the end even with %s order",
    (orderSource) => {
      const now = Date.now();
      const configuredOrder = { anthropic: ["anthropic:default", "anthropic:work"] };

      const order = resolveAuthProfileOrder({
        cfg:
          orderSource === "config"
            ? {
                auth: {
                  order: configuredOrder,
                  profiles: {
                    "anthropic:default": { provider: "anthropic", mode: "api_key" },
                    "anthropic:work": { provider: "anthropic", mode: "api_key" },
                  },
                },
              }
            : undefined,
        store: {
          version: 1,
          profiles: baseProfiles,
          ...(orderSource === "store" ? { order: configuredOrder } : {}),
          usageStats: {
            "anthropic:default": { cooldownUntil: now + 60_000 },
            "anthropic:work": { lastUsed: 1 },
          },
        } as AuthProfileStore,
        provider: "anthropic",
      });

      expect(order).toEqual(["anthropic:work", "anthropic:default"]);
    },
  );
});
