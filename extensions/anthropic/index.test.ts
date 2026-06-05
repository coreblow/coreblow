import { describe, expect, it } from "vitest";
import { createCapturedPluginRegistration } from "../../src/plugins/captured-registration.js";
import plugin from "./index.js";
import { buildAnthropicReplayPolicy } from "./replay-policy.js";

describe("anthropic provider plugin", () => {
  it("registers Anthropic and Claude CLI provider surfaces", () => {
    const captured = createCapturedPluginRegistration();
    plugin.register(captured.api);

    expect(captured.cliBackends.map((backend) => backend.id)).toContain("claude-cli");
    expect(captured.providers.map((provider) => provider.id)).toEqual(["claude-cli", "anthropic"]);
    expect(captured.mediaUnderstandingProviders.map((provider) => provider.id)).toEqual([
      "anthropic",
    ]);
  });

  it("wires policy helpers into the Anthropic provider", () => {
    const captured = createCapturedPluginRegistration();
    plugin.register(captured.api);
    const provider = captured.providers.find((entry) => entry.id === "anthropic");

    expect(
      provider?.normalizeConfig?.({
        provider: "anthropic",
        providerConfig: { models: [] },
      } as never)?.api,
    ).toBe("anthropic-messages");
    expect(
      provider?.supportsXHighThinking?.({
        provider: "anthropic",
        modelId: "claude-opus-4-6",
      }),
    ).toBe(true);
    expect(
      provider?.resolveDefaultThinkingLevel?.({
        provider: "anthropic",
        modelId: "claude-sonnet-4-6",
      } as never),
    ).toBe("adaptive");
    expect(provider?.wrapStreamFn).toBeTypeOf("function");
  });

  it("keeps Anthropic replay policy available as a public contract artifact", () => {
    expect(buildAnthropicReplayPolicy()).toEqual({
      sanitizeMode: "full",
      sanitizeToolCallIds: true,
      toolCallIdMode: "strict",
      preserveNativeAnthropicToolUseIds: true,
      preserveSignatures: true,
      repairToolUseResultPairing: true,
      validateAnthropicTurns: true,
      allowSyntheticToolResults: true,
    });
  });
});
