/**
 * Slack Types
 */
export interface SlackMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface SlackUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
