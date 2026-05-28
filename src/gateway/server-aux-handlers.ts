import type { CoreBlowConfig } from "../config/config.js";
import { isTruthyEnvValue } from "../infra/env.js";
import { createExecApprovalForwarder } from "../infra/exec-approval-forwarder.js";
import type { PluginApprovalRequestPayload } from "../infra/plugin-approvals.js";
import {
  activateSecretsRuntimeSnapshot,
  getActiveSecretsRuntimeSnapshot,
  resolveCommandSecretsFromActiveRuntimeSnapshot,
  type PreparedSecretsRuntimeSnapshot,
} from "../secrets/runtime.js";
import { diffConfigPaths } from "./config-diff.js";
import {
  buildGatewayReloadPlan,
  type ChannelKind,
  type GatewayReloadPlan,
} from "./config-reload-plan.js";
import { ExecApprovalManager } from "./exec-approval-manager.js";
import type { GatewayRequestHandler, GatewayRequestHandlers } from "./server-methods/types.js";

export { GATEWAY_AUX_METHODS } from "./server-aux-methods.js";

type GatewayAuxHandlerLogger = {
  warn?: (message: string) => void;
  error?: (message: string) => void;
  debug?: (message: string) => void;
};

type ReloadSecretsResult = {
  warningCount: number;
};

export type ActivateRuntimeSecrets = (
  config: CoreBlowConfig,
  params: { reason: "startup" | "reload" | "restart-check"; activate: boolean },
) => Promise<PreparedSecretsRuntimeSnapshot>;

function createLazyHandler(
  method: string,
  loadHandlers: () => Promise<GatewayRequestHandlers>,
): GatewayRequestHandler {
  return async (opts) => {
    const handlers = await loadHandlers();
    const handler = handlers[method];
    if (!handler) {
      throw new Error(`lazy gateway handler not found: ${method}`);
    }
    await handler(opts);
  };
}

async function restoreSecretsRuntimeSnapshot(snapshot: PreparedSecretsRuntimeSnapshot) {
  activateSecretsRuntimeSnapshot(snapshot);
}

