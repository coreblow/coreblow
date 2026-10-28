import { createHash } from "node:crypto";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";
import { resolveUserPath } from "../../utils.js";
import {
  AUTH_PROFILE_FILENAME,
  AUTH_STATE_FILENAME,
  LEGACY_AUTH_FILENAME,
} from "./path-constants.js";
import {
  resolveAuthStorePath,
  resolveLegacyAuthStorePath,
  resolveAuthStatePath,
  resolveAuthStorePathForDisplay,
} from "./paths.js";

export {
  resolveAuthStorePath,
  resolveLegacyAuthStorePath,
  resolveAuthStatePath,
  resolveAuthStorePathForDisplay,
};

export function resolveAuthStatePathForDisplay(agentDir?: string): string {
  const pathname = resolveAuthStatePath(agentDir);
  return pathname.startsWith("~") ? pathname : resolveUserPath(pathname);
}

export function resolveOAuthRefreshLockPath(provider: string, profileId: string): string {
  const hash = createHash("sha256");
  hash.update(provider, "utf8");
  hash.update("\u0000", "utf8");
  hash.update(profileId, "utf8");
  const safeId = `sha256-${hash.digest("hex")}`;
  return path.join(resolveStateDir(), "locks", "oauth-refresh", safeId);
}
