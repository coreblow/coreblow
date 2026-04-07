/**
 * Matrix Types
 */
export interface MatrixMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface MatrixUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface MatrixChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
