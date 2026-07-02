export {
  verifyChannelMessageAdapterCapabilityProofs,
  verifyChannelMessageLiveCapabilityAdapterProofs,
  verifyChannelMessageLiveFinalizerProofs,
  verifyChannelMessageReceiveAckPolicyAdapterProofs,
} from "../channels/message/contracts.js";
export { createMessageReceiptFromOutboundResults } from "../channels/message/receipt.js";
export { createChannelMessageAdapterFromOutbound } from "../channels/message/outbound-bridge.js";
export type {
  MessageReceipt,
  MessageReceiptPart,
  MessageReceiptPartKind,
  MessageReceiptSourceResult,
} from "../channels/message/types.js";

export function defineChannelMessageAdapter<T extends Record<string, unknown>>(adapter: T): T {
  return adapter;
}

export function createChannelMessageReplyPipeline() {
  return {
    async dispatch() {
      return undefined;
    },
  };
}
