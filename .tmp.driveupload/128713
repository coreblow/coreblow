import { describe, it, expect } from 'vitest';
import { WhatsappExtension } from '../../extension';
import { WhatsappRuntime } from '../runtime';

describe('WhatsappRuntime', () => {
  it('should start and stop', async () => {
    const ext = new WhatsappExtension();
    const runtime = new WhatsappRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new WhatsappExtension();
    const runtime = new WhatsappRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new WhatsappExtension();
    const runtime = new WhatsappRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
