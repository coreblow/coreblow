import { describe, it, expect } from 'vitest';
import { LobsterExtension } from '../extension.js';

describe('LobsterExtension', () => {
  it('should initialize', async () => {
    const ext = new LobsterExtension();
    expect(ext.name).toBe('lobster');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new LobsterExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new LobsterExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
