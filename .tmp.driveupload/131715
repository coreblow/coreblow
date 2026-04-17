import { describe, it, expect } from 'vitest';
import { NostrExtension } from '../extension';

describe('NostrExtension', () => {
  it('should initialize', async () => {
    const ext = new NostrExtension();
    expect(ext.name).toBe('nostr');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new NostrExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new NostrExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
