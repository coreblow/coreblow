export { INTERNAL_MESSAGE_CHANNEL } from "./message-channel.js";
export type { InternalMessageChannel } from "./message-channel.js";

export const INTERNAL_NON_DELIVERY_CHANNELS = [
  "heartbeat",
  "cron",
  "webhook",
  "voice",
] as const;

export type InternalNonDeliveryChannel = (typeof INTERNAL_NON_DELIVERY_CHANNELS)[number];

export function isInternalNonDeliveryChannel(
  value: string | undefined | null,
): value is InternalNonDeliveryChannel {
  return (
    typeof value === "string" &&
    INTERNAL_NON_DELIVERY_CHANNELS.includes(value.trim().toLowerCase() as InternalNonDeliveryChannel)
  );
}
