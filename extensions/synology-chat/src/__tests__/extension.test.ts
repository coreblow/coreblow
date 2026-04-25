import { describe, it, expect } from 'vitest';
import { SynologyChatExtension } from '../extension.js';

describe('SynologyChatExtension', () => {
  it('should initialize', async () => {
    const ext = new SynologyChatExtension();
    expect(ext.name).toBe('synology-chat');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new SynologyChatExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new SynologyChatExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
