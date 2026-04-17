import { describe, it, expect } from 'vitest';
import { VoiceCallExtension } from '../extension';

describe('VoiceCallExtension', () => {
  it('should initialize', async () => {
    const ext = new VoiceCallExtension();
    expect(ext.name).toBe('voice-call');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new VoiceCallExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new VoiceCallExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
