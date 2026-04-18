/** CoreBlow — Bundled Channel Config Metadata (Generated) */
export interface ChannelConfigField { key: string; label: string; type: "string" | "number" | "boolean" | "secret"; required: boolean; description?: string; }
export interface ChannelConfigMetadata { channelType: string; displayName: string; fields: ChannelConfigField[]; }
export const BUNDLED_CHANNEL_METADATA: ChannelConfigMetadata[] = [
  { channelType: "discord", displayName: "Discord", fields: [{ key: "token", label: "Bot Token", type: "secret", required: true }] },
  { channelType: "telegram", displayName: "Telegram", fields: [{ key: "token", label: "Bot Token", type: "secret", required: true }] },
  { channelType: "slack", displayName: "Slack", fields: [{ key: "botToken", label: "Bot Token", type: "secret", required: true }, { key: "appToken", label: "App Token", type: "secret", required: true }] },
];
