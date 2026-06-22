import {
  createMessageReceiptFromOutboundResults,
  type MessageReceiptPartKind,
} from "coreblow/plugin-sdk/channel-message";

type MessageReceipt = ReturnType<typeof createMessageReceiptFromOutboundResults>;

export function createZalouserSendReceipt(params: {
  messageId?: string;
  platformMessageIds?: readonly (string | null | undefined)[];
  threadId?: string;
  kind?: MessageReceiptPartKind;
}): MessageReceipt {
  const platformMessageIds = (params.platformMessageIds ?? [params.messageId])
    .map((messageId) => messageId?.trim())
    .filter((messageId): messageId is string => Boolean(messageId));
  const threadId = params.threadId?.trim();
  return createMessageReceiptFromOutboundResults({
    results: platformMessageIds.map((messageId) => ({
      channel: "zalouser",
      messageId,
      ...(threadId ? { conversationId: threadId } : {}),
    })),
    ...(threadId ? { threadId } : {}),
    kind: params.kind ?? "unknown",
  });
}
