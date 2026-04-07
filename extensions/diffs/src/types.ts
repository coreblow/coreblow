/**
 * Diffs Types
 */
export interface DiffsMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface DiffsUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface DiffsChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
