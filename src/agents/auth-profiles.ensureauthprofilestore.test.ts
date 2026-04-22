import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { clearRuntimeAuthProfileStoreSnapshots, ensureAuthProfileStore } from "./auth-profiles.js";
import { AUTH_STORE_VERSION } from "./auth-profiles/constants.js";

describe("ensureAuthProfileStore", () => {
  function withTempAgentDir<T>(prefix: string, run: (agentDir: string) => T): T {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    try {
      return run(agentDir);
    } finally {
      clearRuntimeAuthProfileStoreSnapshots();
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  }

  it("creates empty store when no auth files exist", () => {
    withTempAgentDir("coreblow-auth-empty-", (agentDir) => {
      const store = ensureAuthProfileStore(agentDir);
      expect(store.version).toBe(AUTH_STORE_VERSION);
      expect(store.profiles).toBeDefined();
    });
  });

  it("loads existing auth-profiles.json", () => {
    withTempAgentDir("coreblow-auth-load-", (agentDir) => {
      const authPath = path.join(agentDir, "auth-profiles.json");
      fs.writeFileSync(
        authPath,
        JSON.stringify({
          version: AUTH_STORE_VERSION,
          profiles: {
            "openai:default": {
              type: "api_key",
              provider: "openai",
              key: "sk-test",
            },
          },
        }),
        "utf8",
      );

      const store = ensureAuthProfileStore(agentDir);
      expect(store.profiles["openai:default"]).toMatchObject({
        type: "api_key",
        provider: "openai",
        key: "sk-test",
      });
    });
  });

  it("migrates legacy auth.json to auth-profiles.json", () => {
    const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-auth-migrate-"));
    try {
      const legacyPath = path.join(agentDir, "auth.json");
      fs.writeFileSync(
        legacyPath,
        JSON.stringify({
          anthropic: {
            type: "oauth",
            provider: "anthropic",
            access: "access-token",
            refresh: "refresh-token",
            expires: Date.now() + 60_000,
          },
        }),
        "utf8",
      );

      const store = ensureAuthProfileStore(agentDir);
      expect(store.profiles["anthropic:default"]).toMatchObject({
        type: "oauth",
        provider: "anthropic",
      });

      const migratedPath = path.join(agentDir, "auth-profiles.json");
      expect(fs.existsSync(migratedPath)).toBe(true);
      expect(fs.existsSync(legacyPath)).toBe(false);
    } finally {
      clearRuntimeAuthProfileStoreSnapshots();
      fs.rmSync(agentDir, { recursive: true, force: true });
    }
  });

  it("handles corrupted auth-profiles.json gracefully", () => {
    withTempAgentDir("coreblow-auth-corrupt-", (agentDir) => {
      const authPath = path.join(agentDir, "auth-profiles.json");
      fs.writeFileSync(authPath, "{ this is not json }", "utf8");

      // Should not throw — returns empty/default store
      expect(() => ensureAuthProfileStore(agentDir)).not.toThrow();
    });
  });

  it("is idempotent — successive calls return compatible store", () => {
    withTempAgentDir("coreblow-auth-idempotent-", (agentDir) => {
      const authPath = path.join(agentDir, "auth-profiles.json");
      fs.writeFileSync(
        authPath,
        JSON.stringify({
          version: AUTH_STORE_VERSION,
          profiles: {
            "openai:default": { type: "api_key", provider: "openai", key: "sk-x" },
          },
        }),
        "utf8",
      );

      const store1 = ensureAuthProfileStore(agentDir);
      const store2 = ensureAuthProfileStore(agentDir);

      expect(store1.profiles["openai:default"]?.key).toBe("sk-x");
      expect(store2.profiles["openai:default"]?.key).toBe("sk-x");
    });
  });
});
