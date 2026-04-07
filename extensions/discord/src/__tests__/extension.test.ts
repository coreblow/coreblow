import { describe, it, expect } from 'vitest';
import { DiscordExtension } from '../extension';

describe('DiscordExtension', () => {
  it('should initialize', async () => {
    const ext = new DiscordExtension();
    expect(ext.name).toBe('discord');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new DiscordExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new DiscordExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
