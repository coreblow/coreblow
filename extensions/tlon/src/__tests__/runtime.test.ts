import { describe, it, expect } from 'vitest';
import { TlonExtension } from '../../extension.js';
import { TlonRuntime } from '../runtime.js';

describe('TlonRuntime', () => {
  it('should start and stop', async () => {
    const ext = new TlonExtension();
    const runtime = new TlonRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new TlonExtension();
    const runtime = new TlonRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new TlonExtension();
    const runtime = new TlonRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
