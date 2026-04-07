import { describe, it, expect } from 'vitest';
import { ImessageExtension } from '../extension';

describe('ImessageExtension', () => {
  it('should initialize', async () => {
    const ext = new ImessageExtension();
    expect(ext.name).toBe('imessage');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new ImessageExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new ImessageExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
