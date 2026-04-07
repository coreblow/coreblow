/**
 * Imessage Types
 */
export interface ImessageMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ImessageUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface ImessageChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
