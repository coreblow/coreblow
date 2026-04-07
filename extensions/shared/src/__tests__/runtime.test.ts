import { describe, it, expect } from 'vitest';
import { SharedExtension } from '../../extension';
import { SharedRuntime } from '../runtime';

describe('SharedRuntime', () => {
  it('should start and stop', async () => {
    const ext = new SharedExtension();
    const runtime = new SharedRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new SharedExtension();
    const runtime = new SharedRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new SharedExtension();
    const runtime = new SharedRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
