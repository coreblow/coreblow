import { describe, it, expect } from 'vitest';
import { OpenProseExtension } from '../../extension';
import { OpenProseRuntime } from '../runtime';

describe('OpenProseRuntime', () => {
  it('should start and stop', async () => {
    const ext = new OpenProseExtension();
    const runtime = new OpenProseRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new OpenProseExtension();
    const runtime = new OpenProseRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new OpenProseExtension();
    const runtime = new OpenProseRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
