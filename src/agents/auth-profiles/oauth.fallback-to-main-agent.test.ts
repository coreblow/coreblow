import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../plugins/provider-runtime.runtime.js", () => ({
  formatProviderAuthProfileApiKeyWithPlugin: async () => undefined,
  refreshProviderOAuthCredentialWithPlugin: async () => null,
}));

let clearRuntimeAuthProfileStoreSnapshots: typeof import("../auth-profiles.js").clearRuntimeAuthProfileStoreSnapshots;
let ensureAuthProfileStore: typeof import("../auth-profiles.js").ensureAuthProfileStore;
let resolveApiKeyForProfile: typeof import("../auth-profiles.js").resolveApiKeyForProfile;
let resetFileLockStateForTest: typeof import("../../infra/file-lock.js").resetFileLockStateForTest;

function createAgentDirWithStore(
  profiles: Record<string, object>,
): { agentDir: string; cleanup: () => void } {
  const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-oauth-fallback-"));
  const authPath = path.join(agentDir, "auth-profiles.json");
  fs.writeFileSync(
    authPath,
    JSON.stringify({ version: 1, profiles }),
    "utf8",
  );
  return {
    agentDir,
    cleanup: () => fs.rmSync(agentDir, { recursive: true, force: true }),
  };
}

describe("oauth fallback to main agent", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ clearRuntimeAuthProfileStoreSnapshots, ensureAuthProfileStore, resolveApiKeyForProfile } =
      await import("../auth-profiles.js"));
    ({ resetFileLockStateForTest } = await import("../../infra/file-lock.js"));
    clearRuntimeAuthProfileStoreSnapshots();
    resetFileLockStateForTest();
  });

  afterEach(() => {
    clearRuntimeAuthProfileStoreSnapshots();
    resetFileLockStateForTest();
    vi.clearAllMocks();
  });

  it("resolves api_key credential from agent-specific store", async () => {
    const { agentDir, cleanup } = createAgentDirWithStore({
      "openai:default": {
        type: "api_key",
        provider: "openai",
        key: "sk-agent-specific",
      },
    });

    try {
      const store = ensureAuthProfileStore(agentDir);
      const result = await resolveApiKeyForProfile({
        store,
        profileId: "openai:default",
      });
      expect(result?.apiKey).toBe("sk-agent-specific");
    } finally {
      cleanup();
    }
  });

  it("returns null when profile not found in agent store", async () => {
    const { agentDir, cleanup } = createAgentDirWithStore({});

    try {
      const store = ensureAuthProfileStore(agentDir);
      const result = await resolveApiKeyForProfile({
        store,
        profileId: "openai:default",
      });
      expect(result).toBeNull();
    } finally {
      cleanup();
    }
  });
});
