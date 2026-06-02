import { registerSingleProviderPlugin } from "../../test/helpers/extensions/plugin-registration.js";
import { describe, expect, it } from "vitest";
import { CEREBRAS_BASE_URL } from "./api.js";
import plugin from "./index.js";
import { buildCerebrasProvider } from "./provider-catalog.js";

describe("cerebras provider plugin", () => {
  it("registers the Cerebras provider contract", () => {
    const provider = registerSingleProviderPlugin(plugin);

    expect(provider.id).toBe("cerebras");
    expect(provider.label).toBe("Cerebras");
    expect(provider.docsPath).toBe("/providers/cerebras");
    expect(provider.envVars).toEqual(["CEREBRAS_API_KEY"]);
    expect(provider.auth).toHaveLength(1);
    expect(provider.auth[0]).toMatchObject({
      id: "api-key",
      label: "Cerebras API key",
      hint: "Fast OpenAI-compatible inference",
      kind: "api_key",
      wizard: {
        choiceId: "cerebras-api-key",
        choiceLabel: "Cerebras API key",
        groupId: "cerebras",
        groupLabel: "Cerebras",
        groupHint: "Fast OpenAI-compatible inference",
      },
    });
  });

  it("builds the static OpenAI-compatible model catalog", () => {
    const provider = buildCerebrasProvider();

    expect(provider.baseUrl).toBe(CEREBRAS_BASE_URL);
    expect(provider.api).toBe("openai-completions");
    expect(provider.models.map((model) => model.id)).toEqual([
      "zai-glm-4.7",
      "gpt-oss-120b",
      "qwen-3-235b-a22b-instruct-2507",
      "llama3.1-8b",
    ]);
    expect(provider.models[0]).toMatchObject({
      api: "openai-completions",
      name: "Z.ai GLM 4.7",
      reasoning: true,
      contextWindow: 128000,
      maxTokens: 8192,
    });
  });
});
