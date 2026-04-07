import { describe, it, expect } from 'vitest';
import { MatrixExtension } from '../extension';

describe('MatrixExtension', () => {
  it('should initialize', async () => {
    const ext = new MatrixExtension();
    expect(ext.name).toBe('matrix');
    await ext.init({});
  });

  it('should start and stop', async () => {
    const ext = new MatrixExtension();
    expect(await ext.start()).toBe(true);
    expect(await ext.stop()).toBe(true);
  });

  it('should handle messages', async () => {
    const ext = new MatrixExtension();
    const result = await ext.handleMessage({ text: 'hello' });
    expect(result.handled).toBe(true);
  });
});
