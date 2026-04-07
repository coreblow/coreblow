import { describe, it, expect } from 'vitest';
import { DiagnosticsOtelExtension } from '../extension';

describe('DiagnosticsOtelExtension', () => {
  it('should initialize', async () => {
    const ext = new DiagnosticsOtelExtension();
    expect(ext.name).toBe('diagnostics-otel');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new DiagnosticsOtelExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new DiagnosticsOtelExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
