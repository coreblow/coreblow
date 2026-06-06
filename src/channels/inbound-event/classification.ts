import type { CoreBlowConfig } from "../../config/types.js";
import type { UnmentionedGroupInboundPolicy } from "./kind.js";

export type ChannelInboundConversationFacts = {
  kind?: "direct" | "group" | "channel" | string;
};

export type ClassifyChannelInboundEventParams = {
  conversation?: ChannelInboundConversationFacts;
  wasMentioned?: boolean;
  hasControlCommand?: boolean;
  hasAbortRequest?: boolean;
  commandSource?: "native" | "text" | string;
  unmentionedGroupPolicy?: UnmentionedGroupInboundPolicy;
};

function readUnmentionedPolicy(value: unknown): UnmentionedGroupInboundPolicy | undefined {
  return value === "room_event" || value === "user_request" ? value : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}

export function classifyChannelInboundEvent(
  params: ClassifyChannelInboundEventParams,
): "user_request" | "room_event" {
  if (params.unmentionedGroupPolicy !== "room_event") {
    return "user_request";
  }

  if (params.conversation?.kind !== "group" && params.conversation?.kind !== "channel") {
    return "user_request";
  }

  if (
    params.wasMentioned === true ||
    params.hasControlCommand === true ||
    params.hasAbortRequest === true ||
    params.commandSource === "native"
  ) {
    return "user_request";
  }

  return "room_event";
}

export function resolveUnmentionedGroupInboundPolicy(params: {
  cfg: CoreBlowConfig;
  agentId?: string;
}): UnmentionedGroupInboundPolicy {
  const cfg = params.cfg as Record<string, unknown>;
  const agents = readRecord(cfg.agents);
  const list = Array.isArray(agents?.list) ? agents.list : [];

  const agent = list.find((entry) => {
    const record = readRecord(entry);
    return record?.id === params.agentId;
  });
  const agentGroupChat = readRecord(readRecord(agent)?.groupChat);
  const agentPolicy = readUnmentionedPolicy(agentGroupChat?.unmentionedInbound);
  if (agentPolicy !== undefined) {
    return agentPolicy;
  }

  const messages = readRecord(cfg.messages);
  const groupChat = readRecord(messages?.groupChat);
  return readUnmentionedPolicy(groupChat?.unmentionedInbound) ?? "user_request";
}
