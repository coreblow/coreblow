import { describe, it, expect } from 'vitest';
import { BluebubblesExtension } from '../../extension.js';
import { BluebubblesRuntime } from '../runtime.js';

describe('BluebubblesRuntime', () => {
  it('should start and stop', async () => {
    const ext = new BluebubblesExtension();
    const runtime = new BluebubblesRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new BluebubblesExtension();
    const runtime = new BluebubblesRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new BluebubblesExtension();
    const runtime = new BluebubblesRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