export function createGatewayAuxHandlers(params: {
  log: GatewayAuxHandlerLogger;
  activateRuntimeSecrets: ActivateRuntimeSecrets;
  buildReloadPlan?: (changedPaths: string[]) => GatewayReloadPlan;
  startChannel: (name: ChannelKind) => Promise<void>;
  stopChannel: (name: ChannelKind) => Promise<void>;
  logChannels: { info: (msg: string) => void };
}) {
  const execApprovalManager = new ExecApprovalManager();
  const execApprovalForwarder = createExecApprovalForwarder();
  let execApprovalHandlersPromise: Promise<GatewayRequestHandlers> | null = null;
  const loadExecApprovalHandlers = () =>
    (execApprovalHandlersPromise ??= import("./server-methods/exec-approval.js").then(
      ({ createExecApprovalHandlers }) =>
        createExecApprovalHandlers(execApprovalManager, {
          forwarder: execApprovalForwarder,
        }),
    ));

  const pluginApprovalManager = new ExecApprovalManager<PluginApprovalRequestPayload>();
  let pluginApprovalHandlersPromise: Promise<GatewayRequestHandlers> | null = null;
  const loadPluginApprovalHandlers = () =>
    (pluginApprovalHandlersPromise ??= import("./server-methods/plugin-approval.js").then(
      ({ createPluginApprovalHandlers }) =>
        createPluginApprovalHandlers(pluginApprovalManager, {
          forwarder: execApprovalForwarder,
        }),
    ));

  const buildReloadPlan = params.buildReloadPlan ?? buildGatewayReloadPlan;
  let reloadInFlight: Promise<ReloadSecretsResult> | null = null;
  const runExclusiveReload = (
    fn: () => Promise<ReloadSecretsResult>,
  ): Promise<ReloadSecretsResult> => {
    if (reloadInFlight) {
      return reloadInFlight;
    }
    const run = (async () => {
      try {
        return await fn();
      } finally {
        reloadInFlight = null;
      }
    })();
    reloadInFlight = run;
    return run;
  };

  let secretsHandlersPromise: Promise<GatewayRequestHandlers> | null = null;
  const loadSecretsHandlers = () =>
    (secretsHandlersPromise ??= import("./server-methods/secrets.js").then(
      ({ createSecretsHandlers }) =>
        createSecretsHandlers({
          reloadSecrets: () =>
            runExclusiveReload(async () => {
              const previousSnapshot = getActiveSecretsRuntimeSnapshot();
              if (!previousSnapshot) {
                throw new Error("Secrets runtime snapshot is not active.");
              }
              const stoppedChannels: ChannelKind[] = [];
              const restartedChannels = new Set<ChannelKind>();
              try {
                const prepared = await params.activateRuntimeSecrets(previousSnapshot.sourceConfig, {
                  reason: "reload",
                  activate: true,
                });
                const plan = buildReloadPlan(
                  diffConfigPaths(previousSnapshot.config, prepared.config),
                );
                if (plan.restartChannels.size > 0) {
                  const restartChannels = [...plan.restartChannels];
                  if (
                    isTruthyEnvValue(process.env.COREBLOW_SKIP_CHANNELS) ||
                    isTruthyEnvValue(process.env.COREBLOW_SKIP_PROVIDERS)
                  ) {
                    throw new Error(
                      `secrets.reload requires restarting channels: ${restartChannels.join(", ")}`,
                    );
                  }
                  const restartFailures: ChannelKind[] = [];
                  for (const channel of restartChannels) {
                    params.logChannels.info(`restarting ${channel} channel after secrets reload`);
                    stoppedChannels.push(channel);
                    try {
                      await params.stopChannel(channel);
                      await params.startChannel(channel);
                      restartedChannels.add(channel);
                    } catch {
                      params.logChannels.info(
                        `failed to restart ${channel} channel after secrets reload`,
                      );
                      restartFailures.push(channel);
                    }
                  }
                  if (restartFailures.length > 0) {
                    throw new Error(
                      `failed to restart channels after secrets reload: ${restartFailures.join(", ")}`,
                    );
                  }
                }
                return { warningCount: prepared.warnings.length };
              } catch (err) {
                await restoreSecretsRuntimeSnapshot(previousSnapshot);
                for (const channel of stoppedChannels) {
                  params.logChannels.info(
                    `rolling back ${channel} channel after secrets reload failure`,
                  );
                  try {
                    if (restartedChannels.has(channel)) {
                      await params.stopChannel(channel);
                    }
                    await params.startChannel(channel);
                  } catch {
                    params.logChannels.info(
                      `failed to roll back ${channel} channel after secrets reload`,
                    );
                  }
                }
                throw err;
              }
            }),
          resolveSecrets: async ({ commandName, targetIds }) => {
            const { assignments, diagnostics, inactiveRefPaths } =
              resolveCommandSecretsFromActiveRuntimeSnapshot({
                commandName,
                targetIds: new Set(targetIds),
              });
            return { assignments, diagnostics, inactiveRefPaths };
          },
        }),
    ));

  return {
    execApprovalManager,
    pluginApprovalManager,
    extraHandlers: {
      "exec.approval.request": createLazyHandler("exec.approval.request", loadExecApprovalHandlers),
      "exec.approval.waitDecision": createLazyHandler(
        "exec.approval.waitDecision",
        loadExecApprovalHandlers,
      ),
      "exec.approval.resolve": createLazyHandler("exec.approval.resolve", loadExecApprovalHandlers),
      "plugin.approval.request": createLazyHandler(
        "plugin.approval.request",
        loadPluginApprovalHandlers,
      ),
      "plugin.approval.waitDecision": createLazyHandler(
        "plugin.approval.waitDecision",
        loadPluginApprovalHandlers,
      ),
      "plugin.approval.resolve": createLazyHandler(
        "plugin.approval.resolve",
        loadPluginApprovalHandlers,
      ),
      "secrets.reload": createLazyHandler("secrets.reload", loadSecretsHandlers),
      "secrets.resolve": createLazyHandler("secrets.resolve", loadSecretsHandlers),
    } satisfies GatewayRequestHandlers,
  };
}
