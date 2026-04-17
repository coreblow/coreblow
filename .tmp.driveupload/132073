/**
 * ThreadOwnership Types
 */
export interface ThreadOwnershipMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ThreadOwnershipUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface ThreadOwnershipChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
