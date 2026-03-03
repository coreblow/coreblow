import { describe, it, expect } from 'vitest';
import { MemoryCoreExtension } from '../extension.js';

describe('MemoryCoreExtension', () => {
  it('should initialize', async () => {
    const ext = new MemoryCoreExtension();
    expect(ext.name).toBe('memory-core');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new MemoryCoreExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new MemoryCoreExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
