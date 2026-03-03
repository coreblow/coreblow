import { describe, it, expect } from 'vitest';
import { TlonExtension } from '../extension.js';

describe('TlonExtension', () => {
  it('should initialize', async () => {
    const ext = new TlonExtension();
    expect(ext.name).toBe('tlon');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new TlonExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new TlonExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
