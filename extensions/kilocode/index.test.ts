import { registerSingleProviderPlugin } from "../../test/helpers/extensions/plugin-registration.js";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";

type StreamOptions = {
  onPayload?: (payload: unknown, model: unknown) => void;
};

type StreamFn = (model: unknown, context: unknown, options?: StreamOptions) => unknown;

describe("kilocode provider plugin", () => {
  it("owns Gemini thought-signature replay sanitization for Gemini-backed models", () => {
    const provider = registerSingleProviderPlugin(plugin);

    expect(provider.capabilities?.geminiThoughtSignatureSanitization).toBe(true);
    expect(provider.capabilities?.geminiThoughtSignatureModelHints).toContain("gemini");
  });

  it("wires kilocode thinking stream hooks", () => {
    const provider = registerSingleProviderPlugin(plugin);
    let capturedPayload: Record<string, unknown> | undefined;
    const baseStreamFn: StreamFn = (model, _context, options) => {
      const payload = { config: { thinkingConfig: { thinkingBudget: -1 } } } as Record<
        string,
        unknown
      >;
      options?.onPayload?.(payload as never, model as never);
      capturedPayload = payload;
      return {} as never;
    };

    const wrappedReasoning = provider.wrapStreamFn?.({
      provider: "kilocode",
      modelId: "openai/gpt-5.4",
      thinkingLevel: "high",
      streamFn: baseStreamFn,
    } as never);

    void wrappedReasoning?.(
      {
        api: "openai-completions",
        provider: "kilocode",
        id: "openai/gpt-5.4",
      } as never,
      { messages: [] },
      {},
    );

    expect(capturedPayload).toEqual({
      config: { thinkingConfig: { thinkingBudget: -1 } },
      reasoning: { effort: "high" },
    });

    const wrappedAuto = provider.wrapStreamFn?.({
      provider: "kilocode",
      modelId: "kilo/auto",
      thinkingLevel: "high",
      streamFn: baseStreamFn,
    } as never);

    void wrappedAuto?.(
      {
        api: "openai-completions",
        provider: "kilocode",
        id: "kilo/auto",
      } as never,
      { messages: [] },
      {},
    );

    expect(capturedPayload).not.toHaveProperty("reasoning");
  });

  it("publishes configured Kilo models through plugin-owned catalog augmentation", () => {
    const provider = registerSingleProviderPlugin(plugin);

    expect(
      provider.augmentModelCatalog?.({
        config: {
          models: {
            providers: {
              kilocode: {
                models: [
                  {
                    id: "google/gemini-3-pro-preview",
                    name: "Gemini 3 Pro Preview",
                    input: ["text", "image"],
                    reasoning: true,
                    contextWindow: 1048576,
                  },
                ],
              },
            },
          },
        },
      } as never),
    ).toEqual([
      {
        provider: "kilocode",
        id: "google/gemini-3-pro-preview",
        name: "Gemini 3 Pro Preview",
        input: ["text", "image"],
        reasoning: true,
        contextWindow: 1048576,
      },
    ]);
  });
});
