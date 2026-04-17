import { describe, it, expect } from 'vitest';
import { TelegramExtension } from '../extension';

describe('TelegramExtension', () => {
  it('should initialize', async () => {
    const ext = new TelegramExtension();
    expect(ext.name).toBe('telegram');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new TelegramExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new TelegramExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
