import { describe, it, expect } from 'vitest';
import { BluebubblesExtension } from '../extension';

describe('BluebubblesExtension', () => {
  it('should initialize', async () => {
    const ext = new BluebubblesExtension();
    expect(ext.name).toBe('bluebubbles');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new BluebubblesExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new BluebubblesExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
