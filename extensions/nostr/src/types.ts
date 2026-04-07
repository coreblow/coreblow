/**
 * Nostr Types
 */
export interface NostrMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface NostrUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface NostrChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
