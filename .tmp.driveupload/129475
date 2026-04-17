import { describe, it, expect } from 'vitest';
import { TalkVoiceExtension } from '../extension';

describe('TalkVoiceExtension', () => {
  it('should initialize', async () => {
    const ext = new TalkVoiceExtension();
    expect(ext.name).toBe('talk-voice');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new TalkVoiceExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new TalkVoiceExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
