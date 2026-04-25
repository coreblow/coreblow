import { describe, it, expect } from 'vitest';
import { TalkVoiceExtension } from '../../extension.js';
import { TalkVoiceRuntime } from '../runtime.js';

describe('TalkVoiceRuntime', () => {
  it('should start and stop', async () => {
    const ext = new TalkVoiceExtension();
    const runtime = new TalkVoiceRuntime(ext);
    await runtime.start();
    expect(runtime.isRunning()).toBe(true);
    await runtime.stop();
    expect(runtime.isRunning()).toBe(false);
  });

  it('should get channels', () => {
    const ext = new TalkVoiceExtension();
    const runtime = new TalkVoiceRuntime(ext);
    const ch = runtime.getChannel('test');
    expect(ch).toBeDefined();
  });

  it('should process messages', async () => {
    const ext = new TalkVoiceExtension();
    const runtime = new TalkVoiceRuntime(ext);
    const result = await runtime.processMessage('ch1', { text: 'hello' });
    expect(result.processed).toBe(true);
  });
});
