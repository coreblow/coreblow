import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { startHeartbeatRunner, type HeartbeatRunner } from "../infra/heartbeat-runner.js";
import type { PluginMetadataRegistryView } from "../plugins/plugin-metadata-snapshot.types.js";
import type { ChannelHealthMonitor } from "./channel-health-monitor.js";
import { startChannelHealthMonitor } from "./channel-health-monitor.js";
import { isGatewayModelPricingEnabled } from "./model-pricing-config.js";
import type { startGatewayMaintenanceTimers } from "./server-maintenance.js";

type GatewayRuntimeServiceLogger = {
  child: (name: string) => {
    info: (message: string) => void;
    warn: (message: string) => void;
    error: (message: string) => void;
  };
  error: (message: string) => void;
};

type GatewayPostReadyLogger = {
  warn: (message: string) => void;
};

export type GatewayMaintenanceHandles = NonNullable<
  Awaited<ReturnType<typeof startGatewayMaintenanceTimers>>
>;

export type GatewayChannelManager = Parameters<
  typeof startChannelHealthMonitor
>[0]["channelManager"];

function createNoopHeartbeatRunner(): HeartbeatRunner {
  return {
    stop: () => {},
    updateConfig: (_cfg: CoreBlowConfig) => {},
  };
}

export function startGatewayChannelHealthMonitor(params: {
  cfg: CoreBlowConfig;
  channelManager: GatewayChannelManager;
}): ChannelHealthMonitor | null {
  const healthCheckMinutes = params.cfg.gateway?.channelHealthCheckMinutes;
  if (healthCheckMinutes === 0) {
    return null;
  }
  const staleEventThresholdMinutes = params.cfg.gateway?.channelStaleEventThresholdMinutes;
  const maxRestartsPerHour = params.cfg.gateway?.channelMaxRestartsPerHour;
  return startChannelHealthMonitor({
    channelManager: params.channelManager,
    checkIntervalMs: (healthCheckMinutes ?? 5) * 60_000,
    ...(staleEventThresholdMinutes != null && {
      staleEventThresholdMs: staleEventThresholdMinutes * 60_000,
    }),
    ...(maxRestartsPerHour != null && { maxRestartsPerHour }),
  });
}

export function startGatewayCronWithLogging(params: {
  cron: { start: () => Promise<void> };
  logCron: { error: (message: string) => void };
}): void {
  void params.cron.start().catch((err) => params.logCron.error(`failed to start: ${String(err)}`));
}

function clearGatewayMaintenanceHandles(maintenance: GatewayMaintenanceHandles | null): void {
  if (!maintenance) {
    return;
  }
  clearInterval(maintenance.tickInterval);
  clearInterval(maintenance.healthInterval);
  clearInterval(maintenance.dedupeCleanup);
  if (maintenance.mediaCleanup) {
    clearInterval(maintenance.mediaCleanup);
  }
}

export async function runGatewayPostReadyMaintenance(params: {
  startMaintenance: () => Promise<GatewayMaintenanceHandles | null>;
  applyMaintenance: (maintenance: GatewayMaintenanceHandles) => void;
  shouldStartCron: () => boolean;
  markCronStartHandled: () => void;
  cron: { start: () => Promise<void> };
  logCron: { error: (message: string) => void };
  log: GatewayPostReadyLogger;
  recordPostReadyMemory: () => void;
}): Promise<void> {
  try {
    const maintenance = await params.startMaintenance();
    if (maintenance) {
      params.applyMaintenance(maintenance);
    }
  } catch (err) {
    params.log.warn(`gateway post-ready maintenance startup failed: ${String(err)}`);
  }
  if (params.shouldStartCron()) {
    params.markCronStartHandled();
    startGatewayCronWithLogging({
      cron: params.cron,
      logCron: params.logCron,
    });
  }
  params.recordPostReadyMemory();
}

