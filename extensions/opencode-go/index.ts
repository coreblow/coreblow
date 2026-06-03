import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "coreblow/plugin-sdk/provider-auth-api-key";
import { applyOpencodeGoConfig, OPENCODE_GO_DEFAULT_MODEL_REF } from "./api.js";
import { opencodeGoMediaUnderstandingProvider } from "./media-understanding-provider.js";
import {
  listOpencodeGoSupplementalModelCatalogEntries,
  normalizeOpencodeGoBaseUrl,
  normalizeOpencodeGoResolvedModel,
  resolveOpencodeGoSupplementalModel,
} from "./provider-catalog.js";
import { createOpencodeGoWrapper } from "./stream.js";

const PROVIDER_ID = "opencode-go";

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "OpenCode Go Provider",
  description: "Bundled OpenCode Go provider plugin",
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "OpenCode Go",
      docsPath: "/providers/models",
      envVars: ["OPENCODE_API_KEY", "OPENCODE_ZEN_API_KEY"],
      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "OpenCode Go catalog",
          hint: "Shared API key for Zen + Go catalogs",
          optionKey: "opencodeGoApiKey",
          flagName: "--opencode-go-api-key",
          envVar: "OPENCODE_API_KEY",
          promptMessage: "Enter OpenCode API key",
          profileIds: ["opencode:default", "opencode-go:default"],
          defaultModel: OPENCODE_GO_DEFAULT_MODEL_REF,
          expectedProviders: ["opencode", "opencode-go"],
          applyConfig: (cfg) => applyOpencodeGoConfig(cfg),
          noteMessage: [
            "OpenCode uses one API key across the Zen and Go catalogs.",
            "Go focuses on Kimi, GLM, and MiniMax coding models.",
            "Get your API key at: https://opencode.ai/auth",
          ].join("\n"),
          noteTitle: "OpenCode",
          wizard: {
            choiceId: "opencode-go",
            choiceLabel: "OpenCode Go catalog",
            groupId: "opencode",
            groupLabel: "OpenCode",
            groupHint: "Shared API key for Zen + Go catalogs",
          },
        }),
      ],
      capabilities: {
        openAiCompatTurnValidation: false,
        geminiThoughtSignatureSanitization: true,
        geminiThoughtSignatureModelHints: ["gemini"],
      },
      normalizeConfig: ({ providerConfig }) => {
        const normalizedBaseUrl = normalizeOpencodeGoBaseUrl({
          api: providerConfig.api,
          baseUrl: providerConfig.baseUrl,
        });
        return normalizedBaseUrl && normalizedBaseUrl !== providerConfig.baseUrl
          ? { ...providerConfig, baseUrl: normalizedBaseUrl }
          : undefined;
      },
      normalizeResolvedModel: ({ model }) => {
        const normalizedBaseUrl = normalizeOpencodeGoBaseUrl({
          api: model.api,
          baseUrl: model.baseUrl,
        });
        const baseUrlNormalized =
          normalizedBaseUrl && normalizedBaseUrl !== model.baseUrl
            ? { ...model, baseUrl: normalizedBaseUrl }
            : model;
        const modelNormalized = normalizeOpencodeGoResolvedModel(baseUrlNormalized as never);
        if (modelNormalized) {
          return modelNormalized;
        }
        return baseUrlNormalized !== model ? baseUrlNormalized : undefined;
      },
      normalizeTransport: ({ api, baseUrl }) => {
        const normalizedBaseUrl = normalizeOpencodeGoBaseUrl({ api, baseUrl });
        return normalizedBaseUrl && normalizedBaseUrl !== baseUrl
          ? { api, baseUrl: normalizedBaseUrl }
          : undefined;
      },
      resolveDynamicModel: ({ modelId }) => resolveOpencodeGoSupplementalModel(modelId),
      augmentModelCatalog: () => listOpencodeGoSupplementalModelCatalogEntries(),
      wrapStreamFn: (ctx) => createOpencodeGoWrapper(ctx.streamFn, ctx.thinkingLevel),
      isModernModelRef: () => true,
    });
    api.registerMediaUnderstandingProvider(opencodeGoMediaUnderstandingProvider);
  },
});
