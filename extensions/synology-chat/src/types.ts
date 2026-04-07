/**
 * SynologyChat Types
 */
export interface SynologyChatMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface SynologyChatUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface SynologyChatChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
