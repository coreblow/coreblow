import { describe, it, expect } from 'vitest';
import { CopilotProxyExtension } from '../extension';

describe('CopilotProxyExtension', () => {
  it('should initialize', async () => {
    const ext = new CopilotProxyExtension();
    expect(ext.name).toBe('copilot-proxy');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new CopilotProxyExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new CopilotProxyExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
