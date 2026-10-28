import { loadJsonFile } from "../../infra/json-file.js";
import { resolveAuthStorePath } from "./paths.js";
import { coerceAuthStore } from "./store.js";
import type { AuthProfileStore } from "./types.js";

/**
 * Loads the persisted auth profile store for a given agent directory from disk.
 * Does not fall back to runtime snapshots or sync external CLI credentials.
 */
export function loadPersistedAuthProfileStore(agentDir?: string): AuthProfileStore | null {
  const authPath = resolveAuthStorePath(agentDir);
  const raw = loadJsonFile(authPath);
  return coerceAuthStore(raw);
}
