import { describe, expect, it } from "vitest";
import { resolveAuthProfileOrder } from "./auth-profiles.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";

describe("resolveAuthProfileOrder", () => {
  it("returns all profiles for provider when no explicit order exists", () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:a": {
            type: "oauth",
            provider: "anthropic",
            access: "access-token",
            refresh: "refresh-token",
            expires: Date.now() + 60_000,
          },
          "anthropic:b": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-b",
          },
          "anthropic:c": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-c",
          },
        },
        usageStats: {
          "anthropic:a": { lastUsed: 300 },
          "anthropic:b": { lastUsed: 100 },
          "anthropic:c": { lastUsed: 200 },
        },
      },
      provider: "anthropic",
    });

    // All profiles included, non-cooldown profiles should be in result
    expect(order).toContain("anthropic:a");
    expect(order).toContain("anthropic:b");
    expect(order).toContain("anthropic:c");
    expect(order).toHaveLength(3);
  });

  it("includes all valid profiles regardless of lastUsed presence", () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:a": { type: "api_key", provider: "anthropic", key: "sk-a" },
          "anthropic:b": { type: "api_key", provider: "anthropic", key: "sk-b" },
          "anthropic:c": { type: "api_key", provider: "anthropic", key: "sk-c" },
        },
        usageStats: {
          "anthropic:a": { lastUsed: 100 },
        },
      },
      provider: "anthropic",
    });

    // All profiles included regardless of lastUsed presence
    expect(order).toContain("anthropic:a");
    expect(order).toContain("anthropic:b");
    expect(order).toContain("anthropic:c");
    expect(order).toHaveLength(3);
  });

  it("ignores profiles from other providers", () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-a" },
          "openai:default": { type: "api_key", provider: "openai", key: "sk-o" },
        },
      },
      provider: "anthropic",
    });

    expect(order).toContain("anthropic:default");
    expect(order).not.toContain("openai:default");
  });

  it("returns empty array when no profiles exist for provider", () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "openai:default": { type: "api_key", provider: "openai", key: "sk-o" },
        },
      },
      provider: "anthropic",
    });

    expect(order).toEqual([]);
  });

  it("drops api_key profiles with empty key string", () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:empty": { type: "api_key", provider: "anthropic", key: "   " },
          "anthropic:valid": { type: "api_key", provider: "anthropic", key: "sk-valid" },
        },
      },
      provider: "anthropic",
    });

    expect(order).toContain("anthropic:valid");
    expect(order).not.toContain("anthropic:empty");
  });
});

describe("resolveAuthProfileOrder cooldown behaviour", () => {
  it("pushes profile in active cooldown to end of list", () => {
    const now = Date.now();
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-default" },
          "anthropic:work": { type: "api_key", provider: "anthropic", key: "sk-work" },
        },
        usageStats: {
          "anthropic:default": { cooldownUntil: now + 60_000 },
          "anthropic:work": { lastUsed: 1 },
        },
      } as AuthProfileStore,
      provider: "anthropic",
    });

    expect(order[order.length - 1]).toBe("anthropic:default");
    expect(order[0]).toBe("anthropic:work");
  });

  it("pushes profile with active disabledUntil to end", () => {
    const now = Date.now();
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-default" },
          "anthropic:work": { type: "api_key", provider: "anthropic", key: "sk-work" },
        },
        usageStats: {
          "anthropic:default": { disabledUntil: now + 60_000, disabledReason: "billing" },
          "anthropic:work": { lastUsed: 1 },
        },
      } as AuthProfileStore,
      provider: "anthropic",
    });

    expect(order[0]).toBe("anthropic:work");
    expect(order[order.length - 1]).toBe("anthropic:default");
  });
});
