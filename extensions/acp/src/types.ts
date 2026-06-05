/**
 * Acp Types
 */
export interface AcpMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AcpUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface AcpChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
