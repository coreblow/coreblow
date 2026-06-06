export type DurableFinalDeliveryRequirement =
  | "text"
  | "media"
  | "payload"
  | "silent"
  | "replyTo"
  | "thread"
  | "nativeQuote"
  | "messageSendingHooks"
  | "batch"
  | "reconcileUnknownSend"
  | "afterSendSuccess"
  | "afterCommit";

export const durableFinalDeliveryCapabilities = [
  "text",
  "media",
  "payload",
  "silent",
  "replyTo",
  "thread",
  "nativeQuote",
  "messageSendingHooks",
  "batch",
  "reconcileUnknownSend",
  "afterSendSuccess",
  "afterCommit",
] as const satisfies readonly DurableFinalDeliveryRequirement[];

export type DurableFinalDeliveryRequirementMap = Partial<
  Record<DurableFinalDeliveryRequirement, boolean>
>;

export type DurableFinalDeliveryPayload = {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: readonly string[];
  replyToId?: string;
};

export type MessageReceiptSourceResult = {
  channel?: string;
  messageId?: string;
  chatId?: string;
  channelId?: string;
  roomId?: string;
  conversationId?: string;
  toJid?: string;
  pollId?: string;
  timestamp?: number;
  meta?: Record<string, unknown>;
};

export type MessageReceiptPartKind = "text" | "media" | "voice" | "card" | "preview" | "unknown";

export type MessageReceiptPart = {
  platformMessageId: string;
  kind: MessageReceiptPartKind;
  index: number;
  threadId?: string;
  replyToId?: string;
  raw?: MessageReceiptSourceResult;
};

export type MessageReceipt = {
  primaryPlatformMessageId?: string;
  platformMessageIds: string[];
  parts: MessageReceiptPart[];
  threadId?: string;
  replyToId?: string;
  editToken?: string;
  deleteToken?: string;
  sentAt: number;
  raw?: readonly MessageReceiptSourceResult[];
};

export type DurableFinalDeliveryRequirementInput = {
  payload?: DurableFinalDeliveryPayload;
  threadId?: string | number;
  silent?: boolean;
  payloadTransport?: boolean;
  batch?: boolean;
  reconcileUnknownSend?: boolean;
  afterSendSuccess?: boolean;
  afterCommit?: boolean;
  extraCapabilities?: DurableFinalDeliveryRequirementMap;
};

export type ChannelMessageDurableFinalAdapter = {
  capabilities?: DurableFinalDeliveryRequirementMap;
};

export type ChannelMessageLiveCapability =
  | "draftPreview"
  | "previewFinalization"
  | "progressUpdates"
  | "nativeStreaming"
  | "quietFinalization";

export const channelMessageLiveCapabilities = [
  "draftPreview",
  "previewFinalization",
  "progressUpdates",
  "nativeStreaming",
  "quietFinalization",
] as const satisfies readonly ChannelMessageLiveCapability[];

export const livePreviewFinalizerCapabilities = [
  "finalEdit",
  "normalFallback",
  "discardPending",
  "previewReceipt",
  "retainOnAmbiguousFailure",
] as const;

export type LivePreviewFinalizerCapability = (typeof livePreviewFinalizerCapabilities)[number];

export type LivePreviewFinalizerCapabilityMap = Partial<
  Record<LivePreviewFinalizerCapability, boolean>
>;

export type ChannelMessageLiveFinalizerAdapterShape = {
  capabilities?: LivePreviewFinalizerCapabilityMap;
};

export type ChannelMessageLiveAdapterShape = {
  capabilities?: Partial<Record<ChannelMessageLiveCapability, boolean>>;
  finalizer?: ChannelMessageLiveFinalizerAdapterShape;
};

export type ChannelMessageReceiveAckPolicy =
  | "after_receive_record"
  | "after_agent_dispatch"
  | "after_durable_send"
  | "manual";

export const channelMessageReceiveAckPolicies = [
  "after_receive_record",
  "after_agent_dispatch",
  "after_durable_send",
  "manual",
] as const satisfies readonly ChannelMessageReceiveAckPolicy[];

export type ChannelMessageReceiveAdapterShape = {
  defaultAckPolicy?: ChannelMessageReceiveAckPolicy;
  supportedAckPolicies?: readonly ChannelMessageReceiveAckPolicy[];
};

export type ChannelMessageAdapterShape = {
  id?: string;
  durableFinal?: ChannelMessageDurableFinalAdapter;
  live?: ChannelMessageLiveAdapterShape;
  receive?: ChannelMessageReceiveAdapterShape;
};
