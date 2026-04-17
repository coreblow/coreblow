import { describe, it, expect } from 'vitest';
import { QwenPortalAuthExtension } from '../../extension';
import { QwenPortalAuthRuntime } from '../runtime';

describe('QwenPortalAuthRuntime', () => {
  it('should start and stop', async () => {
    const ext = new QwenPortalAuthExtension();
    const runtime = new QwenPortalAuthRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new QwenPortalAuthExtension();
    const runtime = new QwenPortalAuthRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new QwenPortalAuthExtension();
    const runtime = new QwenPortalAuthRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
