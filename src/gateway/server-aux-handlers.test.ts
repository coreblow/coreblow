import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import {
  activateSecretsRuntimeSnapshot,
  clearSecretsRuntimeSnapshot,
  getActiveSecretsRuntimeSnapshot,
  type PreparedSecretsRuntimeSnapshot,
} from "../secrets/runtime.js";
import type { GatewayReloadPlan } from "./config-reload.js";
import { createGatewayAuxHandlers, GATEWAY_AUX_METHODS } from "./server-aux-handlers.js";

function asConfig(value: unknown): CoreBlowConfig {
  return value as CoreBlowConfig;
}

function createReloadPlan(overrides?: Partial<GatewayReloadPlan>): GatewayReloadPlan {
  return {
    changedPaths: overrides?.changedPaths ?? [],
    restartGateway: overrides?.restartGateway ?? false,
    restartReasons: overrides?.restartReasons ?? [],
    hotReasons: overrides?.hotReasons ?? [],
    reloadHooks: overrides?.reloadHooks ?? false,
    restartGmailWatcher: overrides?.restartGmailWatcher ?? false,
    restartCron: overrides?.restartCron ?? false,
    restartHeartbeat: overrides?.restartHeartbeat ?? false,
    restartHealthMonitor: overrides?.restartHealthMonitor ?? false,
    restartChannels: overrides?.restartChannels ?? new Set(),
    noopPaths: overrides?.noopPaths ?? [],
  };
}

function createSnapshot(config: CoreBlowConfig): PreparedSecretsRuntimeSnapshot {
  return {
    sourceConfig: asConfig({}),
    config,
    authStores: [],
    warnings: [],
    webTools: {
      search: { providerSource: "none", diagnostics: [] },
      fetch: {
        firecrawl: {
          active: false,
          apiKeySource: "missing",
          diagnostics: [],
        },
      },
      diagnostics: [],
    },
  };
}

async function invokeSecretsReload(params: {
  handlers: ReturnType<typeof createGatewayAuxHandlers>["extraHandlers"];
  respond: ReturnType<typeof vi.fn>;
}) {
  await params.handlers["secrets.reload"]({
    req: { type: "req", id: "1", method: "secrets.reload" },
    params: {},
    client: null,
    isWebchatConnect: () => false,
    respond: params.respond as Parameters<
      ReturnType<typeof createGatewayAuxHandlers>["extraHandlers"]["secrets.reload"]
    >[0]["respond"],
    context: {} as never,
  });
}

beforeEach(() => {
  delete process.env.COREBLOW_SKIP_CHANNELS;
  delete process.env.COREBLOW_SKIP_PROVIDERS;
});

afterEach(() => {
  clearSecretsRuntimeSnapshot();
  delete process.env.COREBLOW_SKIP_CHANNELS;
  delete process.env.COREBLOW_SKIP_PROVIDERS;
});

