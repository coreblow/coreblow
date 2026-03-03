import { MESSAGE_ACTION_TARGET_MODE } from "./message-action-spec.js";

export const CHANNEL_TARGET_DESCRIPTION =
  "Recipient/channel: E.164 for WhatsApp/Signal, Telegram chat id/@username, Discord/Slack channel/user, or iMessage handle/chat_id";

export const CHANNEL_TARGETS_DESCRIPTION =
  "Recipient/channel targets (same format as --target); accepts ids or names when the directory is available.";

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function applyTargetToParams(params: {
  action: string;
  args: Record<string, unknown>;
}): void {
  const target = typeof params.args.target === "string" ? params.args.target.trim() : "";
  const hasLegacyTo = hasNonEmptyString(params.args.to);
  const hasLegacyChannelId = hasNonEmptyString(params.args.channelId);
  const mode =
    MESSAGE_ACTION_TARGET_MODE[params.action as keyof typeof MESSAGE_ACTION_TARGET_MODE] ?? "none";

  if (mode !== "none") {
    if (hasLegacyTo || hasLegacyChannelId) {
      throw new Error("Use `target` instead of `to`/`channelId`.");
    }
  } else if (hasLegacyTo) {
    throw new Error("Use `target` for actions that accept a destination.");
  }

  if (!target) {
    return;
  }
  if (mode === "channelId") {
    params.args.channelId = target;
    return;
  }
  if (mode === "to") {
    params.args.to = target;
    return;
  }
  throw new Error(`Action ${params.action} does not accept a target.`);
}

// ---------------------------------------------------------------------------
// ChannelTargetService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "../service-patterns.js";
export class ChannelTargetService {
  applyTargetToParams(params: Parameters<typeof applyTargetToParams>[0]) {
    return applyTargetToParams(params);
  }
}


const { getInstance: getChannelTargetService, __testing: __testing_channelTarget } =
  createStandaloneSingleton({ create: () => new ChannelTargetService(), defaultDeps: {} });

export { getChannelTargetService, __testing_channelTarget };
