import type { CoreBlowConfig } from "../../../config/types.coreblow.js";
import { validateConfigObjectWithPlugins } from "../../../config/validation.js";
import { applyLegacyDoctorMigrations } from "./legacy-config-compat.js";

export function migrateLegacyConfig(raw: unknown): {
  config: CoreBlowConfig | null;
  changes: string[];
  partiallyValid?: boolean;
} {
  const { next, changes } = applyLegacyDoctorMigrations(raw);
  if (!next) {
    return { config: null, changes: [] };
  }
  const validated = validateConfigObjectWithPlugins(next);
  if (!validated.ok) {
    changes.push("Migration applied; other validation issues remain — run doctor to review.");
    return { config: next as CoreBlowConfig, changes, partiallyValid: true };
  }
  return { config: validated.config, changes };
}
