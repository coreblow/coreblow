import { defineSingleProviderPluginEntry } from "coreblow/plugin-sdk/provider-entry";
import {
  createKilocodeWrapper,
  isProxyReasoningUnsupported,
} from "coreblow/plugin-sdk/provider-stream";
import { applyKilocodeConfig, KILOCODE_DEFAULT_MODEL_REF } from "./onboard.js";
import { buildKilocodeProviderWithDiscovery } from "./provider-catalog.js";

const PROVIDER_ID = "kilocode";

function readConfiguredKilocodeCatalogEntries(config?: {
  models?: {
    providers?: {
      kilocode?: {
        models?: unknown;
      };
    };
  };
}) {
  const models = config?.models?.providers?.kilocode?.models;
  if (!Array.isArray(models)) {
    return [];
  }
  return models
    .map((model) => {
      if (!model || typeof model !== "object") {
        return null;
      }
      const record = model as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim() : "";
      if (!id) {
        return null;
      }
      const name = typeof record.name === "string" && record.name.trim() ? record.name.trim() : id;
      const contextWindow =
        typeof record.contextWindow === "number" && record.contextWindow > 0
          ? record.contextWindow
          : undefined;
      const reasoning = typeof record.reasoning === "boolean" ? record.reasoning : undefined;
      const input = Array.isArray(record.input)
        ? record.input.filter((item): item is "text" | "image" => item === "text" || item === "image")
        : undefined;
      return {
        provider: PROVIDER_ID,
        id,
        name,
        ...(input && input.length > 0 ? { input } : {}),
        ...(reasoning !== undefined ? { reasoning } : {}),
        ...(contextWindow ? { contextWindow } : {}),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export default defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "Kilo Gateway Provider",
  description: "Bundled Kilo Gateway provider plugin",
  provider: {
    label: "Kilo Gateway",
    docsPath: "/providers/kilocode",
    auth: [
      {
        methodId: "api-key",
        label: "Kilo Gateway API key",
        hint: "API key (OpenRouter-compatible)",
        optionKey: "kilocodeApiKey",
        flagName: "--kilocode-api-key",
        envVar: "KILOCODE_API_KEY",
        promptMessage: "Enter Kilo Gateway API key",
        defaultModel: KILOCODE_DEFAULT_MODEL_REF,
        applyConfig: (cfg) => applyKilocodeConfig(cfg),
      },
    ],
    catalog: {
      buildProvider: buildKilocodeProviderWithDiscovery,
    },
    augmentModelCatalog: ({ config }) =>
      readConfiguredKilocodeCatalogEntries(config as Parameters<typeof readConfiguredKilocodeCatalogEntries>[0]),
    capabilities: {
      geminiThoughtSignatureSanitization: true,
      geminiThoughtSignatureModelHints: ["gemini"],
    },
    wrapStreamFn: (ctx) => {
      const thinkingLevel =
        ctx.modelId === "kilo/auto" || isProxyReasoningUnsupported(ctx.modelId)
          ? undefined
          : ctx.thinkingLevel;
      return createKilocodeWrapper(ctx.streamFn, thinkingLevel);
    },
    isCacheTtlEligible: (ctx) => ctx.modelId.startsWith("anthropic/"),
  },
});
