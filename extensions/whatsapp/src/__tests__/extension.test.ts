import { describe, it, expect } from 'vitest';
import { WhatsappExtension } from '../extension.js';

describe('WhatsappExtension', () => {
  it('should initialize', async () => {
    const ext = new WhatsappExtension();
    expect(ext.name).toBe('whatsapp');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new WhatsappExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new WhatsappExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
