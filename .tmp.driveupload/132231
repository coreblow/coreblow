import { describe, it, expect } from 'vitest';
import { AcpxChannelImpl } from '../channel';

describe('AcpxChannel', () => {
  it('should connect and disconnect', async () => {
    const ch = new AcpxChannelImpl('test-channel');
    await ch.connect('test-token');
    expect(ch).toBeDefined();
    await ch.disconnect();
  });

  it('should send messages', async () => {
    const ch = new AcpxChannelImpl('test');
    await ch.connect('token');
    const result = await ch.sendMessage('Hello');
    expect(result.content).toBe('Hello');
  });

  it('should edit messages', async () => {
    const ch = new AcpxChannelImpl('test');
    const result = await ch.editMessage('msg1', 'Updated');
    expect(result.edited).toBe(true);
  });

  it('should delete messages', async () => {
    const ch = new AcpxChannelImpl('test');
    const result = await ch.deleteMessage('msg1');
    expect(result.deleted).toBe(true);
  });

  it('should handle reactions', async () => {
    const ch = new AcpxChannelImpl('test');
    const add = await ch.addReaction('msg1', '👍');
    expect(add.added).toBe(true);
    const remove = await ch.removeReaction('msg1', '👍');
    expect(remove.removed).toBe(true);
  });
});
