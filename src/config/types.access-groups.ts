export type DiscordChannelAudienceAccessGroup = {
  /**
   * Discord dynamic audience backed by users who can currently view a guild
   * channel.
   */
  type: "discord.channelAudience";
  guildId: string;
  channelId: string;
  membership?: "canViewChannel";
};

export type MessageSendersAccessGroup = {
  /**
   * Static sender allowlists that can be referenced by any message channel via
   * accessGroup:<name>.
   */
  type: "message.senders";
  members: Record<string, string[]>;
};

export type AccessGroupConfig = DiscordChannelAudienceAccessGroup | MessageSendersAccessGroup;

export type AccessGroupsConfig = Record<string, AccessGroupConfig>;
