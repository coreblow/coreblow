import { describe, it, expect } from 'vitest';
import { SharedExtension } from '../extension.js';

describe('SharedExtension', () => {
  it('should initialize', async () => {
    const ext = new SharedExtension();
    expect(ext.name).toBe('shared');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new SharedExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new SharedExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
