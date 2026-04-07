export {
  GATEWAY_CLIENT_NAMES,
  GATEWAY_CLIENT_MODES,
  type GatewayClientName,
  type GatewayClientMode,
  normalizeGatewayClientName,
  normalizeGatewayClientMode,
} from "../gateway/protocol/client-info.js";

export const INTERNAL_MESSAGE_CHANNEL = "webchat" as const;
export type InternalMessageChannel = typeof INTERNAL_MESSAGE_CHANNEL;
