import { describe, it, expect } from 'vitest';
import { MattermostExtension } from '../extension';

describe('MattermostExtension', () => {
  it('should initialize', async () => {
    const ext = new MattermostExtension();
    expect(ext.name).toBe('mattermost');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new MattermostExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new MattermostExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
