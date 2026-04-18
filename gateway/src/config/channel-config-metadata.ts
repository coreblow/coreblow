/** CoreBlow — Channel Config Metadata */
export interface ChannelMetadataEntry { channelType: string; label: string; icon?: string; category: "chat" | "social" | "enterprise" | "voice"; }
export const CHANNEL_METADATA: ChannelMetadataEntry[] = [
  { channelType: "discord", label: "Discord", icon: "🎮", category: "chat" },
  { channelType: "telegram", label: "Telegram", icon: "✈️", category: "chat" },
  { channelType: "slack", label: "Slack", icon: "💼", category: "enterprise" },
  { channelType: "whatsapp", label: "WhatsApp", icon: "📱", category: "chat" },
  { channelType: "msteams", label: "MS Teams", icon: "🏢", category: "enterprise" },
  { channelType: "irc", label: "IRC", icon: "💬", category: "chat" },
];
