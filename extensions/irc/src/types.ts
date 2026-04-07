/**
 * Irc Types
 */
export interface IrcMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface IrcUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface IrcChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
