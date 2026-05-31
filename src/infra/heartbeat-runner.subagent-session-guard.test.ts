import fs from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveMainSessionKey } from "../config/sessions.js";
import { runHeartbeatOnce } from "./heartbeat-runner.js";
import { withTempHeartbeatSandbox } from "./heartbeat-runner.test-utils.js";

vi.mock("./outbound/deliver.js", () => ({
  deliverOutboundPayloads: vi.fn().mockResolvedValue(undefined),
}));

function requireFirstMockCall<T>(mock: { mock: { calls: T[][] } }, label: string): T[] {
  const call = mock.mock.calls[0];
  if (!call) {
    throw new Error(`expected ${label} call`);
  }
  return call;
}

type HeartbeatReplyContext = {
  SessionKey?: string;
  OriginatingChannel?: string;
  OriginatingTo?: string;
};

describe("runHeartbeatOnce subagent session guard", () => {
  it("falls back to the main session when a subagent session key is forced", async () => {
    await withTempHeartbeatSandbox(async ({ tmpDir, storePath, replySpy }) => {
      const cfg: CoreBlowConfig = {
        agents: {
          defaults: {
            workspace: tmpDir,
            heartbeat: {
              every: "5m",
              target: "whatsapp",
            },
          },
        },
        channels: {
          whatsapp: {
            allowFrom: ["*"],
          },
        },
        session: { store: storePath },
      } as CoreBlowConfig;

      const mainSessionKey = resolveMainSessionKey(cfg);
      await fs.writeFile(
        storePath,
        JSON.stringify({
          [mainSessionKey]: {
            sessionId: "sid-main",
            updatedAt: Date.now(),
            lastChannel: "whatsapp",
            lastProvider: "whatsapp",
            lastTo: "120363401234567890@g.us",
          },
          "agent:main:subagent:demo": {
            sessionId: "sid-subagent",
            updatedAt: Date.now(),
            lastChannel: "whatsapp",
            lastProvider: "whatsapp",
            lastTo: "120363409999999999@g.us",
          },
        }),
      );

      replySpy.mockResolvedValue({ text: "Final alert" });

      await runHeartbeatOnce({
        cfg,
        sessionKey: "agent:main:subagent:demo",
        deps: {
          getReplyFromConfig: replySpy,
          getQueueSize: () => 0,
          nowMs: () => 0,
        },
      });

      expect(replySpy).toHaveBeenCalledTimes(1);
      const [replyParams, _replyRuntime, replyConfig] = requireFirstMockCall<unknown>(
        replySpy,
        "reply",
      );
      const replyContext = replyParams as HeartbeatReplyContext;
      expect(replyContext.SessionKey).toBe(mainSessionKey);
      expect(replyContext.OriginatingChannel).toBeUndefined();
      expect(replyContext.OriginatingTo).toBeUndefined();
      expect(replyConfig).toBe(cfg);
    });
  });
});
