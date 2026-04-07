import { describe, it, expect } from 'vitest';
import { TelegramExtension } from '../../extension';
import { TelegramRuntime } from '../runtime';

describe('TelegramRuntime', () => {
  it('should start and stop', async () => {
    const ext = new TelegramExtension();
    const runtime = new TelegramRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new TelegramExtension();
    const runtime = new TelegramRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new TelegramExtension();
    const runtime = new TelegramRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
