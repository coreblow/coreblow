import { describe, it, expect } from 'vitest';
import { GoogleGeminiCliAuthExtension } from '../extension.js';

describe('GoogleGeminiCliAuthExtension', () => {
  it('should initialize', async () => {
    const ext = new GoogleGeminiCliAuthExtension();
    expect(ext.name).toBe('google-gemini-cli-auth');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new GoogleGeminiCliAuthExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new GoogleGeminiCliAuthExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
