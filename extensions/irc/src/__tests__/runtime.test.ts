import { describe, it, expect } from 'vitest';
import { IrcExtension } from '../../extension.js';
import { IrcRuntime } from '../runtime.js';

describe('IrcRuntime', () => {
  it('should start and stop', async () => {
    const ext = new IrcExtension();
    const runtime = new IrcRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new IrcExtension();
    const runtime = new IrcRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new IrcExtension();
    const runtime = new IrcRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
