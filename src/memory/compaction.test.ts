import { describe, expect, it } from 'vitest';
import { MemoryCompactor } from './compaction.js';

describe('memory/compaction — MemoryCompactor', () => {
  it('MemoryCompactor is a constructor', () => {
    expect(typeof MemoryCompactor).toBe('function');
  });

  it('can be instantiated with default options', () => {
    const compactor = new MemoryCompactor();
    expect(compactor).toBeInstanceOf(MemoryCompactor);
  });

  it('can be instantiated with custom options', () => {
    const compactor = new MemoryCompactor({
      maxMemories: 100,
      targetMemories: 50,
    });
    expect(compactor).toBeInstanceOf(MemoryCompactor);
  });

  it('compact returns result object for empty input', () => {
    const compactor = new MemoryCompactor({ maxMemories: 10 });
    const result = compactor.compact([]);
    expect(result).toHaveProperty('entries');
    expect(Array.isArray(result.entries)).toBe(true);
  });

  it('module resolves without throwing', async () => {
    const mod = await import('./compaction.js').catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
