import { describe, it, expect } from 'vitest';
import { LineExtension } from '../extension.js';

describe('LineExtension', () => {
  it('should initialize', async () => {
    const ext = new LineExtension();
    expect(ext.name).toBe('line');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new LineExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new LineExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
