import { describe, it, expect } from 'vitest';
import { TwitchExtension } from '../../extension.js';
import { TwitchRuntime } from '../runtime.js';

describe('TwitchRuntime', () => {
  it('should start and stop', async () => {
    const ext = new TwitchExtension();
    const runtime = new TwitchRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new TwitchExtension();
    const runtime = new TwitchRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new TwitchExtension();
    const runtime = new TwitchRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
