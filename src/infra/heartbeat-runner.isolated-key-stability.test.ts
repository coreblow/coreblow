import fs from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as replyModule from "../auto-reply/reply.js";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveMainSessionKey } from "../config/sessions.js";
import { runHeartbeatOnce } from "./heartbeat-runner.js";
import { seedSessionStore, withTempHeartbeatSandbox } from "./heartbeat-runner.test-utils.js";

vi.mock("./outbound/deliver.js", () => ({
  deliverOutboundPayloads: vi.fn().mockResolvedValue(undefined),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

type HeartbeatReplyContext = {
  SessionKey?: string;
};

function replyCall(replySpy: { mock: { calls: unknown[][] } }, index = 0): HeartbeatReplyContext {
  return (replySpy.mock.calls[index]?.at(0) ?? {}) as HeartbeatReplyContext;
}

describe("runHeartbeatOnce isolated session key stability", () => {
  function makeIsolatedHeartbeatConfig(
    tmpDir: string,
    storePath: string,
    heartbeatSession?: string,
  ): CoreBlowConfig {
    return {
      agents: {
        defaults: {
          workspace: tmpDir,
          heartbeat: {
            every: "5m",
            target: "whatsapp",
            isolatedSession: true,
            ...(heartbeatSession ? { session: heartbeatSession } : {}),
          },
        },
      },
      channels: { whatsapp: { allowFrom: ["*"] } },
      session: { store: storePath },
    } as CoreBlowConfig;
  }

  async function runIsolatedHeartbeat(params: {
    cfg: CoreBlowConfig;
    sessionKey?: string;
  }) {
    const replySpy = vi.spyOn(replyModule, "getReplyFromConfig");
    replySpy.mockResolvedValue({ text: "HEARTBEAT_OK" });

    await runHeartbeatOnce({
      cfg: params.cfg,
      sessionKey: params.sessionKey,
      deps: {
        getQueueSize: () => 0,
        nowMs: () => Date.now(),
      },
    });

    expect(replySpy).toHaveBeenCalledTimes(1);
    return replyCall(replySpy);
  }

  it("does not accumulate heartbeat suffix when wake passes an already isolated key", async () => {
    await withTempHeartbeatSandbox(async ({ tmpDir, storePath }) => {
      const cfg = makeIsolatedHeartbeatConfig(tmpDir, storePath);
      const baseSessionKey = resolveMainSessionKey(cfg);
      const isolatedSessionKey = `${baseSessionKey}:heartbeat`;
      await fs.writeFile(
        storePath,
        JSON.stringify({
          [isolatedSessionKey]: {
            sessionId: "sid",
            updatedAt: Date.now(),
            lastChannel: "whatsapp",
            lastProvider: "whatsapp",
            lastTo: "+1555",
            heartbeatIsolatedBaseSessionKey: baseSessionKey,
          },
        }),
        "utf-8",
      );

      const ctx = await runIsolatedHeartbeat({ cfg, sessionKey: isolatedSessionKey });

      expect(ctx.SessionKey).toBe(isolatedSessionKey);
    });
  });

  it("collapses previously accumulated heartbeat suffixes in one run", async () => {
    await withTempHeartbeatSandbox(async ({ tmpDir, storePath }) => {
      const cfg = makeIsolatedHeartbeatConfig(tmpDir, storePath);
      const baseSessionKey = resolveMainSessionKey(cfg);
      const accumulatedSessionKey = `${baseSessionKey}:heartbeat:heartbeat:heartbeat`;
      await seedSessionStore(storePath, accumulatedSessionKey, {
        lastChannel: "whatsapp",
        lastProvider: "whatsapp",
        lastTo: "+1555",
      });

      const ctx = await runIsolatedHeartbeat({ cfg, sessionKey: accumulatedSessionKey });

      expect(ctx.SessionKey).toBe(`${baseSessionKey}:heartbeat`);
      const store = JSON.parse(await fs.readFile(storePath, "utf-8")) as Record<
        string,
        { heartbeatIsolatedBaseSessionKey?: string }
      >;
      expect(store[accumulatedSessionKey]).toBeUndefined();
      expect(store[`${baseSessionKey}:heartbeat`]?.heartbeatIsolatedBaseSessionKey).toBe(
        baseSessionKey,
      );
    });
  });

  it("keeps configured base keys that already end with heartbeat distinct", async () => {
    await withTempHeartbeatSandbox(async ({ tmpDir, storePath }) => {
      const cfg = makeIsolatedHeartbeatConfig(tmpDir, storePath, "alerts:heartbeat");
      const baseSessionKey = "agent:main:alerts:heartbeat";
      await seedSessionStore(storePath, baseSessionKey, {
        lastChannel: "whatsapp",
        lastProvider: "whatsapp",
        lastTo: "+1555",
      });

      const ctx = await runIsolatedHeartbeat({ cfg, sessionKey: baseSessionKey });

      expect(ctx.SessionKey).toBe(`${baseSessionKey}:heartbeat`);
    });
  });
});
