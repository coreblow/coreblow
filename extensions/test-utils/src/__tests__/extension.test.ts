import { describe, it, expect } from 'vitest';
import { TestUtilsExtension } from '../extension.js';

describe('TestUtilsExtension', () => {
  it('should initialize', async () => {
    const ext = new TestUtilsExtension();
    expect(ext.name).toBe('test-utils');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new TestUtilsExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new TestUtilsExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
