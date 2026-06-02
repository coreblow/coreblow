import {
  createModelCatalogPresetAppliers,
  type CoreBlowConfig,
} from "coreblow/plugin-sdk/provider-onboard";
import {
  CEREBRAS_BASE_URL,
  CEREBRAS_MODEL_CATALOG,
  buildCerebrasModelDefinition,
} from "./models.js";

export const CEREBRAS_DEFAULT_MODEL_REF = "cerebras/zai-glm-4.7";

const cerebrasPresetAppliers = createModelCatalogPresetAppliers({
  primaryModelRef: CEREBRAS_DEFAULT_MODEL_REF,
  resolveParams: (_cfg: CoreBlowConfig) => ({
    providerId: "cerebras",
    api: "openai-completions",
    baseUrl: CEREBRAS_BASE_URL,
    catalogModels: CEREBRAS_MODEL_CATALOG.map(buildCerebrasModelDefinition),
    aliases: [{ modelRef: CEREBRAS_DEFAULT_MODEL_REF, alias: "Cerebras GLM 4.7" }],
  }),
});

export function applyCerebrasConfig(cfg: CoreBlowConfig): CoreBlowConfig {
  return cerebrasPresetAppliers.applyConfig(cfg);
}
