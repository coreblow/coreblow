import crypto from "node:crypto";
import type { ConfigFileSnapshot } from "../config/types.coreblow.js";
import type { CoreBlowConfig } from "../config/types.coreblow.js";

function hashConfigRaw(raw: string | null): string {
  return crypto
    .createHash("sha256")
    .update(raw ?? "")
    .digest("hex");
}

export function buildTestConfigSnapshot(params: {
  path: string;
  exists: boolean;
  raw: string | null;
  parsed: unknown;
  valid: boolean;
  config: CoreBlowConfig;
  issues: ConfigFileSnapshot["issues"];
  warnings?: ConfigFileSnapshot["warnings"];
  legacyIssues: ConfigFileSnapshot["legacyIssues"];
}): ConfigFileSnapshot {
  return {
    path: params.path,
    exists: params.exists,
    raw: params.raw,
    parsed: params.parsed,
    resolved: params.config,
    valid: params.valid,
    config: params.config,
    hash: hashConfigRaw(params.raw),
    issues: params.issues,
    warnings: params.warnings ?? [],
    legacyIssues: params.legacyIssues,
  };
}
