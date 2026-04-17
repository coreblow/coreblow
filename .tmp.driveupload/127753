import { describe, it, expect } from 'vitest';
import { TwitchExtension } from '../extension';

describe('TwitchExtension', () => {
  it('should initialize', async () => {
    const ext = new TwitchExtension();
    expect(ext.name).toBe('twitch');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new TwitchExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new TwitchExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
