import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { registerSingleProviderPlugin } from "../../test/helpers/extensions/plugin-registration.js";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";
import { DOUBAO_CODING_MODEL_CATALOG, DOUBAO_MODEL_CATALOG } from "./models.js";

describe("volcengine plugin", () => {
  it("augments the catalog with bundled standard and plan models", async () => {
    const provider = registerSingleProviderPlugin(plugin);
    const entries = await provider.augmentModelCatalog?.({
      env: process.env,
      entries: [],
    } as never);

    expect(entries).toEqual([
      ...DOUBAO_MODEL_CATALOG.map((entry) => ({
        provider: "volcengine",
        id: entry.id,
        name: entry.name,
        reasoning: entry.reasoning,
        input: [...entry.input],
        contextWindow: entry.contextWindow,
      })),
      ...DOUBAO_CODING_MODEL_CATALOG.map((entry) => ({
        provider: "volcengine-plan",
        id: entry.id,
        name: entry.name,
        reasoning: entry.reasoning,
        input: [...entry.input],
        contextWindow: entry.contextWindow,
      })),
    ]);
  });

  it("declares its coding provider auth alias in the manifest", () => {
    const pluginJson = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "coreblow.plugin.json"), "utf-8"),
    );

    expect(pluginJson.providerAuthAliases).toEqual({
      "volcengine-plan": "volcengine",
    });
  });

  it("declares OpenAI-compatible streaming usage support in the manifest", () => {
    const pluginJson = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "coreblow.plugin.json"), "utf-8"),
    );

    expect(pluginJson.providerRequest?.providers).toMatchObject({
      volcengine: {
        openAICompletions: { supportsStreamingUsage: true },
      },
      "volcengine-plan": {
        openAICompletions: { supportsStreamingUsage: true },
      },
    });
  });
});
