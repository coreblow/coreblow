import { getChannelPlugin, listChannelPlugins } from "../channels/plugins/index.js";
import { loadConfig, type CoreBlowConfig } from "../config/config.js";
import { INTERNAL_MESSAGE_CHANNEL, normalizeMessageChannel } from "../utils/message-channel.js";

export type ExecApprovalInitiatingSurfaceState =
  | { kind: "enabled"; channel: string | undefined; channelLabel: string }
  | { kind: "disabled"; channel: string; channelLabel: string }
  | { kind: "unsupported"; channel: string; channelLabel: string };

function labelForChannel(channel?: string): string {
  switch (channel) {
    case "discord":
      return "Discord";
    case "telegram":
      return "Telegram";
    case "tui":
      return "terminal UI";
    case INTERNAL_MESSAGE_CHANNEL:
      return "Web UI";
    default:
      return channel ? channel[0]?.toUpperCase() + channel.slice(1) : "this platform";
  }
}

export function resolveExecApprovalInitiatingSurfaceState(params: {
  channel?: string | null;
  accountId?: string | null;
  cfg?: CoreBlowConfig;
}): ExecApprovalInitiatingSurfaceState {
  const channel = normalizeMessageChannel(params.channel);
  const channelLabel = labelForChannel(channel);
  if (!channel || channel === INTERNAL_MESSAGE_CHANNEL || channel === "tui") {
    return { kind: "enabled", channel, channelLabel };
  }

  const cfg = params.cfg ?? loadConfig();
  const state = getChannelPlugin(channel)?.execApprovals?.getInitiatingSurfaceState?.({
    cfg,
    accountId: params.accountId,
  });
  if (state) {
    return { ...state, channel, channelLabel };
  }
  return { kind: "unsupported", channel, channelLabel };
}

export function hasConfiguredExecApprovalDmRoute(cfg: CoreBlowConfig): boolean {
  return listChannelPlugins().some(
    (plugin) => plugin.execApprovals?.hasConfiguredDmRoute?.({ cfg }) ?? false,
  );
}

// ---------------------------------------------------------------------------
// ExecApprovalSurfaceService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createTestingHooks } from "./service-patterns.js";

export class ExecApprovalSurfaceService {
  resolveExecApprovalInitiatingSurfaceState(params: Parameters<typeof resolveExecApprovalInitiatingSurfaceState>[0]) {
    return resolveExecApprovalInitiatingSurfaceState(params);
  }

  hasConfiguredExecApprovalDmRoute(...args: Parameters<typeof hasConfiguredExecApprovalDmRoute>) {
    return hasConfiguredExecApprovalDmRoute(...args);
  }
}

let _execApprovalSurfaceInstance: ExecApprovalSurfaceService | null = null;

export function getExecApprovalSurfaceService(): ExecApprovalSurfaceService {
  if (!_execApprovalSurfaceInstance) {
    _execApprovalSurfaceInstance = new ExecApprovalSurfaceService();
  }
  return _execApprovalSurfaceInstance;
}

export const __testing_execApprovalSurface = createTestingHooks<ExecApprovalSurfaceService>(
  () => { _execApprovalSurfaceInstance = null; },
  (svc) => { _execApprovalSurfaceInstance = svc; },
);
