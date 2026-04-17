import { describe, it, expect } from 'vitest';
import { ZaloExtension } from '../../extension';
import { ZaloRuntime } from '../runtime';

describe('ZaloRuntime', () => {
  it('should start and stop', async () => {
    const ext = new ZaloExtension();
    const runtime = new ZaloRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new ZaloExtension();
    const runtime = new ZaloRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new ZaloExtension();
    const runtime = new ZaloRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
