/**
 * Msteams Types
 */
export interface MsteamsMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface MsteamsUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface MsteamsChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
