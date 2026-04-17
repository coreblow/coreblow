import { describe, it, expect } from 'vitest';
import { CopilotProxyExtension } from '../../extension';
import { CopilotProxyRuntime } from '../runtime';

describe('CopilotProxyRuntime', () => {
  it('should start and stop', async () => {
    const ext = new CopilotProxyExtension();
    const runtime = new CopilotProxyRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new CopilotProxyExtension();
    const runtime = new CopilotProxyRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new CopilotProxyExtension();
    const runtime = new CopilotProxyRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
