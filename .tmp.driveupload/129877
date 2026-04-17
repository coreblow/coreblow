import { describe, it, expect } from 'vitest';
import { GooglechatExtension } from '../../extension';
import { GooglechatRuntime } from '../runtime';

describe('GooglechatRuntime', () => {
  it('should start and stop', async () => {
    const ext = new GooglechatExtension();
    const runtime = new GooglechatRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new GooglechatExtension();
    const runtime = new GooglechatRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new GooglechatExtension();
    const runtime = new GooglechatRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
