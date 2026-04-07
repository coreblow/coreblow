import { describe, it, expect } from 'vitest';
import { DevicePairExtension } from '../../extension';
import { DevicePairRuntime } from '../runtime';

describe('DevicePairRuntime', () => {
  it('should start and stop', async () => {
    const ext = new DevicePairExtension();
    const runtime = new DevicePairRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new DevicePairExtension();
    const runtime = new DevicePairRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new DevicePairExtension();
    const runtime = new DevicePairRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
