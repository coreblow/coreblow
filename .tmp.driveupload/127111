/**
 * OpenProse Types
 */
export interface OpenProseMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface OpenProseUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface OpenProseChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
