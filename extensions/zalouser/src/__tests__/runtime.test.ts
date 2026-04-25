import { describe, it, expect } from 'vitest';
import { ZalouserExtension } from '../../extension.js';
import { ZalouserRuntime } from '../runtime.js';

describe('ZalouserRuntime', () => {
  it('should start and stop', async () => {
    const ext = new ZalouserExtension();
    const runtime = new ZalouserRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new ZalouserExtension();
    const runtime = new ZalouserRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new ZalouserExtension();
    const runtime = new ZalouserRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
