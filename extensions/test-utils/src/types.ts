/**
 * TestUtils Types
 */
export interface TestUtilsMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TestUtilsUser {
  id: string;
  name: string;
  avatar?: string;
}

export interface TestUtilsChannel {
  id: string;
  name: string;
  type: 'dm' | 'group' | 'channel';
}
