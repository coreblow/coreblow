/**
 * DevicePair Types
 */
export interface DevicePairMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface DevicePairUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface DevicePairChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
