import { describe, it, expect } from 'vitest';
import { QwenPortalAuthExtension } from '../extension';

describe('QwenPortalAuthExtension', () => {
  it('should initialize', async () => {
    const ext = new QwenPortalAuthExtension();
    expect(ext.name).toBe('qwen-portal-auth');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new QwenPortalAuthExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new QwenPortalAuthExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
