import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_STORE_VERSION } from "./auth-profiles/constants.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";

const mocks = vi.hoisted(() => ({
  syncExternalCliCredentials: vi.fn((store: AuthProfileStore) => {
    store.profiles["minimax-portal:default"] = {
      type: "oauth",
      provider: "minimax-portal",
      access: "access-token",
      refresh: "refresh-token",
      expires: Date.now() + 60_000,
    } as AuthProfileStore["profiles"][string];
    return true;
  }),
}));

vi.mock("./auth-profiles/external-cli-sync.js", () => ({
  syncExternalCliCredentials: mocks.syncExternalCliCredentials,
}));

let clearRuntimeAuthProfileStoreSnapshots: typeof import("./auth-profiles.js").clearRuntimeAuthProfileStoreSnapshots;
let loadAuthProfileStoreForRuntime: typeof import("./auth-profiles.js").loadAuthProfileStoreForRuntime;

describe("auth profiles read-only external CLI sync", () => {
  beforeEach(async () => {
    vi.resetModules();
    ({ clearRuntimeAuthProfileStoreSnapshots, loadAuthProfileStoreForRuntime } =
      await import("./auth-profiles.js"));
    clearRuntimeAuthProfileStoreSnapshots();
    mocks.syncExternalCliCredentials.mockClear();
  });

  afterEach(() => {
    clearRuntimeAuthProfileStoreSnapshots();
    vi.clearAllMocks();
  });

  it("syncs external CLI credentials in read-only mode (in-memory only)", () => {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-auth-readonly-sync-"));
    try {
      const authPath = path.join(agentDir, "auth-profiles.json");
      const baseline: AuthProfileStore = {
        version: AUTH_STORE_VERSION,
        profiles: {
          "openai:default": {
            type: "api_key",
            provider: "openai",
            key: "sk-test",
          },
        },
      };
      fs.writeFileSync(authPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");

      // CB: readOnly=true — external CLI sync is SKIPPED (not called)
      loadAuthProfileStoreForRuntime(agentDir, { readOnly: true });

      // In CB, readOnly suppresses external CLI sync entirely
      // Disk should be unchanged
      const diskContent = JSON.parse(fs.readFileSync(authPath, "utf8")) as AuthProfileStore;
      expect(diskContent.profiles["minimax-portal:default"]).toBeUndefined();
      expect(diskContent.profiles["openai:default"]).toBeDefined();
    } finally {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("calls syncExternalCliCredentials in writable mode", () => {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-auth-writable-sync-"));
    try {
      const authPath = path.join(agentDir, "auth-profiles.json");
      const baseline: AuthProfileStore = {
        version: AUTH_STORE_VERSION,
        profiles: {
          "openai:default": { type: "api_key", provider: "openai", key: "sk-test" },
        },
      };
      fs.writeFileSync(authPath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");

      loadAuthProfileStoreForRuntime(agentDir); // no readOnly → writable

      // CB calls syncExternalCliCredentials in writable mode
      expect(mocks.syncExternalCliCredentials).toHaveBeenCalled();
    } finally {
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });
});
