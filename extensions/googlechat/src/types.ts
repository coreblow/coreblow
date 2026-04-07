/**
 * Googlechat Types
 */
export interface GooglechatMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface GooglechatUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface GooglechatChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
