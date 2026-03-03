import { describe, it, expect } from 'vitest';
import { FeishuExtension } from '../extension.js';

describe('FeishuExtension', () => {
  it('should initialize', async () => {
    const ext = new FeishuExtension();
    expect(ext.name).toBe('feishu');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new FeishuExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new FeishuExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
