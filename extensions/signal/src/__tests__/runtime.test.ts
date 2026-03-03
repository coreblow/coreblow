import { describe, it, expect } from 'vitest';
import { SignalExtension } from '../../extension.js';
import { SignalRuntime } from '../runtime.js';

describe('SignalRuntime', () => {
  it('should start and stop', async () => {
    const ext = new SignalExtension();
    const runtime = new SignalRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new SignalExtension();
    const runtime = new SignalRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new SignalExtension();
    const runtime = new SignalRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
