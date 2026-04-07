import { describe, it, expect } from 'vitest';
import { MemoryLancedbExtension } from '../extension';

describe('MemoryLancedbExtension', () => {
  it('should initialize', async () => {
    const ext = new MemoryLancedbExtension();
    expect(ext.name).toBe('memory-lancedb');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new MemoryLancedbExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new MemoryLancedbExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
