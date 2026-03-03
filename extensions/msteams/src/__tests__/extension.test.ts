import { describe, it, expect } from 'vitest';
import { MsteamsExtension } from '../extension.js';

describe('MsteamsExtension', () => {
  it('should initialize', async () => {
    const ext = new MsteamsExtension();
    expect(ext.name).toBe('msteams');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new MsteamsExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new MsteamsExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
