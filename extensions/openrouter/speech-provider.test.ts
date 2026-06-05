import { describe, expect, it } from "vitest";
import { buildOpenRouterSpeechHeaders, buildOpenRouterSpeechProvider } from "./speech-provider.js";

describe("openrouter speech provider", () => {
  it("advertises OpenRouter TTS models and voices", () => {
    const provider = buildOpenRouterSpeechProvider();

    expect(provider.id).toBe("openrouter");
    expect(provider.models).toContain("hexgrad/kokoro-82m");
    expect(provider.voices).toContain("af_alloy");
    expect(provider.isConfigured({ providerConfig: { apiKey: "sk-or-test" }, timeoutMs: 1 })).toBe(
      true,
    );
  });

  it("uses CoreBlow OpenRouter attribution headers", () => {
    const headers = buildOpenRouterSpeechHeaders("sk-or-test");

    expect(headers.get("Authorization")).toBe("Bearer sk-or-test");
    expect(headers.get("HTTP-Referer")).toBe("https://coreblow.com");
    expect(headers.get("X-OpenRouter-Title")).toBe("CoreBlow");
  });
});
