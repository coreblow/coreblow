import { describe, it, expect } from 'vitest';
import { MsteamsExtension } from '../../extension';
import { MsteamsRuntime } from '../runtime';

describe('MsteamsRuntime', () => {
  it('should start and stop', async () => {
    const ext = new MsteamsExtension();
    const runtime = new MsteamsRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new MsteamsExtension();
    const runtime = new MsteamsRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new MsteamsExtension();
    const runtime = new MsteamsRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
