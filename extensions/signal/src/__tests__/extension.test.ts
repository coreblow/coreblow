import { describe, it, expect } from 'vitest';
import { SignalExtension } from '../extension';

describe('SignalExtension', () => {
  it('should initialize', async () => {
    const ext = new SignalExtension();
    expect(ext.name).toBe('signal');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new SignalExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new SignalExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
