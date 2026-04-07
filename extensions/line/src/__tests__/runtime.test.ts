import { describe, it, expect } from 'vitest';
import { LineExtension } from '../../extension';
import { LineRuntime } from '../runtime';

describe('LineRuntime', () => {
  it('should start and stop', async () => {
    const ext = new LineExtension();
    const runtime = new LineRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new LineExtension();
    const runtime = new LineRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new LineExtension();
    const runtime = new LineRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
