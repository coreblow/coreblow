// @ts-nocheck
import { createRequire } from "node:module";
import { getMSTeamsRuntime } from "./runtime.js";

let cachedUserAgent: string | undefined;

function resolveTeamsSdkVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("@microsoft/teams.apps/package.json") as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function resolveCoreBlowVersion(): string {
  try {
    return getMSTeamsRuntime().version;
  } catch {
    return "unknown";
  }
}

/**
 * Build a combined User-Agent string that preserves the Teams SDK identity
 * and appends the CoreBlow version.
 *
 * Format: "teams.ts[apps]/<sdk-version> CoreBlow/<coreblow-version>"
 * Example: "teams.ts[apps]/2.0.5 CoreBlow/2026.3.22"
 *
 * This lets the Teams backend track SDK usage while also identifying the
 * host application.
 */
/** Reset the cached User-Agent (for testing). */
export function resetUserAgentCache(): void {
  cachedUserAgent = undefined;
}

export function buildUserAgent(): string {
  if (cachedUserAgent) {
    return cachedUserAgent;
  }
  cachedUserAgent = `teams.ts[apps]/${resolveTeamsSdkVersion()} CoreBlow/${resolveCoreBlowVersion()}`;
  return cachedUserAgent;
}
