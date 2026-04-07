/**
 * Acpx Types
 */
export interface AcpxMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface AcpxUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface AcpxChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
