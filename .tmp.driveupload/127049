import { describe, it, expect } from 'vitest';
import { NextcloudTalkExtension } from '../../extension';
import { NextcloudTalkRuntime } from '../runtime';

describe('NextcloudTalkRuntime', () => {
  it('should start and stop', async () => {
    const ext = new NextcloudTalkExtension();
    const runtime = new NextcloudTalkRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new NextcloudTalkExtension();
    const runtime = new NextcloudTalkRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new NextcloudTalkExtension();
    const runtime = new NextcloudTalkRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
