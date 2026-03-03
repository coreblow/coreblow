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

describe("openai-codex refresh fallback", () => {
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

  it("resolves non-expired oauth token directly without refresh", async () => {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-codex-refresh-"));
    const authPath = path.join(agentDir, "auth-profiles.json");
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        version: 1,
        profiles: {
          "openai-codex:default": {
            type: "oauth",
            provider: "openai-codex",
            access: "at_valid",
            refresh: "rt_valid",
            expires: Date.now() + 3_600_000,
          },
        },
      }),
      "utf8",
    );

    try {
      const store = ensureAuthProfileStore(agentDir);
      const result = await resolveApiKeyForProfile({
        store,
        profileId: "openai-codex:default",
      });

      expect(result?.apiKey).toBe("at_valid");
    } finally {
      clearRuntimeAuthProfileStoreSnapshots();
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("returns null for expired oauth with no refresh plugin available", async () => {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-codex-expired-"));
    const authPath = path.join(agentDir, "auth-profiles.json");
    fs.writeFileSync(
      authPath,
      JSON.stringify({
        version: 1,
        profiles: {
          "openai-codex:default": {
            type: "oauth",
            provider: "openai-codex",
            access: "at_expired",
            refresh: "rt_valid",
            expires: Date.now() - 1_000,
          },
        },
      }),
      "utf8",
    );

    try {
      const store = ensureAuthProfileStore(agentDir);
      const result = await resolveApiKeyForProfile({
        store,
        profileId: "openai-codex:default",
      });

      // Plugin returns null → no refresh possible → null result
      expect(result).toBeNull();
    } finally {
      clearRuntimeAuthProfileStoreSnapshots();
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });
});
