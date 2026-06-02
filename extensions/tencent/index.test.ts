import { registerSingleProviderPlugin } from "../../test/helpers/extensions/plugin-registration.js";
import { describe, expect, it } from "vitest";
import { TOKENHUB_BASE_URL, TOKENHUB_PROVIDER_ID } from "./api.js";
import plugin from "./index.js";
import { TOKENHUB_DEFAULT_MODEL_REF } from "./onboard.js";
import { buildTokenHubProvider } from "./provider-catalog.js";

describe("tencent TokenHub provider plugin", () => {
  it("registers the TokenHub provider contract", () => {
    const provider = registerSingleProviderPlugin(plugin);

    expect(provider.id).toBe(TOKENHUB_PROVIDER_ID);
    expect(provider.label).toBe("Tencent TokenHub");
    expect(provider.docsPath).toBe("/providers/tencent");
    expect(provider.envVars).toEqual(["TOKENHUB_API_KEY"]);
    expect(provider.auth[0]).toMatchObject({
      id: "api-key",
      kind: "api_key",
      label: "Tencent TokenHub",
      hint: "Hy via Tencent TokenHub Gateway",
      wizard: {
        choiceId: "tokenhub-api-key",
        choiceLabel: "Tencent TokenHub",
        groupId: "tencent",
        groupLabel: "Tencent Cloud",
        groupHint: "Tencent TokenHub",
      },
    });
  });

  it("builds the TokenHub OpenAI-compatible model catalog", () => {
    const provider = buildTokenHubProvider();

    expect(provider.baseUrl).toBe(TOKENHUB_BASE_URL);
    expect(provider.api).toBe("openai-completions");
    expect(provider.models).toEqual([
      {
        id: "hy3-preview",
        name: "Hy3 preview (TokenHub)",
        reasoning: true,
        input: ["text"],
        contextWindow: 256000,
        maxTokens: 64000,
        cost: {
          input: 0.176,
          output: 0.587,
          cacheRead: 0.059,
          cacheWrite: 0,
        },
        compat: {
          supportsUsageInStreaming: true,
          supportsReasoningEffort: true,
        },
        api: "openai-completions",
      },
    ]);
  });

  it("exposes static catalog augmentation entries", () => {
    const provider = registerSingleProviderPlugin(plugin);
    const entries = provider.augmentModelCatalog?.({ entries: [] } as never);

    expect(entries).toEqual([
      {
        provider: TOKENHUB_PROVIDER_ID,
        id: "hy3-preview",
        name: "Hy3 preview (TokenHub)",
        reasoning: true,
        input: ["text"],
        contextWindow: 256000,
      },
    ]);
    expect(TOKENHUB_DEFAULT_MODEL_REF).toBe("tencent-tokenhub/hy3-preview");
  });
});
