import { describe, it, expect } from 'vitest';
import { ThreadOwnershipExtension } from '../extension';

describe('ThreadOwnershipExtension', () => {
  it('should initialize', async () => {
    const ext = new ThreadOwnershipExtension();
    expect(ext.name).toBe('thread-ownership');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new ThreadOwnershipExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new ThreadOwnershipExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
