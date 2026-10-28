import { existsSync } from "node:fs";
import type { CoreBlowConfig } from "../config/types.js";
import { buildGatewayConnectionDetailsWithResolvers } from "../gateway/connection-details.js";
import { normalizeControlUiBasePath } from "../gateway/control-ui-shared.js";
import { probeGateway } from "../gateway/probe.js";
import type { MemoryProviderStatus } from "../plugin-sdk/memory-core-host-engine-storage.js";
import { pickGatewaySelfPresence } from "./gateway-presence.js";
import { isProbeReachable } from "./gateway-status/helpers.js";
export { pickGatewaySelfPresence } from "./gateway-presence.js";

let gatewayProbeModulePromise: Promise<typeof import("./status.gateway-probe.js")> | undefined;

function loadGatewayProbeModule() {
  gatewayProbeModulePromise ??= import("./status.gateway-probe.js");
  return gatewayProbeModulePromise;
}

export type MemoryStatusSnapshot = MemoryProviderStatus & {
  agentId: string;
};

export type MemoryPluginStatus = {
  enabled: boolean;
  slot: string | null;
  reason?: string;
};

export type GatewayProbeSnapshot = {
  gatewayConnection: ReturnType<typeof buildGatewayConnectionDetailsWithResolvers>;
  remoteUrlMissing: boolean;
  gatewayMode: "local" | "remote";
  gatewayProbeAuth: {
    token?: string;
    password?: string;
  };
  gatewayProbeAuthWarning?: string;
  gatewayProbe: Awaited<ReturnType<typeof probeGateway>> | null;
  gatewayReachable: boolean;
  gatewaySelf: ReturnType<typeof pickGatewaySelfPresence>;
  gatewayCallOverrides?: {
    url: string;
    token?: string;
    password?: string;
  };
};

export function hasExplicitMemorySearchConfig(cfg: CoreBlowConfig, agentId: string): boolean {
  if (
    cfg.agents?.defaults &&
    Object.prototype.hasOwnProperty.call(cfg.agents.defaults, "memorySearch")
  ) {
    return true;
  }
  const agents = Array.isArray(cfg.agents?.list) ? cfg.agents.list : [];
  return agents.some(
    (agent) => agent?.id === agentId && Object.prototype.hasOwnProperty.call(agent, "memorySearch"),
  );
}

export function resolveMemoryPluginStatus(cfg: CoreBlowConfig): MemoryPluginStatus {
  const pluginsEnabled = cfg.plugins?.enabled !== false;
  if (!pluginsEnabled) {
    return { enabled: false, slot: null, reason: "plugins disabled" };
  }
  const raw = typeof cfg.plugins?.slots?.memory === "string" ? cfg.plugins.slots.memory.trim() : "";
  if (raw && raw.toLowerCase() === "none") {
    return { enabled: false, slot: null, reason: 'plugins.slots.memory="none"' };
  }
  return { enabled: true, slot: raw || "memory-core" };
}

