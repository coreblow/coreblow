import { describe, it, expect } from 'vitest';
import { SlackExtension } from '../extension';

describe('SlackExtension', () => {
  it('should initialize', async () => {
    const ext = new SlackExtension();
    expect(ext.name).toBe('slack');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new SlackExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new SlackExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
