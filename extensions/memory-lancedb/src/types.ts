/**
 * MemoryLancedb Types
 */
export interface MemoryLancedbMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface MemoryLancedbUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface MemoryLancedbChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
