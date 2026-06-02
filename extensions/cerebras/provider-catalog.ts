import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import {
  CEREBRAS_BASE_URL,
  CEREBRAS_MODEL_CATALOG,
  buildCerebrasModelDefinition,
} from "./models.js";

export function buildCerebrasProvider(): ModelProviderConfig {
  return {
    baseUrl: CEREBRAS_BASE_URL,
    api: "openai-completions",
    models: CEREBRAS_MODEL_CATALOG.map(buildCerebrasModelDefinition),
  };
}
