import { describe, it, expect } from 'vitest';
import { PhoneControlExtension } from '../../extension';
import { PhoneControlRuntime } from '../runtime';

describe('PhoneControlRuntime', () => {
  it('should start and stop', async () => {
    const ext = new PhoneControlExtension();
    const runtime = new PhoneControlRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new PhoneControlExtension();
    const runtime = new PhoneControlRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new PhoneControlExtension();
    const runtime = new PhoneControlRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
