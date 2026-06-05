import { z } from "zod";
import {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInputString,
} from "../config/types.secrets.js";
import { normalizeSecretInput } from "../utils/normalize-secret-input.js";
import { buildSecretInputSchema } from "./secret-input-schema.js";

export type { SecretInput } from "../config/types.secrets.js";
export {
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  normalizeSecretInput,
  normalizeSecretInputString,
};

/** Optional version of the shared secret-input schema. */
export function buildOptionalSecretInputSchema() {
  return buildSecretInputSchema().optional();
}

/** Array version of the shared secret-input schema. */
export function buildSecretInputArraySchema() {
  return z.array(buildSecretInputSchema());
}

export function resolveSecretInputString(params: {
  value: unknown;
  path?: string;
  config?: unknown;
  env?: NodeJS.ProcessEnv;
  defaults?: unknown;
  mode?: string;
}):
  | { status: "available"; value: string }
  | { status: "missing" }
  | { status: "configured_unavailable"; ref: { source: string; provider: string; id: string } } {
  const ref = params.value as { source?: unknown; provider?: unknown; id?: unknown };
  if (ref && typeof ref === "object" && typeof ref.source === "string") {
    return {
      status: "configured_unavailable",
      ref: {
        source: ref.source,
        provider: typeof ref.provider === "string" ? ref.provider : ref.source,
        id: typeof ref.id === "string" ? ref.id : "",
      },
    };
  }
  const normalized = normalizeResolvedSecretInputString({
    value: params.value,
    path: params.path ?? "secret",
  });
  if (normalized) {
    return { status: "available", value: normalized };
  }
  return { status: "missing" };
}
