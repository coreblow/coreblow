import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveAuthStorePath } from "./auth-profiles/paths.js";
import { saveAuthProfileStore } from "./auth-profiles/store.js";
import type { AuthProfileStore } from "./auth-profiles/types.js";

describe("saveAuthProfileStore", () => {
  it("strips plaintext when keyRef/tokenRef are present", async () => {
    const agentDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-auth-save-"));
    try {
      const store: AuthProfileStore = {
        version: 1,
        profiles: {
          "openai:default": {
            type: "api_key",
            provider: "openai",
            key: "sk-runtime-value",
            keyRef: { source: "env", provider: "default", id: "OPENAI_API_KEY" },
          },
          "github-copilot:default": {
            type: "token",
            provider: "github-copilot",
            token: "gh-runtime-token",
            tokenRef: { source: "env", provider: "default", id: "GITHUB_TOKEN" },
          },
          "anthropic:default": {
            type: "api_key",
            provider: "anthropic",
            key: "sk-anthropic-plain",
          },
        },
      };

      saveAuthProfileStore(store, agentDir);

      const parsed = JSON.parse(await fs.readFile(resolveAuthStorePath(agentDir), "utf8")) as {
        profiles: Record<
          string,
          { key?: string; keyRef?: unknown; token?: string; tokenRef?: unknown }
        >;
      };

      // keyRef profiles should not persist plaintext key
      expect(parsed.profiles["openai:default"]?.key).toBeUndefined();
      expect(parsed.profiles["openai:default"]?.keyRef).toEqual({
        source: "env",
        provider: "default",
        id: "OPENAI_API_KEY",
      });

      // tokenRef profiles should not persist plaintext token
      expect(parsed.profiles["github-copilot:default"]?.token).toBeUndefined();
      expect(parsed.profiles["github-copilot:default"]?.tokenRef).toEqual({
        source: "env",
        provider: "default",
        id: "GITHUB_TOKEN",
      });

      // plain api_key without ref should persist as-is
      expect(parsed.profiles["anthropic:default"]?.key).toBe("sk-anthropic-plain");
    } finally {
      await fs.rm(agentDir, { recursive: true, force: true });
    }
  });

  it("writes valid JSON to the store path", async () => {
    const agentDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-auth-json-"));
    try {
      const store: AuthProfileStore = {
        version: 1,
        profiles: {
          "openai:default": {
            type: "api_key",
            provider: "openai",
            key: "sk-test",
          },
        },
      };

      saveAuthProfileStore(store, agentDir);

      const storePath = resolveAuthStorePath(agentDir);
      const content = await fs.readFile(storePath, "utf8");
      const parsed = JSON.parse(content);
      expect(parsed.version).toBe(1);
      expect(parsed.profiles["openai:default"]).toBeDefined();
    } finally {
      await fs.rm(agentDir, { recursive: true, force: true });
    }
  });

  it("preserves usageStats during save", async () => {
    const agentDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-auth-stats-"));
    try {
      const now = Date.now();
      const store: AuthProfileStore = {
        version: 1,
        profiles: {
          "openai:default": {
            type: "api_key",
            provider: "openai",
            key: "sk-test",
          },
        },
        usageStats: {
          "openai:default": {
            lastUsed: now,
            errorCount: 2,
          },
        },
      };

      saveAuthProfileStore(store, agentDir);

      const parsed = JSON.parse(
        await fs.readFile(resolveAuthStorePath(agentDir), "utf8"),
      ) as AuthProfileStore;
      expect(parsed.usageStats?.["openai:default"]?.lastUsed).toBe(now);
      expect(parsed.usageStats?.["openai:default"]?.errorCount).toBe(2);
    } finally {
      await fs.rm(agentDir, { recursive: true, force: true });
    }
  });
});
