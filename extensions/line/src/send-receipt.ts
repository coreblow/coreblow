import { createMessageReceiptFromOutboundResults } from "coreblow/plugin-sdk/channel-message";

export type LineMessageReceiptPartKind = "text" | "media" | "unknown";
export type LineMessageReceipt = ReturnType<typeof createMessageReceiptFromOutboundResults>;

export function createLineSendReceipt(params: {
  messageId: string;
  chatId: string;
  kind?: LineMessageReceiptPartKind;
  messageCount?: number;
}): LineMessageReceipt {
  const messageId = params.messageId.trim();
  const chatId = params.chatId.trim();
  return createMessageReceiptFromOutboundResults({
    results: messageId
      ? [
          {
            channel: "line",
            messageId,
            chatId,
            conversationId: chatId,
            meta: { messageCount: params.messageCount ?? 1 },
          },
        ]
      : [],
    ...(chatId ? { threadId: chatId } : {}),
    kind: params.kind ?? "unknown",
  });
}
