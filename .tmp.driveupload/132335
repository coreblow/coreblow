import { describe, it, expect } from 'vitest';
import { FeishuExtension } from '../../extension';
import { FeishuRuntime } from '../runtime';

describe('FeishuRuntime', () => {
  it('should start and stop', async () => {
    const ext = new FeishuExtension();
    const runtime = new FeishuRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new FeishuExtension();
    const runtime = new FeishuRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new FeishuExtension();
    const runtime = new FeishuRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
