import { describe, it, expect } from 'vitest';
import { OpenProseExtension } from '../extension';

describe('OpenProseExtension', () => {
  it('should initialize', async () => {
    const ext = new OpenProseExtension();
    expect(ext.name).toBe('open-prose');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new OpenProseExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new OpenProseExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
