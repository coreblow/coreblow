import { describe, it, expect } from 'vitest';
import { AcpExtension } from '../extension.js';

describe('AcpExtension', () => {
  it('should initialize', async () => {
    const ext = new AcpExtension();
    expect(ext.name).toBe('acp');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new AcpExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new AcpExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
