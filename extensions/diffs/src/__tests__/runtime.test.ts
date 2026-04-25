import { describe, it, expect } from 'vitest';
import { DiffsExtension } from '../../extension.js';
import { DiffsRuntime } from '../runtime.js';

describe('DiffsRuntime', () => {
  it('should start and stop', async () => {
    const ext = new DiffsExtension();
    const runtime = new DiffsRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new DiffsExtension();
    const runtime = new DiffsRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new DiffsExtension();
    const runtime = new DiffsRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
