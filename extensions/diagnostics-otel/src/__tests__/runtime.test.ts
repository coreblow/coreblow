import { describe, it, expect } from 'vitest';
import { DiagnosticsOtelExtension } from '../../extension';
import { DiagnosticsOtelRuntime } from '../runtime';

describe('DiagnosticsOtelRuntime', () => {
  it('should start and stop', async () => {
    const ext = new DiagnosticsOtelExtension();
    const runtime = new DiagnosticsOtelRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new DiagnosticsOtelExtension();
    const runtime = new DiagnosticsOtelRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new DiagnosticsOtelExtension();
    const runtime = new DiagnosticsOtelRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
