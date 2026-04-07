/**
 * Mattermost Types
 */
export interface MattermostMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface MattermostUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface MattermostChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
