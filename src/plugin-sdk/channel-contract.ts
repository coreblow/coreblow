// Pure channel contract types used by plugin implementations and tests.
export type {
  BaseProbeResult,
  BaseTokenResolution,
  ChannelAgentTool,
  ChannelAccountSnapshot,
  ChannelCommandConversationContext,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMessageActionDiscoveryContext,
  ChannelMessageActionName,
  ChannelMessageToolDiscovery,
  ChannelMessageToolSchemaContribution,
  ChannelStatusIssue,
  ChannelThreadingContext,
  ChannelThreadingToolContext,
} from "../channels/plugins/types.js";

export type ChannelGatewayContext<TAccount = unknown> = {
  cfg: Record<string, unknown>;
  account: TAccount;
  abortSignal: AbortSignal;
  log?: {
    warn?: (message: string) => void;
    info?: (message: string) => void;
    error?: (message: string) => void;
  };
  setStatus: (status: Record<string, unknown>) => void;
};
