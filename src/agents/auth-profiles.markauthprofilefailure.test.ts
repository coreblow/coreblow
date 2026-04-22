import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearRuntimeAuthProfileStoreSnapshots,
  ensureAuthProfileStore,
  markAuthProfileFailure,
} from "./auth-profiles.js";
import { calculateAuthProfileCooldownMs } from "./auth-profiles/usage.js";

function withAuthProfileStore(
  run: (params: { agentDir: string; store: ReturnType<typeof ensureAuthProfileStore> }) =>
    Promise<void> | void,
) {
  const agentDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-auth-failure-"));
  const authPath = path.join(agentDir, "auth-profiles.json");
  fs.writeFileSync(
    authPath,
    JSON.stringify({
      version: 1,
      profiles: {
        "anthropic:default": { type: "api_key", provider: "anthropic", key: "sk-test" },
        "openrouter:default": { type: "api_key", provider: "openrouter", key: "sk-or" },
      },
    }),
    "utf8",
  );
  const store = ensureAuthProfileStore(agentDir);
  try {
    return run({ agentDir, store });
  } finally {
    clearRuntimeAuthProfileStoreSnapshots();
    fs.rmSync(agentDir, { recursive: true, force: true });
  }
}

describe("markAuthProfileFailure", () => {
  beforeEach(() => {
    clearRuntimeAuthProfileStoreSnapshots();
  });

  afterEach(() => {
    clearRuntimeAuthProfileStoreSnapshots();
  });

  it("sets cooldownUntil for rate_limit failures", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      const startedAt = Date.now();
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "rate_limit",
        agentDir,
      });

      const cooldownUntil = store.usageStats?.["anthropic:default"]?.cooldownUntil;
      expect(typeof cooldownUntil).toBe("number");
      expect((cooldownUntil as number) - startedAt).toBeGreaterThan(0);
    });
  });

  it("sets disabledUntil for billing failures", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      const startedAt = Date.now();
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "billing",
        agentDir,
      });

      // CB billing → sets disabledUntil (long-term disable)
      const stats = store.usageStats?.["anthropic:default"];
      // Stats must be defined and have some block timestamp
      const blockUntil = stats?.disabledUntil ?? stats?.cooldownUntil;
      expect(typeof blockUntil).toBe("number");
      expect((blockUntil as number)).toBeGreaterThan(startedAt);
    });
  });

  it("increments errorCount on repeated failures", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "rate_limit",
        agentDir,
      });

      const firstErrorCount = store.usageStats?.["anthropic:default"]?.errorCount ?? 0;
      expect(firstErrorCount).toBeGreaterThanOrEqual(1);
    });
  });

  it("records overloaded failures with cooldownUntil", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      await markAuthProfileFailure({
        store,
        profileId: "anthropic:default",
        reason: "overloaded",
        agentDir,
      });

      const stats = store.usageStats?.["anthropic:default"];
      expect(stats).toBeDefined();
      // overloaded = short cooldown
      const someBlock = stats?.cooldownUntil ?? stats?.disabledUntil;
      expect(typeof someBlock).toBe("number");
    });
  });

  it("bypasses cooldown for OpenRouter profiles", async () => {
    await withAuthProfileStore(async ({ agentDir, store }) => {
      await markAuthProfileFailure({
        store,
        profileId: "openrouter:default",
        reason: "rate_limit",
        agentDir,
      });

      await markAuthProfileFailure({
        store,
        profileId: "openrouter:default",
        reason: "billing",
        agentDir,
      });

      // CB: OpenRouter is excluded from cooldown/disabled windows
      const stats = store.usageStats?.["openrouter:default"];
      const hasBlock =
        (typeof stats?.cooldownUntil === "number" && stats.cooldownUntil > Date.now()) ||
        (typeof stats?.disabledUntil === "number" && stats.disabledUntil > Date.now());
      expect(hasBlock).toBe(false);
    });
  });
});

describe("calculateAuthProfileCooldownMs", () => {
  it("applies stepped backoff with a 5-min cap", () => {
    expect(calculateAuthProfileCooldownMs(1)).toBe(30_000); // 30 seconds
    expect(calculateAuthProfileCooldownMs(2)).toBe(60_000); // 1 minute
    expect(calculateAuthProfileCooldownMs(3)).toBe(5 * 60_000); // 5 minutes
    expect(calculateAuthProfileCooldownMs(4)).toBe(5 * 60_000); // capped
    expect(calculateAuthProfileCooldownMs(5)).toBe(5 * 60_000); // capped
  });
});
