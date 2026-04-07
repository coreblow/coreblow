/**
 * MemoryCore Types
 */
export interface MemoryCoreMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface MemoryCoreUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface MemoryCoreChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
