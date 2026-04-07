import { describe, it, expect } from 'vitest';
import { AcpxExtension } from '../extension';

describe('AcpxExtension', () => {
  it('should initialize', async () => {
    const ext = new AcpxExtension();
    expect(ext.name).toBe('acpx');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new AcpxExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new AcpxExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
