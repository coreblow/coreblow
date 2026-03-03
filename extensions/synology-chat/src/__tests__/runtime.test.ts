import { describe, it, expect } from 'vitest';
import { SynologyChatExtension } from '../../extension.js';
import { SynologyChatRuntime } from '../runtime.js';

describe('SynologyChatRuntime', () => {
  it('should start and stop', async () => {
    const ext = new SynologyChatExtension();
    const runtime = new SynologyChatRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new SynologyChatExtension();
    const runtime = new SynologyChatRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new SynologyChatExtension();
    const runtime = new SynologyChatRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
