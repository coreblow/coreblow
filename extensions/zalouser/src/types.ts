/**
 * Zalouser Types
 */
export interface ZalouserMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ZalouserUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface ZalouserChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
