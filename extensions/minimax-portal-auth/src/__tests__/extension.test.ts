import { describe, it, expect } from 'vitest';
import { MinimaxPortalAuthExtension } from '../extension.js';

describe('MinimaxPortalAuthExtension', () => {
  it('should initialize', async () => {
    const ext = new MinimaxPortalAuthExtension();
    expect(ext.name).toBe('minimax-portal-auth');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new MinimaxPortalAuthExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new MinimaxPortalAuthExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
