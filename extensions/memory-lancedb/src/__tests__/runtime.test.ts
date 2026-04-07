import { describe, it, expect } from 'vitest';
import { MemoryLancedbExtension } from '../../extension';
import { MemoryLancedbRuntime } from '../runtime';

describe('MemoryLancedbRuntime', () => {
  it('should start and stop', async () => {
    const ext = new MemoryLancedbExtension();
    const runtime = new MemoryLancedbRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new MemoryLancedbExtension();
    const runtime = new MemoryLancedbRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new MemoryLancedbExtension();
    const runtime = new MemoryLancedbRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
