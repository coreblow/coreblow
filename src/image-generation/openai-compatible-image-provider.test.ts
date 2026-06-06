import { describe, expect, it } from "vitest";
import { createOpenAiCompatibleImageGenerationProvider } from "./openai-compatible-image-provider.js";

describe("OpenAI-compatible image provider helper", () => {
  it("builds provider metadata without registering a default provider", () => {
    const provider = createOpenAiCompatibleImageGenerationProvider({
      id: "sample",
      label: "Sample",
      defaultModel: "sample-image",
      models: ["sample-image"],
      defaultBaseUrl: "https://sample.example/v1",
      capabilities: {
        generate: { maxCount: 4, supportsSize: true },
        edit: { enabled: true, maxCount: 1, maxInputImages: 1, supportsSize: true },
      },
      buildGenerateRequest: ({ req, model, count }) => ({
        kind: "json",
        body: { model, prompt: req.prompt, n: count },
      }),
      buildEditRequest: () => {
        const form = new FormData();
        return { kind: "multipart", form };
      },
    });

    expect(provider.id).toBe("sample");
    expect(provider.defaultModel).toBe("sample-image");
    expect(provider.models).toEqual(["sample-image"]);
  });
});
