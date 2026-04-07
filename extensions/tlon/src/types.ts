/**
 * Tlon Types
 */
export interface TlonMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TlonUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface TlonChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
