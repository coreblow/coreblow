import { resolveSendableOutboundReplyParts } from "coreblow/plugin-sdk/reply-payload";
import type { MarkdownTableMode, OutboundReplyPayload } from "./runtime-api.js";

export type ZaloDurableReplyOptions = {
  to: string;
};

export function prepareZaloDurableReplyPayload(params: {
  payload: OutboundReplyPayload;
  tableMode: MarkdownTableMode;
  convertMarkdownTables: (text: string, tableMode: MarkdownTableMode) => string;
}): OutboundReplyPayload {
  if (!params.payload.text) {
    return params.payload;
  }
  return {
    ...params.payload,
    text: params.convertMarkdownTables(params.payload.text, params.tableMode),
  };
}

export function resolveZaloDurableReplyOptions(params: {
  payload: OutboundReplyPayload;
  infoKind: string;
  chatId: string;
}): ZaloDurableReplyOptions | false {
  if (params.infoKind !== "final") {
    return false;
  }
  const reply = resolveSendableOutboundReplyParts(params.payload);
  if (reply.hasMedia || !reply.hasText) {
    return false;
  }
  return { to: params.chatId };
}
