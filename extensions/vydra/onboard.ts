import type { CoreBlowConfig } from "coreblow/plugin-sdk/provider-onboard";

export const VYDRA_DEFAULT_IMAGE_MODEL_REF = "vydra/grok-imagine";

export function applyVydraConfig(cfg: CoreBlowConfig): CoreBlowConfig {
  if (cfg.agents?.defaults?.imageGenerationModel) {
    return cfg;
  }
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        imageGenerationModel: {
          primary: VYDRA_DEFAULT_IMAGE_MODEL_REF,
        },
      },
    },
  };
}
