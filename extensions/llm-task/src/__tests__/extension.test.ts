import { describe, it, expect } from 'vitest';
import { LlmTaskExtension } from '../extension.js';

describe('LlmTaskExtension', () => {
  it('should initialize', async () => {
    const ext = new LlmTaskExtension();
    expect(ext.name).toBe('llm-task');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new LlmTaskExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new LlmTaskExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
