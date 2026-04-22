import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_STORE_VERSION } from "./auth-profiles/constants.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";

const mocks = vi.hoisted(() => ({
  syncExternalCliCredentials: vi.fn((_: AuthProfileStore) => false),
}));

vi.mock("./auth-profiles/external-cli-sync.js", () => ({
  syncExternalCliCredentials: mocks.syncExternalCliCredentials,
}));

let clearRuntimeAuthProfileStoreSnapshots: typeof import("./auth-profiles.js").clearRuntimeAuthProfileStoreSnapshots;
let ensureAuthProfileStore: typeof import("./auth-profiles.js").ensureAuthProfileStore;

async function loadFreshAuthProfilesModuleForTest() {
  vi.resetModules();
  ({ clearRuntimeAuthProfileStoreSnapshots, ensureAuthProfileStore } =
    await import("./auth-profiles.js"));
}

function withAgentDirEnv(prefix: string, run: (agentDir: string) => void | Promise<void>) {
  const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const previousAgentDir = process.env.COREBLOW_AGENT_DIR;
  const previousPiAgentDir = process.env.PI_CODING_AGENT_DIR;
  try {
    process.env.COREBLOW_AGENT_DIR = agentDir;
    process.env.PI_CODING_AGENT_DIR = agentDir;
    return run(agentDir);
  } finally {
    if (previousAgentDir === undefined) {
      delete process.env.COREBLOW_AGENT_DIR;
    } else {
      process.env.COREBLOW_AGENT_DIR = previousAgentDir;
    }
    if (previousPiAgentDir === undefined) {
      delete process.env.PI_CODING_AGENT_DIR;
    } else {
      process.env.PI_CODING_AGENT_DIR = previousPiAgentDir;
    }
    fs.rmSync(agentDir, { recursive: true, force: true });
  }
}

function writeAuthStore(agentDir: string, key: string) {
  const authPath = path.join(agentDir, "auth-profiles.json");
  fs.writeFileSync(
    authPath,
    `${JSON.stringify(
      {
        version: AUTH_STORE_VERSION,
        profiles: {
          "openai:default": {
            type: "api_key",
            provider: "openai",
            key,
          },
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

describe("auth profile store cache", () => {
  beforeEach(async () => {
    await loadFreshAuthProfilesModuleForTest();
    clearRuntimeAuthProfileStoreSnapshots();
    mocks.syncExternalCliCredentials.mockReset().mockReturnValue(false);
  });

  afterEach(() => {
    clearRuntimeAuthProfileStoreSnapshots();
    vi.clearAllMocks();
  });

  it("loads from disk on first call", () => {
    withAgentDirEnv("coreblow-store-cache-", (agentDir) => {
      writeAuthStore(agentDir, "sk-initial");
      const store = ensureAuthProfileStore(agentDir);
      expect(store.profiles["openai:default"]).toMatchObject({
        type: "api_key",
        provider: "openai",
        key: "sk-initial",
      });
    });
  });

  it("returns consistent data on second call (caching behaviour)", () => {
    withAgentDirEnv("coreblow-store-cache2-", (agentDir) => {
      writeAuthStore(agentDir, "sk-first");
      const store1 = ensureAuthProfileStore(agentDir);
      const key1 = store1.profiles["openai:default"]?.key;

      const store2 = ensureAuthProfileStore(agentDir);
      const key2 = store2.profiles["openai:default"]?.key;

      // Both calls should return data from the same on-disk state
      expect(key1).toBe(key2);
      expect(key1).toBe("sk-first");
    });
  });

  it("different agent dirs get independent caches", () => {
    const agentDir1 = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-cache-a-"));
    const agentDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-cache-b-"));
    try {
      writeAuthStore(agentDir1, "sk-a");
      writeAuthStore(agentDir2, "sk-b");

      const store1 = ensureAuthProfileStore(agentDir1);
      const store2 = ensureAuthProfileStore(agentDir2);

      expect(store1.profiles["openai:default"]?.key).toBe("sk-a");
      expect(store2.profiles["openai:default"]?.key).toBe("sk-b");
      expect(store1).not.toBe(store2);
    } finally {
      fs.rmSync(agentDir1, { recursive: true, force: true });
      fs.rmSync(agentDir2, { recursive: true, force: true });
    }
  });

  it("clearRuntimeAuthProfileStoreSnapshots clears cache", () => {
    withAgentDirEnv("coreblow-clear-cache-", (agentDir) => {
      writeAuthStore(agentDir, "sk-before");
      const store1 = ensureAuthProfileStore(agentDir);

      clearRuntimeAuthProfileStoreSnapshots();

      writeAuthStore(agentDir, "sk-after");
      const store2 = ensureAuthProfileStore(agentDir);

      expect(store1).not.toBe(store2);
      expect(store2.profiles["openai:default"]?.key).toBe("sk-after");
    });
  });
});
