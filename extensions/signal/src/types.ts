/**
 * Signal Types
 */
export interface SignalMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface SignalUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface SignalChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
