import { describe, it, expect } from 'vitest';
import { NostrExtension } from '../../extension.js';
import { NostrRuntime } from '../runtime.js';

describe('NostrRuntime', () => {
  it('should start and stop', async () => {
    const ext = new NostrExtension();
    const runtime = new NostrRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new NostrExtension();
    const runtime = new NostrRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new NostrExtension();
    const runtime = new NostrRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
