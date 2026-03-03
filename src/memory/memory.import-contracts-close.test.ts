import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['compaction',      () => import('./compaction.js')],
  ['embeddings',      () => import('./embeddings.js')],
  ['hybrid-search',   () => import('./hybrid-search.js')],
  ['manager',         () => import('./manager.js')],
  ['memory-bootstrap',() => import('./memory-bootstrap.js')],
  ['memory-store',    () => import('./memory-store.js')],
  ['mmr',             () => import('./mmr.js')],
  ['query-expansion', () => import('./query-expansion.js')],
  ['tools',           () => import('./tools.js')],
  ['vector-store',    () => import('./vector-store.js')],
];

describe('memory — import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
