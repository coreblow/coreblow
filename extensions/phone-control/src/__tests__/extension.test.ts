import { describe, it, expect } from 'vitest';
import { PhoneControlExtension } from '../extension.js';

describe('PhoneControlExtension', () => {
  it('should initialize', async () => {
    const ext = new PhoneControlExtension();
    expect(ext.name).toBe('phone-control');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new PhoneControlExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new PhoneControlExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
