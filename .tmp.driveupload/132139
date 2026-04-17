import { describe, it, expect } from 'vitest';
import { DevicePairExtension } from '../extension';

describe('DevicePairExtension', () => {
  it('should initialize', async () => {
    const ext = new DevicePairExtension();
    expect(ext.name).toBe('device-pair');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new DevicePairExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new DevicePairExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
