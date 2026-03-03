// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { IrcChannelImpl } from '../channel.js';

describe('IrcChannel', () => {
  it('should connect and disconnect', async () => {
    const ch = new IrcChannelImpl('test-channel');
    await ch.connect('test-token');
    expect(ch).toBeDefined();
    await ch.disconnect();
  });

  it('should send messages', async () => {
    const ch = new IrcChannelImpl('test');
    await ch.connect('token');
    const result = await ch.sendMessage('Hello');
    expect(result.content).toBe('Hello');
  });

  it('should edit messages', async () => {
    const ch = new IrcChannelImpl('test');
    const result = await ch.editMessage('msg1', 'Updated');
    expect(result.edited).toBe(true);
  });

  it('should delete messages', async () => {
    const ch = new IrcChannelImpl('test');
    const result = await ch.deleteMessage('msg1');
    expect(result.deleted).toBe(true);
  });

  it('should handle reactions', async () => {
    const ch = new IrcChannelImpl('test');
    const add = await ch.addReaction('msg1', '👍');
    expect(add.added).toBe(true);
    const remove = await ch.removeReaction('msg1', '👍');
    expect(remove.removed).toBe(true);
  });
});
