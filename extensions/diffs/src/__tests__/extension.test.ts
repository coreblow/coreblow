import { describe, it, expect } from 'vitest';
import { DiffsExtension } from '../extension.js';

describe('DiffsExtension', () => {
  it('should initialize', async () => {
    const ext = new DiffsExtension();
    expect(ext.name).toBe('diffs');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new DiffsExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new DiffsExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
