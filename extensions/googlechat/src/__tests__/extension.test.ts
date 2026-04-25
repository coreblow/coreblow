import { describe, it, expect } from 'vitest';
import { GooglechatExtension } from '../extension.js';

describe('GooglechatExtension', () => {
  it('should initialize', async () => {
    const ext = new GooglechatExtension();
    expect(ext.name).toBe('googlechat');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new GooglechatExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new GooglechatExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
