import { describe, it, expect } from 'vitest';
import { IrcExtension } from '../extension.js';

describe('IrcExtension', () => {
  it('should initialize', async () => {
    const ext = new IrcExtension();
    expect(ext.name).toBe('irc');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new IrcExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new IrcExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
