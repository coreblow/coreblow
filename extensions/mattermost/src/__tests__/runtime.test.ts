import { describe, it, expect } from 'vitest';
import { MattermostExtension } from '../../extension';
import { MattermostRuntime } from '../runtime';

describe('MattermostRuntime', () => {
  it('should start and stop', async () => {
    const ext = new MattermostExtension();
    const runtime = new MattermostRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new MattermostExtension();
    const runtime = new MattermostRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new MattermostExtension();
    const runtime = new MattermostRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
