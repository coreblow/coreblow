import { normalizeCoreBlowProviderIndex } from "./normalize.js";
import { COREBLOW_PROVIDER_INDEX } from "./coreblow-provider-index.js";
import type { CoreBlowProviderIndex } from "./types.js";

export function loadCoreBlowProviderIndex(
  source: unknown = COREBLOW_PROVIDER_INDEX,
): CoreBlowProviderIndex {
  return normalizeCoreBlowProviderIndex(source) ?? { version: 1, providers: {} };
}
