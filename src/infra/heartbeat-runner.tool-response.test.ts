import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createHeartbeatToolResponsePayload,
  type HeartbeatToolResponse,
} from "../auto-reply/heartbeat-tool-response.js";
import {
  loadSessionStore,
  resolveMainSessionKey,
} from "../config/sessions.js";
import {
  GENERIC_EXTERNAL_RUN_FAILURE_TEXT,
  HEARTBEAT_EXTERNAL_RUN_FAILURE_TEXT,
} from "../auto-reply/reply/agent-runner-failure-copy.js";
import { markReplyPayloadForSourceSuppressionDelivery } from "../auto-reply/types.js";
import type { CoreBlowConfig } from "../config/config.js";
import { getLastHeartbeatEvent, resetHeartbeatEventsForTest } from "./heartbeat-events.js";
import { runHeartbeatOnce, type HeartbeatDeps } from "./heartbeat-runner.js";
import { installHeartbeatRunnerTestRuntime } from "./heartbeat-runner.test-harness.js";
import {
  seedMainSessionStore,
  withTempTelegramHeartbeatSandbox,
} from "./heartbeat-runner.test-utils.js";

installHeartbeatRunnerTestRuntime();

describe("runHeartbeatOnce heartbeat response tool", () => {
  const TELEGRAM_GROUP = "-1001234567890";

  afterEach(() => {
    resetHeartbeatEventsForTest();
  });

  function createConfig(params: {
    tmpDir: string;
    storePath: string;
    visibleReplies?: "automatic" | "message_tool";
  }): CoreBlowConfig {
    return {
      agents: {
        defaults: {
          workspace: params.tmpDir,
          heartbeat: { every: "5m", target: "telegram" },
        },
      },
      ...(params.visibleReplies ? { messages: { visibleReplies: params.visibleReplies } } : {}),
      channels: {
        telegram: {
          token: "test-token",
          allowFrom: ["*"],
          heartbeat: { showOk: false },
        },
      },
      session: { store: params.storePath },
    } as CoreBlowConfig;
  }

  function createDeps(params: {
    sendTelegram: ReturnType<typeof vi.fn>;
    getReplyFromConfig: HeartbeatDeps["getReplyFromConfig"];
    nowMs?: () => number;
  }): HeartbeatDeps {
    return {
      telegram: params.sendTelegram as unknown,
      getQueueSize: () => 0,
      nowMs: params.nowMs ?? (() => 0),
      getReplyFromConfig: params.getReplyFromConfig,
    };
  }

  function expectTelegramSend(sendTelegram: ReturnType<typeof vi.fn>, text: string) {
    expect(sendTelegram).toHaveBeenCalledTimes(1);
    expect(sendTelegram.mock.calls[0]?.[0]).toBe(TELEGRAM_GROUP);
    expect(sendTelegram.mock.calls[0]?.[1]).toBe(text);
  }

  function replyCall(replySpy: ReturnType<typeof vi.spyOn>): unknown[] {
    const call = replySpy.mock.calls[0];
    if (!call) {
      throw new Error("Expected reply call");
    }
    return call;
  }

  function replyContext(replySpy: ReturnType<typeof vi.spyOn>): { Body?: string } {
    const context = replyCall(replySpy)[0];
    if (!context || typeof context !== "object") {
      throw new Error("Expected reply context");
    }
    return context as { Body?: string };
  }

  function replyOptions(replySpy: ReturnType<typeof vi.spyOn>): {
    enableHeartbeatTool?: boolean;
    forceHeartbeatTool?: boolean;
    sourceReplyDeliveryMode?: string;
  } {
    const options = replyCall(replySpy)[1];
    if (!options || typeof options !== "object") {
      throw new Error("Expected reply options");
    }
    return options as {
      enableHeartbeatTool?: boolean;
      forceHeartbeatTool?: boolean;
      sourceReplyDeliveryMode?: string;
    };
  }

  async function runWithToolResponse(response: HeartbeatToolResponse) {
    return await withTempTelegramHeartbeatSandbox(async ({ tmpDir, storePath, replySpy }) => {
      const cfg = createConfig({ tmpDir, storePath });
      await seedMainSessionStore(storePath, cfg, {
        lastChannel: "telegram",
        lastProvider: "telegram",
        lastTo: TELEGRAM_GROUP,
      });
      replySpy.mockResolvedValue(createHeartbeatToolResponsePayload(response));
      const sendTelegram = vi.fn().mockResolvedValue({ messageId: "m1" });

      const result = await runHeartbeatOnce({
        cfg,
        deps: createDeps({ sendTelegram, getReplyFromConfig: replySpy }),
      });

      return { result, sendTelegram, replySpy, cfg };
    });
  }

  async function runPromptScenario(params: {
    visibleReplies?: "automatic" | "message_tool";
    session?: Record<string, unknown>;
  }) {
    return await withTempTelegramHeartbeatSandbox(async ({ tmpDir, storePath, replySpy }) => {
      const cfg = createConfig({
        tmpDir,
        storePath,
        visibleReplies: params.visibleReplies,
      });
      await seedMainSessionStore(storePath, cfg, {
        lastChannel: "telegram",
        lastProvider: "telegram",
        lastTo: TELEGRAM_GROUP,
        ...params.session,
      });
      replySpy.mockResolvedValue(
        createHeartbeatToolResponsePayload({
          outcome: "no_change",
          notify: false,
          summary: "Nothing needs attention.",
        }),
      );
      const sendTelegram = vi.fn().mockResolvedValue({ messageId: "m1" });

      await runHeartbeatOnce({
        cfg,
        deps: createDeps({ sendTelegram, getReplyFromConfig: replySpy }),
      });

      return {
        calledCtx: replyContext(replySpy),
        calledOpts: replyOptions(replySpy),
      };
    });
  }

  function expectHeartbeatToolPrompt(result: Awaited<ReturnType<typeof runPromptScenario>>) {
    expect(result.calledCtx.Body).toContain("heartbeat_respond");
    expect(result.calledCtx.Body).toContain("notify=false");
    expect(result.calledCtx.Body).not.toContain("HEARTBEAT_OK");
    expect(result.calledOpts.enableHeartbeatTool).toBe(true);
    expect(result.calledOpts.forceHeartbeatTool).toBe(true);
    expect(result.calledOpts.sourceReplyDeliveryMode).toBe("message_tool_only");
  }

  it("treats notify=false as a quiet heartbeat ack", async () => {
    const { result, sendTelegram } = await runWithToolResponse({
      outcome: "no_change",
      notify: false,
      summary: "Nothing needs attention.",
    });

    expect(result.status).toBe("ran");
    expect(sendTelegram).not.toHaveBeenCalled();
  });

  it("delivers notificationText when notify=true", async () => {
    const { sendTelegram } = await runWithToolResponse({
      outcome: "needs_attention",
      notify: true,
      summary: "Build is blocked.",
      notificationText: "Build is blocked on missing credentials.",
      priority: "high",
    });

    expectTelegramSend(sendTelegram, "Build is blocked on missing credentials.");
  });

  it("uses the heartbeat response tool prompt in message-tool mode", async () => {
    const result = await runPromptScenario({ visibleReplies: "message_tool" });

    expectHeartbeatToolPrompt(result);
  });

  it("uses the heartbeat response tool prompt for due heartbeat tasks", async () => {
    await withTempTelegramHeartbeatSandbox(async ({ tmpDir, storePath, replySpy }) => {
      await fs.writeFile(
        path.join(tmpDir, "HEARTBEAT.md"),
        `
tasks:
  - name: deploy-status
    interval: 5m
    prompt: Check deployment status

Only notify for urgent changes.
`,
        "utf-8",
      );
      const cfg = createConfig({
        tmpDir,
        storePath,
        visibleReplies: "message_tool",
      });
      await seedMainSessionStore(storePath, cfg, {
        lastChannel: "telegram",
        lastProvider: "telegram",
        lastTo: TELEGRAM_GROUP,
      });
      replySpy.mockResolvedValue(
        createHeartbeatToolResponsePayload({
          outcome: "no_change",
          notify: false,
          summary: "Nothing needs attention.",
        }),
      );
      const sendTelegram = vi.fn().mockResolvedValue({ messageId: "m1" });

      const result = await runHeartbeatOnce({
        cfg,
        deps: createDeps({
          sendTelegram,
          getReplyFromConfig: replySpy,
          nowMs: () => 600_000,
        }),
      });

      expect(result.status).toBe("ran");
      expect(sendTelegram).not.toHaveBeenCalled();
      const sessionKey = resolveMainSessionKey(cfg);
      const store = loadSessionStore(storePath);
      expect(store[sessionKey]?.heartbeatTaskState?.["deploy-status"]).toBe(600_000);
      const calledCtx = replyContext(replySpy);
      const calledOpts = replyOptions(replySpy);
      expect(calledCtx.Body).toContain("Run the following periodic tasks");
      expect(calledCtx.Body).toContain("- deploy-status: Check deployment status");
      expect(calledCtx.Body).toContain("Only notify for urgent changes.");
      expect(calledCtx.Body).toContain("heartbeat_respond");
      expect(calledCtx.Body).toContain("notify=false");
      expect(calledCtx.Body).not.toContain("HEARTBEAT_OK");
      expect(calledOpts.enableHeartbeatTool).toBe(true);
      expect(calledOpts.forceHeartbeatTool).toBe(true);
      expect(calledOpts.sourceReplyDeliveryMode).toBe("message_tool_only");
    });
  });

  it("skips heartbeat task runs when no tasks are due", async () => {
    await withTempTelegramHeartbeatSandbox(async ({ tmpDir, storePath, replySpy }) => {
      await fs.writeFile(
        path.join(tmpDir, "HEARTBEAT.md"),
        `
tasks:
  - name: deploy-status
    interval: 5m
    prompt: Check deployment status
`,
        "utf-8",
      );
      const cfg = createConfig({
        tmpDir,
        storePath,
        visibleReplies: "message_tool",
      });
      await seedMainSessionStore(storePath, cfg, {
        lastChannel: "telegram",
        lastProvider: "telegram",
        lastTo: TELEGRAM_GROUP,
        heartbeatTaskState: { "deploy-status": 0 },
      });
      const sendTelegram = vi.fn().mockResolvedValue({ messageId: "m1" });

      const result = await runHeartbeatOnce({
        cfg,
        deps: createDeps({
          sendTelegram,
          getReplyFromConfig: replySpy,
          nowMs: () => 60_000,
        }),
      });

      expect(result).toEqual({ status: "skipped", reason: "no-tasks-due" });
      expect(replySpy).not.toHaveBeenCalled();
      expect(sendTelegram).not.toHaveBeenCalled();
    });
  });

  it("uses the heartbeat response tool prompt for Codex harness sessions by default", async () => {
    const result = await runPromptScenario({
      session: { agentHarnessId: "codex" },
    });

    expectHeartbeatToolPrompt(result);
  });

  it("rewrites foreground generic runner failure payloads before heartbeat delivery", async () => {
    await withTempTelegramHeartbeatSandbox(async ({ tmpDir, storePath, replySpy }) => {
      const cfg = createConfig({ tmpDir, storePath });
      await seedMainSessionStore(storePath, cfg, {
        lastChannel: "telegram",
        lastProvider: "telegram",
        lastTo: TELEGRAM_GROUP,
      });
      replySpy.mockResolvedValue(
        markReplyPayloadForSourceSuppressionDelivery({
          text: GENERIC_EXTERNAL_RUN_FAILURE_TEXT,
        }),
      );
      const sendTelegram = vi.fn().mockResolvedValue({ messageId: "m1" });

      const result = await runHeartbeatOnce({
        cfg,
        deps: createDeps({ sendTelegram, getReplyFromConfig: replySpy }),
      });

      expect(result.status).toBe("ran");
      expectTelegramSend(sendTelegram, HEARTBEAT_EXTERNAL_RUN_FAILURE_TEXT);
      expect(HEARTBEAT_EXTERNAL_RUN_FAILURE_TEXT).not.toContain("/new");
      expect(getLastHeartbeatEvent()).toMatchObject({
        status: "failed",
        reason: "agent-runner-failure",
        preview: HEARTBEAT_EXTERNAL_RUN_FAILURE_TEXT,
        channel: "telegram",
      });
    });
  });

  it("keeps the legacy heartbeat ok prompt outside heartbeat response tool mode", async () => {
    const result = await runPromptScenario({ visibleReplies: "automatic" });

    expect(result.calledCtx.Body).toContain("HEARTBEAT_OK");
    expect(result.calledCtx.Body).not.toContain("heartbeat_respond");
    expect(result.calledOpts.enableHeartbeatTool).toBeUndefined();
    expect(result.calledOpts.forceHeartbeatTool).toBeUndefined();
    expect(result.calledOpts.sourceReplyDeliveryMode).toBeUndefined();
  });
});
