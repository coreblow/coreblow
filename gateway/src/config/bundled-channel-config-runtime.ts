/** CoreBlow — Bundled Channel Config Runtime */
import { BUNDLED_CHANNEL_METADATA, type ChannelConfigMetadata } from "./bundled-channel-config-metadata.generated.js";
export function getChannelMetadata(channelType: string): ChannelConfigMetadata | undefined { return BUNDLED_CHANNEL_METADATA.find((m) => m.channelType === channelType); }
export function getAvailableChannelTypes(): string[] { return BUNDLED_CHANNEL_METADATA.map((m) => m.channelType); }
