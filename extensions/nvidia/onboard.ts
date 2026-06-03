import {
  createDefaultModelsPresetAppliers,
  type CoreBlowConfig,
} from "coreblow/plugin-sdk/provider-onboard";
import { buildNvidiaProvider, NVIDIA_DEFAULT_MODEL_ID } from "./provider-catalog.js";

export const NVIDIA_DEFAULT_MODEL_REF = NVIDIA_DEFAULT_MODEL_ID;

function normalizeExistingNvidiaModels(cfg: CoreBlowConfig): CoreBlowConfig {
  const provider = cfg.models?.providers?.nvidia;
  if (!provider?.models?.length) {
    return cfg;
  }
  let changed = false;
  const models = provider.models.map((model) => {
    if (typeof model.id !== "string" || model.id.includes("/")) {
      return model;
    }
    changed = true;
    return {
      ...model,
      id: `nvidia/${model.id}`,
    };
  });
  if (!changed) {
    return cfg;
  }
  return {
    ...cfg,
    models: {
      ...cfg.models,
      providers: {
        ...cfg.models?.providers,
        nvidia: {
          ...provider,
          models,
        },
      },
    },
  };
}

const nvidiaPresetAppliers = createDefaultModelsPresetAppliers({
  primaryModelRef: NVIDIA_DEFAULT_MODEL_REF,
  resolveParams: (_cfg: CoreBlowConfig) => {
    const defaultProvider = buildNvidiaProvider();
    return {
      providerId: "nvidia",
      api: defaultProvider.api ?? "openai-completions",
      baseUrl: defaultProvider.baseUrl,
      defaultModels: defaultProvider.models ?? [],
      defaultModelId: NVIDIA_DEFAULT_MODEL_ID,
      aliases: [{ modelRef: NVIDIA_DEFAULT_MODEL_REF, alias: "NVIDIA" }],
    };
  },
});

export function applyNvidiaProviderConfig(cfg: CoreBlowConfig): CoreBlowConfig {
  return nvidiaPresetAppliers.applyProviderConfig(normalizeExistingNvidiaModels(cfg));
}

export function applyNvidiaConfig(cfg: CoreBlowConfig): CoreBlowConfig {
  return nvidiaPresetAppliers.applyConfig(normalizeExistingNvidiaModels(cfg));
}
