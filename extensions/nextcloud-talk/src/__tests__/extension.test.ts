import { describe, it, expect } from 'vitest';
import { NextcloudTalkExtension } from '../extension';

describe('NextcloudTalkExtension', () => {
  it('should initialize', async () => {
    const ext = new NextcloudTalkExtension();
    expect(ext.name).toBe('nextcloud-talk');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new NextcloudTalkExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new NextcloudTalkExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
