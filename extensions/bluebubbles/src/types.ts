/**
 * Bluebubbles Types
 */
export interface BluebubblesMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface BluebubblesUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface BluebubblesChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
