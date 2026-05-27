import type { CoreBlowConfig } from "../config/config.js";

type CoreBlowConfigWithModelPricing = CoreBlowConfig & {
  models?: CoreBlowConfig["models"] & {
    pricing?: {
      enabled?: boolean;
    };
  };
};

export function isGatewayModelPricingEnabled(config: CoreBlowConfigWithModelPricing): boolean {
  return config.models?.pricing?.enabled !== false;
}
