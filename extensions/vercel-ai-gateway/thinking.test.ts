import { describe, expect, it } from "vitest";
import { registerSingleProviderPlugin, requireRegisteredProvider } from "../../src/test-utils/plugin-registration.js";
import plugin from "./index.js";

describe("vercel ai gateway thinking profile", () => {
  function getProvider() {
    return registerSingleProviderPlugin(plugin);
  }

  it("exposes xhigh for trusted OpenAI upstream refs", () => {
    const provider = getProvider();

    expect(
      provider.supportsXHighThinking?.({
        provider: "vercel-ai-gateway",
        modelId: "openai/gpt-5.4",
      } as never),
    ).toBe(true);
  });

  it("exposes Codex xhigh through the OpenAI upstream prefix", () => {
    const provider = getProvider();

    expect(
      provider.supportsXHighThinking?.({
        provider: "vercel-ai-gateway",
        modelId: "openai/gpt-5.3-codex-spark",
      } as never),
    ).toBe(true);
  });

  it("reuses adaptive default thinking for trusted Anthropic upstream refs", () => {
    const provider = getProvider();

    expect(
      provider.resolveDefaultThinkingLevel?.({
        provider: "vercel-ai-gateway",
        modelId: "anthropic/claude-opus-4.6",
      } as never),
    ).toBe("adaptive");
  });

  it("falls through for unsupported OpenAI or untrusted namespaced refs", () => {
    const provider = getProvider();

    expect(
      provider.supportsXHighThinking?.({
        provider: "vercel-ai-gateway",
        modelId: "openai/gpt-4.1",
      } as never),
    ).toBeUndefined();
    expect(
      provider.resolveDefaultThinkingLevel?.({
        provider: "vercel-ai-gateway",
        modelId: "acme/gpt-5.4",
      } as never),
    ).toBeUndefined();
  });
});
