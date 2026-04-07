/**
 * Lobster Types
 */
export interface LobsterMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface LobsterUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface LobsterChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