export async function resolveGatewayProbeSnapshot(params: {
  cfg: CoreBlowConfig;
  opts: { timeoutMs?: number; all?: boolean; skipProbe?: boolean };
}): Promise<GatewayProbeSnapshot> {
  const gatewayConnection = buildGatewayConnectionDetailsWithResolvers({ config: params.cfg });
  const isRemoteMode = params.cfg.gateway?.mode === "remote";
  const remoteUrlRaw =
    typeof params.cfg.gateway?.remote?.url === "string" ? params.cfg.gateway.remote.url : "";
  const remoteUrlMissing = isRemoteMode && !remoteUrlRaw.trim();
  const gatewayMode = isRemoteMode ? "remote" : "local";
  if (remoteUrlMissing || params.opts.skipProbe) {
    return {
      gatewayConnection,
      remoteUrlMissing,
      gatewayMode,
      gatewayProbeAuth: {},
      gatewayProbeAuthWarning: undefined,
      gatewayProbe: null,
      gatewayReachable: false,
      gatewaySelf: null,
      ...(remoteUrlMissing
        ? {
            gatewayCallOverrides: {
              url: gatewayConnection.url,
            },
          }
        : {}),
    };
  }
  const { resolveGatewayProbeAuthResolution } = await loadGatewayProbeModule();
  const gatewayProbeAuthResolution = await resolveGatewayProbeAuthResolution(params.cfg);
  let gatewayProbeAuthWarning = gatewayProbeAuthResolution.warning;
  const gatewayProbe = await probeGateway({
    url: gatewayConnection.url,
    auth: gatewayProbeAuthResolution.auth,
    timeoutMs: Math.min(params.opts.all ? 5000 : 2500, params.opts.timeoutMs ?? 10_000),
    detailLevel: "presence",
  }).catch(() => null);
  if (gatewayProbeAuthWarning && gatewayProbe?.ok === false) {
    gatewayProbe.error = gatewayProbe.error
      ? `${gatewayProbe.error}; ${gatewayProbeAuthWarning}`
      : gatewayProbeAuthWarning;
    gatewayProbeAuthWarning = undefined;
  }
  const gatewayReachable = gatewayProbe ? isProbeReachable(gatewayProbe) : false;
  const gatewaySelf = gatewayProbe?.presence ? pickGatewaySelfPresence(gatewayProbe.presence) : null;
  return {
    gatewayConnection,
    remoteUrlMissing,
    gatewayMode,
    gatewayProbeAuth: gatewayProbeAuthResolution.auth,
    gatewayProbeAuthWarning,
    gatewayProbe,
    gatewayReachable,
    gatewaySelf,
    ...(remoteUrlMissing
      ? {
          gatewayCallOverrides: {
            url: gatewayConnection.url,
            token: gatewayProbeAuthResolution.auth.token,
            password: gatewayProbeAuthResolution.auth.password,
          },
        }
      : {}),
  };
}

export function buildTailscaleHttpsUrl(params: {
  tailscaleMode: string;
  tailscaleDns: string | null;
  controlUiBasePath?: string;
}): string | null {
  return params.tailscaleMode !== "off" && params.tailscaleDns
    ? `https://${params.tailscaleDns}${normalizeControlUiBasePath(params.controlUiBasePath)}`
    : null;
}

export async function resolveSharedMemoryStatusSnapshot(params: {
  cfg: CoreBlowConfig;
  agentStatus: { defaultId?: string | null };
  memoryPlugin: MemoryPluginStatus;
  resolveMemoryConfig: (cfg: CoreBlowConfig, agentId: string) => { store: { path: string } } | null;
  getMemorySearchManager: (params: {
    cfg: CoreBlowConfig;
    agentId: string;
    purpose: "status";
  }) => Promise<{
    manager: {
      probeVectorAvailability(): Promise<boolean>;
      status(): MemoryProviderStatus;
      close?(): Promise<void>;
    } | null;
  }>;
  requireDefaultStore?: (agentId: string) => string | null;
}): Promise<MemoryStatusSnapshot | null> {
  const { cfg, agentStatus, memoryPlugin } = params;
  if (!memoryPlugin.enabled || !memoryPlugin.slot) {
    return null;
  }
  const agentId = agentStatus.defaultId ?? "main";
  const defaultStorePath = params.requireDefaultStore?.(agentId);
  if (
    defaultStorePath &&
    !hasExplicitMemorySearchConfig(cfg, agentId) &&
    !existsSync(defaultStorePath)
  ) {
    return null;
  }
  const resolvedMemory = params.resolveMemoryConfig(cfg, agentId);
  if (!resolvedMemory) {
    return null;
  }
  const shouldInspectStore =
    hasExplicitMemorySearchConfig(cfg, agentId) || existsSync(resolvedMemory.store.path);
  if (!shouldInspectStore) {
    return null;
  }
  const { manager } = await params.getMemorySearchManager({ cfg, agentId, purpose: "status" });
  if (!manager) {
    return null;
  }
  try {
    await manager.probeVectorAvailability();
  } catch {}
  const status = manager.status();
  await manager.close?.().catch(() => {});
  return { agentId, ...status };
}
