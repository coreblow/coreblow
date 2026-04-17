import { describe, it, expect } from 'vitest';
import { MatrixExtension } from '../../extension';
import { MatrixRuntime } from '../runtime';

describe('MatrixRuntime', () => {
  it('should start and stop', async () => {
    const ext = new MatrixExtension();
    const runtime = new MatrixRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new MatrixExtension();
    const runtime = new MatrixRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new MatrixExtension();
    const runtime = new MatrixRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
