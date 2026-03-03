import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveApiKeyForProfile } from "../auth-profiles.js";

vi.mock("../../plugins/provider-runtime.runtime.js", () => ({
  formatProviderAuthProfileApiKeyWithPlugin: async () => undefined,
  refreshProviderOAuthCredentialWithPlugin: async () => null,
}));

let clearRuntimeAuthProfileStoreSnapshots: typeof import("../auth-profiles.js").clearRuntimeAuthProfileStoreSnapshots;
let ensureAuthProfileStore: typeof import("../auth-profiles.js").ensureAuthProfileStore;
let resetFileLockStateForTest: typeof import("../../infra/file-lock.js").resetFileLockStateForTest;

describe("auth-profiles/oauth", () => {
  let tempDir: string | null = null;

  beforeEach(async () => {
    vi.resetModules();
    ({ clearRuntimeAuthProfileStoreSnapshots, ensureAuthProfileStore } =
      await import("../auth-profiles.js"));
    ({ resetFileLockStateForTest } = await import("../../infra/file-lock.js"));
    clearRuntimeAuthProfileStoreSnapshots();
    resetFileLockStateForTest();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    clearRuntimeAuthProfileStoreSnapshots();
    resetFileLockStateForTest();
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it("resolves api_key profile directly without refresh", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-oauth-apikey-"));
    const agentDir = tempDir;
    const authPath = path.join(agentDir, "auth-profiles.json");

    await fs.writeFile(
      authPath,
      JSON.stringify({
        version: 1,
        profiles: {
          "anthropic:default": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-anthropic-test",
          },
        },
      }),
      "utf8",
    );

    const store = ensureAuthProfileStore(agentDir);
    const result = await resolveApiKeyForProfile({
      store,
      profileId: "anthropic:default",
    });

    expect(result?.apiKey).toBe("sk-anthropic-test");
  });

  it("returns null for unknown profile id", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-oauth-unknown-"));
    const agentDir = tempDir;
    const authPath = path.join(agentDir, "auth-profiles.json");

    await fs.writeFile(
      authPath,
      JSON.stringify({ version: 1, profiles: {} }),
      "utf8",
    );

    const store = ensureAuthProfileStore(agentDir);
    const result = await resolveApiKeyForProfile({
      store,
      profileId: "nonexistent:default",
    });

    expect(result).toBeNull();
  });

  it("resolves valid non-expired oauth access token directly", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-oauth-valid-"));
    const agentDir = tempDir;
    const authPath = path.join(agentDir, "auth-profiles.json");

    await fs.writeFile(
      authPath,
      JSON.stringify({
        version: 1,
        profiles: {
          "anthropic:oauth": {
            type: "oauth",
            provider: "anthropic",
            access: "at_valid",
            refresh: "rt_valid",
            expires: Date.now() + 3_600_000,
          },
        },
      }),
      "utf8",
    );

    const store = ensureAuthProfileStore(agentDir);
    const result = await resolveApiKeyForProfile({
      store,
      profileId: "anthropic:oauth",
    });

    expect(result?.apiKey).toBe("at_valid");
  });
});
