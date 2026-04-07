import { describe, it, expect } from 'vitest';
import { SlackExtension } from '../../extension';
import { SlackRuntime } from '../runtime';

describe('SlackRuntime', () => {
  it('should start and stop', async () => {
    const ext = new SlackExtension();
    const runtime = new SlackRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new SlackExtension();
    const runtime = new SlackRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new SlackExtension();
    const runtime = new SlackRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
