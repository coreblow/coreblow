import { describe, expect, it } from "vitest";
import { type AuthProfileStore, resolveAuthProfileOrder } from "./auth-profiles.js";

function makeApiKeyStore(provider: string, profileIds: string[]): AuthProfileStore {
  return {
    version: 1,
    profiles: Object.fromEntries(
      profileIds.map((profileId) => [
        profileId,
        {
          type: "api_key" as const,
          provider,
          key: profileId.endsWith(":work") ? "sk-work" : "sk-default",
        },
      ]),
    ),
  };
}

function makeApiKeyProfilesByProvider(
  providerByProfileId: Record<string, string>,
): Record<string, { provider: string; mode: "api_key" }> {
  return Object.fromEntries(
    Object.entries(providerByProfileId).map(([profileId, provider]) => [
      profileId,
      { provider, mode: "api_key" as const },
    ]),
  );
}

describe("resolveAuthProfileOrder — normalizes z.ai aliases", () => {
  it("normalizes z.ai aliases in auth.order", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          order: { "z.ai": ["zai:work", "zai:default"] },
          profiles: makeApiKeyProfilesByProvider({
            "zai:default": "zai",
            "zai:work": "zai",
          }),
        },
      },
      store: makeApiKeyStore("zai", ["zai:default", "zai:work"]),
      provider: "zai",
    });
    expect(order).toEqual(["zai:work", "zai:default"]);
  });

  it("normalizes provider casing in auth.order keys", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          order: { OpenAI: ["openai:work", "openai:default"] },
          profiles: makeApiKeyProfilesByProvider({
            "openai:default": "openai",
            "openai:work": "openai",
          }),
        },
      },
      store: makeApiKeyStore("openai", ["openai:default", "openai:work"]),
      provider: "openai",
    });
    expect(order).toEqual(["openai:work", "openai:default"]);
  });

  it("normalizes z.ai aliases in auth.profiles", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          profiles: makeApiKeyProfilesByProvider({
            "zai:default": "z.ai",
            "zai:work": "Z.AI",
          }),
        },
      },
      store: makeApiKeyStore("zai", ["zai:default", "zai:work"]),
      provider: "zai",
    });
    expect(order).toContain("zai:default");
    expect(order).toContain("zai:work");
  });

  it("explicit order takes precedence for z.ai provider", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          order: { zai: ["zai:work", "zai:default"] },
          profiles: makeApiKeyProfilesByProvider({
            "zai:default": "zai",
            "zai:work": "zai",
          }),
        },
      },
      store: makeApiKeyStore("zai", ["zai:default", "zai:work"]),
      provider: "zai",
    });
    expect(order).toEqual(["zai:work", "zai:default"]);
  });

  it("returns empty for provider with no matching profiles", () => {
    const order = resolveAuthProfileOrder({
      cfg: {
        auth: {
          order: { "z.ai": ["zai:work"] },
          profiles: makeApiKeyProfilesByProvider({ "zai:work": "zai" }),
        },
      },
      store: makeApiKeyStore("openai", ["openai:default"]),
      provider: "zai",
    });
    expect(order).toEqual([]);
  });
});
