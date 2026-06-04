import { describe, expect, it } from "vitest";
import { registerSingleProviderPlugin } from "../../src/test-utils/plugin-registration.js";
import plugin from "./index.js";

describe("kimi provider plugin", () => {
  it("normalizes legacy Kimi Code ids to the stable API model id", () => {
    const provider = registerSingleProviderPlugin(plugin);

    expect(
      provider.normalizeResolvedModel?.({
        provider: "kimi",
        modelId: "kimi-code",
        model: {
          id: "kimi-code",
          name: "Kimi Code",
          provider: "kimi",
          api: "anthropic-messages",
        },
      } as never),
    ).toEqual({
      id: "kimi-for-coding",
      name: "Kimi Code",
      provider: "kimi",
      api: "anthropic-messages",
    });
  });

  it("uses binary thinking with thinking off by default", () => {
    const provider = registerSingleProviderPlugin(plugin);

    expect(provider.isBinaryThinking?.({ provider: "kimi", modelId: "kimi-code" } as never)).toBe(
      true,
    );
    expect(
      provider.resolveDefaultThinkingLevel?.({
        provider: "kimi",
        modelId: "kimi-code",
        reasoning: true,
      } as never),
    ).toBe("off");
  });

  it("wires Kimi stream hooks", () => {
    const provider = registerSingleProviderPlugin(plugin);
    let capturedPayload: Record<string, unknown> | undefined;
    const wrapped = provider.wrapStreamFn?.({
      provider: "kimi",
      modelId: "kimi-code",
      thinkingLevel: "high",
      streamFn: (_model: unknown, _context: unknown, options: { onPayload?: Function }) => {
        const payload: Record<string, unknown> = {};
        options?.onPayload?.(payload, {} as never);
        capturedPayload = payload;
        return { result: async () => ({}), [Symbol.asyncIterator]: async function* () {} } as never;
      },
    } as never);

    wrapped?.(
      {
        api: "anthropic-messages",
        provider: "kimi",
        id: "kimi-code",
      } as never,
      { messages: [] } as never,
      {},
    );

    expect(capturedPayload).toEqual({
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 8192 },
    });
  });
});