export function scheduleGatewayPostReadyMaintenance(params: {
  delayMs: number;
  isClosing: () => boolean;
  onStarted?: () => void;
  startMaintenance: () => Promise<GatewayMaintenanceHandles | null>;
  applyMaintenance: (maintenance: GatewayMaintenanceHandles) => void;
  shouldStartCron: () => boolean;
  markCronStartHandled: () => void;
  cron: { start: () => Promise<void> };
  logCron: { error: (message: string) => void };
  log: GatewayPostReadyLogger;
  recordPostReadyMemory: () => void;
}): ReturnType<typeof setTimeout> {
  const timer = setTimeout(() => {
    params.onStarted?.();
    if (params.isClosing()) {
      return;
    }
    void runGatewayPostReadyMaintenance({
      startMaintenance: async () => {
        if (params.isClosing()) {
          return null;
        }
        const maintenance = await params.startMaintenance();
        if (params.isClosing()) {
          clearGatewayMaintenanceHandles(maintenance);
          return null;
        }
        return maintenance;
      },
      applyMaintenance: (maintenance) => {
        if (params.isClosing()) {
          clearGatewayMaintenanceHandles(maintenance);
          return;
        }
        params.applyMaintenance(maintenance);
      },
      shouldStartCron: () => !params.isClosing() && params.shouldStartCron(),
      markCronStartHandled: params.markCronStartHandled,
      cron: params.cron,
      logCron: params.logCron,
      log: params.log,
      recordPostReadyMemory: () => {
        if (!params.isClosing()) {
          params.recordPostReadyMemory();
        }
      },
    });
  }, params.delayMs);
  timer.unref?.();
  return timer;
}

function startGatewayModelPricingRefreshOnDemand(params: {
  config: CoreBlowConfig;
  pluginLookUpTable?: PluginMetadataRegistryView;
  log: GatewayRuntimeServiceLogger;
}): () => void {
  if (!isGatewayModelPricingEnabled(params.config)) {
    return () => {};
  }
  let stopped = false;
  let stopRefresh: (() => void) | undefined;
  void (async () => {
    const { startGatewayModelPricingRefresh } = await import("./model-pricing-cache.js");
    if (stopped) {
      return;
    }
    stopRefresh = startGatewayModelPricingRefresh({
      config: params.config,
      ...(params.pluginLookUpTable ? { pluginLookUpTable: params.pluginLookUpTable } : {}),
    });
    if (stopped) {
      stopRefresh();
      stopRefresh = undefined;
    }
  })().catch((err) => params.log.error(`Model pricing refresh failed to start: ${String(err)}`));
  return () => {
    stopped = true;
    stopRefresh?.();
    stopRefresh = undefined;
  };
}

export function startGatewayRuntimeServices(params: {
  minimalTestGateway: boolean;
  cfgAtStart: CoreBlowConfig;
  channelManager: GatewayChannelManager;
  log: GatewayRuntimeServiceLogger;
}): {
  heartbeatRunner: HeartbeatRunner;
  channelHealthMonitor: ChannelHealthMonitor | null;
  stopModelPricingRefresh: () => void;
} {
  const channelHealthMonitor = startGatewayChannelHealthMonitor({
    cfg: params.cfgAtStart,
    channelManager: params.channelManager,
  });

  return {
    heartbeatRunner: createNoopHeartbeatRunner(),
    channelHealthMonitor,
    stopModelPricingRefresh: () => {},
  };
}

export function activateGatewayScheduledServices(params: {
  minimalTestGateway: boolean;
  cfgAtStart: CoreBlowConfig;
  cron: { start: () => Promise<void> };
  startCron?: boolean;
  logCron: { error: (message: string) => void };
  log: GatewayRuntimeServiceLogger;
  pluginLookUpTable?: PluginMetadataRegistryView;
}): { heartbeatRunner: HeartbeatRunner; stopModelPricingRefresh: () => void } {
  if (params.minimalTestGateway) {
    return { heartbeatRunner: createNoopHeartbeatRunner(), stopModelPricingRefresh: () => {} };
  }
  const heartbeatRunner = startHeartbeatRunner({ cfg: params.cfgAtStart });
  if (params.startCron !== false) {
    startGatewayCronWithLogging({
      cron: params.cron,
      logCron: params.logCron,
    });
  }
  // ponytail: skipped recoverPendingOutboundDeliveries + recoverPendingSessionDeliveries
  // (need CliDeps type). Add when infra/outbound delivery recovery is ported.
  const stopModelPricingRefresh = startGatewayModelPricingRefreshOnDemand({
    config: params.cfgAtStart,
    ...(params.pluginLookUpTable ? { pluginLookUpTable: params.pluginLookUpTable } : {}),
    log: params.log,
  });
  return { heartbeatRunner, stopModelPricingRefresh };
}
