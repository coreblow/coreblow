/**
 * Line Types
 */
export interface LineMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface LineUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface LineChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
