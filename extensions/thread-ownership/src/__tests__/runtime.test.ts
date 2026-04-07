import { describe, it, expect } from 'vitest';
import { ThreadOwnershipExtension } from '../../extension';
import { ThreadOwnershipRuntime } from '../runtime';

describe('ThreadOwnershipRuntime', () => {
  it('should start and stop', async () => {
    const ext = new ThreadOwnershipExtension();
    const runtime = new ThreadOwnershipRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new ThreadOwnershipExtension();
    const runtime = new ThreadOwnershipRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new ThreadOwnershipExtension();
    const runtime = new ThreadOwnershipRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
