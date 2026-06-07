import {
  legacyConfigRules as TLON_LEGACY_CONFIG_RULES,
  normalizeCompatibilityConfig as normalizeTlonCompatibilityConfig,
} from "./doctor-contract.js";

export const tlonDoctor = {
  legacyConfigRules: TLON_LEGACY_CONFIG_RULES,
  normalizeCompatibilityConfig: normalizeTlonCompatibilityConfig,
};
