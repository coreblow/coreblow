import { describe, it, expect } from 'vitest';
import { ZaloExtension } from '../extension';

describe('ZaloExtension', () => {
  it('should initialize', async () => {
    const ext = new ZaloExtension();
    expect(ext.name).toBe('zalo');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new ZaloExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new ZaloExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
