import { describe, it, expect } from 'vitest';
import { GoogleGeminiCliAuthExtension } from '../../extension.js';
import { GoogleGeminiCliAuthRuntime } from '../runtime.js';

describe('GoogleGeminiCliAuthRuntime', () => {
  it('should start and stop', async () => {
    const ext = new GoogleGeminiCliAuthExtension();
    const runtime = new GoogleGeminiCliAuthRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new GoogleGeminiCliAuthExtension();
    const runtime = new GoogleGeminiCliAuthRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new GoogleGeminiCliAuthExtension();
    const runtime = new GoogleGeminiCliAuthRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
