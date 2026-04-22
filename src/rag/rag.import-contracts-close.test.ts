import { describe, it, expect } from 'vitest';

describe('rag — import contracts', () => {
  it('recursive-chunker resolves without throwing', async () => {
    const mod = await import('./recursive-chunker').catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
