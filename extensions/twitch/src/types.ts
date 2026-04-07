/**
 * Twitch Types
 */
export interface TwitchMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TwitchUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface TwitchChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
