/**
 * Zalo Types
 */
export interface ZaloMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ZaloUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface ZaloChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
