import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { registerSingleProviderPlugin } from "../../src/test-utils/plugin-registration.js";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";
import { BYTEPLUS_CODING_MODEL_CATALOG, BYTEPLUS_MODEL_CATALOG } from "./models.js";

describe("byteplus plugin", () => {
  it("augments the catalog with bundled standard and plan models", async () => {
    const provider = registerSingleProviderPlugin(plugin);
    const entries = await provider.augmentModelCatalog?.({
      env: process.env,
      entries: [],
    } as never);

    const standardEntry = entries?.find(
      (entry) => entry.provider === "byteplus" && entry.id === BYTEPLUS_MODEL_CATALOG[0]?.id,
    );
    expect(standardEntry?.name).toBe(BYTEPLUS_MODEL_CATALOG[0]?.name);
    expect(standardEntry?.reasoning).toBe(BYTEPLUS_MODEL_CATALOG[0]?.reasoning);
    expect(standardEntry?.input).toEqual([...((BYTEPLUS_MODEL_CATALOG[0]?.input ?? []) as string[])]);
    expect(standardEntry?.contextWindow).toBe(BYTEPLUS_MODEL_CATALOG[0]?.contextWindow);

    const planEntry = entries?.find(
      (entry) =>
        entry.provider === "byteplus-plan" && entry.id === BYTEPLUS_CODING_MODEL_CATALOG[0]?.id,
    );
    expect(planEntry?.name).toBe(BYTEPLUS_CODING_MODEL_CATALOG[0]?.name);
    expect(planEntry?.reasoning).toBe(BYTEPLUS_CODING_MODEL_CATALOG[0]?.reasoning);
    expect(planEntry?.input).toEqual([...((BYTEPLUS_CODING_MODEL_CATALOG[0]?.input ?? []) as string[])]);
    expect(planEntry?.contextWindow).toBe(BYTEPLUS_CODING_MODEL_CATALOG[0]?.contextWindow);
  });

  it("declares its coding provider auth alias in the manifest", () => {
    const pluginJson = JSON.parse(
      readFileSync(resolve(import.meta.dirname, "coreblow.plugin.json"), "utf-8"),
    ) as {
      providerAuthAliases?: Record<string, string>;
    };

    expect(pluginJson.providerAuthAliases).toEqual({
      "byteplus-plan": "byteplus",
    });
  });

  it("keeps Kimi catalog metadata aligned with provider capabilities", () => {
    const standardKimi = BYTEPLUS_MODEL_CATALOG.find((entry) => entry.id === "kimi-k2-5-260127");
    const planKimi = BYTEPLUS_CODING_MODEL_CATALOG.find((entry) => entry.id === "kimi-k2.5");
    const thinkingKimi = BYTEPLUS_CODING_MODEL_CATALOG.find(
      (entry) => entry.id === "kimi-k2-thinking",
    );

    for (const entry of [standardKimi, planKimi, thinkingKimi]) {
      expect(entry?.reasoning).toBe(true);
      expect(entry?.maxTokens).toBe(32768);
      expect(entry?.cost?.input).toBe(0.6);
      expect(entry?.cost?.output).toBe(2.5);
      expect(entry?.cost?.cacheRead).toBe(0.12);
      expect(entry?.cost?.cacheWrite).toBe(0);
    }
  });
});
