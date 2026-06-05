// @ts-nocheck
import { describe, it, expect } from 'vitest';
import { AcpExtension } from '../../extension.js';
import { AcpCliRuntime } from '../runtime.js';

describe('AcpCliRuntime', () => {
  it('should start and stop', async () => {
    const ext = new AcpExtension();
    const runtime = new AcpCliRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new AcpExtension();
    const runtime = new AcpCliRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new AcpExtension();
    const runtime = new AcpCliRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
