import { definePluginEntry } from "coreblow/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "coreblow/plugin-sdk/provider-auth-api-key";
import { ensureModelAllowlistEntry } from "coreblow/plugin-sdk/provider-onboard";
import { BYTEPLUS_CODING_MODEL_CATALOG, BYTEPLUS_MODEL_CATALOG } from "./models.js";
import { buildBytePlusCodingProvider, buildBytePlusProvider } from "./provider-catalog.js";
export { buildBytePlusVideoGenerationProvider } from "./video-generation-provider.js";

const PROVIDER_ID = "byteplus";
const BYTEPLUS_DEFAULT_MODEL_REF = "byteplus-plan/ark-code-latest";

function buildStaticCatalogEntries(
  providerId: string,
  catalog: typeof BYTEPLUS_MODEL_CATALOG | typeof BYTEPLUS_CODING_MODEL_CATALOG,
) {
  return catalog.map((entry) => ({
    provider: providerId,
    id: entry.id,
    name: entry.name,
    reasoning: entry.reasoning,
    input: [...entry.input],
    contextWindow: entry.contextWindow,
  }));
}

export default definePluginEntry({
  id: PROVIDER_ID,
  name: "BytePlus Provider",
  description: "Bundled BytePlus provider plugin",
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "BytePlus",
      docsPath: "/concepts/model-providers#byteplus-international",
      envVars: ["BYTEPLUS_API_KEY"],
      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "BytePlus API key",
          hint: "API key",
          optionKey: "byteplusApiKey",
          flagName: "--byteplus-api-key",
          envVar: "BYTEPLUS_API_KEY",
          promptMessage: "Enter BytePlus API key",
          defaultModel: BYTEPLUS_DEFAULT_MODEL_REF,
          expectedProviders: ["byteplus"],
          applyConfig: (cfg) =>
            ensureModelAllowlistEntry({
              cfg,
              modelRef: BYTEPLUS_DEFAULT_MODEL_REF,
            }),
          wizard: {
            choiceId: "byteplus-api-key",
            choiceLabel: "BytePlus API key",
            groupId: "byteplus",
            groupLabel: "BytePlus",
            groupHint: "API key",
          },
        }),
      ],
      catalog: {
        order: "paired",
        run: async (ctx) => {
          const apiKey = ctx.resolveProviderApiKey(PROVIDER_ID).apiKey;
          if (!apiKey) {
            return null;
          }
          return {
            providers: {
              byteplus: { ...buildBytePlusProvider(), apiKey },
              "byteplus-plan": { ...buildBytePlusCodingProvider(), apiKey },
            },
          };
        },
      },
      augmentModelCatalog: () => [
        ...buildStaticCatalogEntries("byteplus", BYTEPLUS_MODEL_CATALOG),
        ...buildStaticCatalogEntries("byteplus-plan", BYTEPLUS_CODING_MODEL_CATALOG),
      ],
    });
  },
});
