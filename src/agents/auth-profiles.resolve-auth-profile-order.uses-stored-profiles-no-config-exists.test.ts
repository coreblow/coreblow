import { describe, expect, it } from "vitest";
import { resolveAuthProfileOrder } from "./auth-profiles.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";

function makeStoreWithProfile(provider: string, profileId: string): AuthProfileStore {
  return {
    version: 1,
    profiles: {
      [profileId]: { type: "api_key", provider, key: "sk-test" },
    },
  };
}

describe("resolveAuthProfileOrder — uses stored profiles when no config exists", () => {
  it("returns profiles from store when cfg is undefined", () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-default" },
          "anthropic:work": { type: "api_key", provider: "anthropic", key: "sk-work" },
        },
      },
      provider: "anthropic",
    });

    expect(order).toContain("anthropic:default");
    expect(order).toContain("anthropic:work");
  });

  it("returns profiles from store when cfg.auth is empty", () => {
    const order = resolveAuthProfileOrder({
      cfg: {},
      store: {
        version: 1,
        profiles: {
          "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-default" },
        },
      },
      provider: "anthropic",
    });

    expect(order).toContain("anthropic:default");
  });

  it("filters out profiles from other providers", () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-ant" },
          "openai:default": { type: "api_key", provider: "openai", key: "sk-oai" },
          "google:default": { type: "api_key", provider: "google", key: "sk-goo" },
        },
      },
      provider: "anthropic",
    });

    expect(order).toEqual(["anthropic:default"]);
  });

  it("returns empty when store has no profiles for provider", () => {
    const store = makeStoreWithProfile("openai", "openai:default");
    const order = resolveAuthProfileOrder({ store, provider: "anthropic" });
    expect(order).toEqual([]);
  });

  it("respects stored order list when present", () => {
    const order = resolveAuthProfileOrder({
      store: {
        version: 1,
        profiles: {
          "anthropic:a": { type: "api_key", provider: "anthropic", key: "sk-a" },
          "anthropic:b": { type: "api_key", provider: "anthropic", key: "sk-b" },
        },
        order: { anthropic: ["anthropic:b", "anthropic:a"] },
      },
      provider: "anthropic",
    });

    expect(order).toEqual(["anthropic:b", "anthropic:a"]);
  });
});
