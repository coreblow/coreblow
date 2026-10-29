// Pure channel contract types used by plugin implementations and tests.
export type {
  BaseProbeResult,
  BaseTokenResolution,
  ChannelAgentTool,
  ChannelAccountSnapshot,
  ChannelApprovalCapability,
  ChannelCapabilities,
  ChannelCommandConversationContext,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMessageActionDiscoveryContext,
  ChannelMessageActionName,
  ChannelMessageToolDiscovery,
  ChannelMessageToolSchemaContribution,
  ChannelMeta,
  ChannelStatusIssue,
  ChannelThreadingContext,
  ChannelThreadingToolContext,
} from "../channels/plugins/types.js";
export type { ChannelRuntimeSurface } from "../channels/plugins/channel-runtime-surface.types.js";

export type {
  ChannelDirectoryAdapter,
  ChannelDoctorAdapter,
  ChannelDoctorConfigMutation,
  ChannelDoctorEmptyAllowlistAccountContext,
  ChannelDoctorLegacyConfigRule,
  ChannelDoctorSequenceResult,
  ChannelGatewayContext,
} from "../channels/plugins/types.adapters.js";
export type {
  ChannelDirectoryEntry,
  ChannelDirectoryEntryKind,
} from "../channels/plugins/types.core.js";
