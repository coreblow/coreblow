import { describe, it, expect } from 'vitest';
import { LobsterExtension } from '../../extension';
import { LobsterRuntime } from '../runtime';

describe('LobsterRuntime', () => {
  it('should start and stop', async () => {
    const ext = new LobsterExtension();
    const runtime = new LobsterRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new LobsterExtension();
    const runtime = new LobsterRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new LobsterExtension();
    const runtime = new LobsterRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