describe("gateway aux handlers", () => {
  it("exports the CoreBlow aux method surface", () => {
    expect(GATEWAY_AUX_METHODS).toEqual([
      "exec.approval.request",
      "exec.approval.waitDecision",
      "exec.approval.resolve",
      "plugin.approval.request",
      "plugin.approval.waitDecision",
      "plugin.approval.resolve",
      "secrets.reload",
      "secrets.resolve",
    ]);
  });

  it("restarts only channels whose resolved secret-backed config changed on secrets.reload", async () => {
    const buildReloadPlanCalls: string[][] = [];
    const buildReloadPlan = (changedPaths: string[]) => {
      buildReloadPlanCalls.push([...changedPaths]);
      return createReloadPlan({
        restartChannels: new Set(["slack", "discord"]),
      });
    };
    activateSecretsRuntimeSnapshot(
      createSnapshot(
        asConfig({
          channels: {
            slack: { signingSecret: "old-slack-secret" },
            discord: { token: "old-discord-token" },
            telegram: { token: "unchanged-telegram-token" },
          },
        }),
      ),
    );
    const prepared = createSnapshot(
      asConfig({
        channels: {
          slack: { signingSecret: "new-slack-secret" },
          discord: { token: "new-discord-token" },
          telegram: { token: "unchanged-telegram-token" },
        },
      }),
    );
    const activateRuntimeSecrets = vi.fn().mockImplementation(async () => {
      activateSecretsRuntimeSnapshot(prepared);
      return prepared;
    });
    const stopChannel = vi.fn().mockResolvedValue(undefined);
    const startChannel = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn();

    const { extraHandlers } = createGatewayAuxHandlers({
      log: {},
      activateRuntimeSecrets,
      buildReloadPlan,
      startChannel,
      stopChannel,
      logChannels: { info: vi.fn() },
    });

    await invokeSecretsReload({ handlers: extraHandlers, respond });

    expect(activateRuntimeSecrets).toHaveBeenCalledTimes(1);
    expect(buildReloadPlanCalls).toEqual([["channels.slack.signingSecret", "channels.discord.token"]]);
    expect(stopChannel.mock.calls.map(([ch]) => ch).toSorted()).toEqual(["discord", "slack"]);
    expect(startChannel.mock.calls.map(([ch]) => ch).toSorted()).toEqual(["discord", "slack"]);
    expect(respond).toHaveBeenCalledWith(true, { ok: true, warningCount: 0 });
  });

  it("coalesces concurrent secrets.reload calls so channels are not restarted twice", async () => {
    activateSecretsRuntimeSnapshot(
      createSnapshot(asConfig({ channels: { slack: { signingSecret: "old" } } })),
    );
    const prepared = createSnapshot(asConfig({ channels: { slack: { signingSecret: "new" } } }));
    const activationOrder: string[] = [];
    const activateRuntimeSecrets = vi.fn().mockImplementation(async () => {
      activationOrder.push("start");
      await Promise.resolve();
      await Promise.resolve();
      activateSecretsRuntimeSnapshot(prepared);
      activationOrder.push("end");
      return prepared;
    });
    const stopChannel = vi.fn().mockResolvedValue(undefined);
    const startChannel = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn();

    const { extraHandlers } = createGatewayAuxHandlers({
      log: {},
      activateRuntimeSecrets,
      buildReloadPlan: () => createReloadPlan({ restartChannels: new Set(["slack"]) }),
      startChannel,
      stopChannel,
      logChannels: { info: vi.fn() },
    });

    await Promise.all([
      invokeSecretsReload({ handlers: extraHandlers, respond }),
      invokeSecretsReload({ handlers: extraHandlers, respond }),
    ]);

    expect(activationOrder).toEqual(["start", "end"]);
    expect(activateRuntimeSecrets).toHaveBeenCalledTimes(1);
    expect(stopChannel.mock.calls).toEqual([["slack"]]);
    expect(startChannel.mock.calls).toEqual([["slack"]]);
    expect(respond).toHaveBeenNthCalledWith(1, true, { ok: true, warningCount: 0 });
    expect(respond).toHaveBeenNthCalledWith(2, true, { ok: true, warningCount: 0 });
  });

  it("rolls back stopped channels when a later restart fails", async () => {
    const initial = createSnapshot(
      asConfig({
        channels: {
          slack: { signingSecret: "old-slack-secret" },
          discord: { token: "old-discord-token" },
        },
      }),
    );
    activateSecretsRuntimeSnapshot(initial);
    const prepared = createSnapshot(
      asConfig({
        channels: {
          slack: { signingSecret: "new-slack-secret" },
          discord: { token: "new-discord-token" },
        },
      }),
    );
    const activateRuntimeSecrets = vi.fn().mockResolvedValue(prepared);
    const stopChannel = vi.fn().mockResolvedValue(undefined);
    const startChannel = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("discord refused to start"))
      .mockResolvedValue(undefined);
    const respond = vi.fn();

    const { extraHandlers } = createGatewayAuxHandlers({
      log: {},
      activateRuntimeSecrets,
      buildReloadPlan: () =>
        createReloadPlan({ restartChannels: new Set(["slack", "discord"]) }),
      startChannel,
      stopChannel,
      logChannels: { info: vi.fn() },
    });

    await invokeSecretsReload({ handlers: extraHandlers, respond });

    expect(stopChannel.mock.calls).toEqual([["slack"], ["discord"], ["slack"]]);
    expect(startChannel.mock.calls).toEqual([["slack"], ["discord"], ["slack"], ["discord"]]);
    expect(respond.mock.calls[0]?.[0]).toBe(false);
    expect(getActiveSecretsRuntimeSnapshot()?.config).toEqual(initial.config);
  });

  it("fails reload when channel restarts are required but skip flags block them", async () => {
    process.env.COREBLOW_SKIP_CHANNELS = "1";
    const initial = createSnapshot(
      asConfig({ channels: { slack: { signingSecret: "old-slack-secret" } } }),
    );
    activateSecretsRuntimeSnapshot(initial);
    const prepared = createSnapshot(
      asConfig({ channels: { slack: { signingSecret: "new-slack-secret" } } }),
    );
    const activateRuntimeSecrets = vi.fn().mockResolvedValue(prepared);
    const stopChannel = vi.fn().mockResolvedValue(undefined);
    const startChannel = vi.fn().mockResolvedValue(undefined);
    const respond = vi.fn();

    const { extraHandlers } = createGatewayAuxHandlers({
      log: {},
      activateRuntimeSecrets,
      buildReloadPlan: () => createReloadPlan({ restartChannels: new Set(["slack"]) }),
      startChannel,
      stopChannel,
      logChannels: { info: vi.fn() },
    });

    await invokeSecretsReload({ handlers: extraHandlers, respond });

    expect(stopChannel).not.toHaveBeenCalled();
    expect(startChannel).not.toHaveBeenCalled();
    expect(respond.mock.calls[0]?.[0]).toBe(false);
    expect(getActiveSecretsRuntimeSnapshot()?.config).toEqual(initial.config);
  });
});
