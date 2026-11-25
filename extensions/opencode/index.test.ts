import { describe, expect, it } from "vitest";
import {
  createCapturedPluginRegistration,
  registerSingleProviderPlugin,
} from "../../test/helpers/extensions/plugin-registration.js";
import plugin from "./index.js";

describe("opencode provider plugin", () => {
  it("registers image media understanding through the OpenCode plugin", () => {
    const captured = createCapturedPluginRegistration();
    plugin.register(captured.api);

    const mediaProvider = captured.mediaUnderstandingProviders.find(
      (provider) => provider.id === "opencode",
    );
    if (!mediaProvider) {
      throw new Error("Expected opencode media provider");
    }
    expect(mediaProvider.capabilities).toEqual(["image"]);
    expect(mediaProvider.defaultModels).toEqual({ image: "gpt-5-nano" });
    expect(typeof mediaProvider.describeImage).toBe("function");
    expect(typeof mediaProvider.describeImages).toBe("function");
  });

  it("exposes Claude thinking defaults and xhigh support for proxied Claude models", () => {
    const provider = registerSingleProviderPlugin(plugin);
    expect(
      provider.resolveDefaultThinkingLevel?.({
        provider: "opencode",
        modelId: "claude-opus-4-7",
      } as never),
    ).toBe("off");
    expect(
      provider.supportsXHighThinking?.({
        provider: "opencode",
        modelId: "claude-opus-4-7",
      } as never),
    ).toBe(true);
    expect(
      provider.resolveDefaultThinkingLevel?.({
        provider: "opencode",
        modelId: "claude-opus-4.6",
      } as never),
    ).toBe("adaptive");
    expect(
      provider.supportsXHighThinking?.({
        provider: "opencode",
        modelId: "claude-opus-4.6",
      } as never),
    ).toBeUndefined();
  });
});
