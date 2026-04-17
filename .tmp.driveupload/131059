import { describe, it, expect } from 'vitest';
import { ZalouserExtension } from '../extension';

describe('ZalouserExtension', () => {
  it('should initialize', async () => {
    const ext = new ZalouserExtension();
    expect(ext.name).toBe('zalouser');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new ZalouserExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new ZalouserExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
