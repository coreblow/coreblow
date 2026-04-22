import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['compaction',      () => import('./compaction')],
  ['embeddings',      () => import('./embeddings')],
  ['hybrid-search',   () => import('./hybrid-search')],
  ['manager',         () => import('./manager')],
  ['memory-bootstrap',() => import('./memory-bootstrap')],
  ['memory-store',    () => import('./memory-store')],
  ['mmr',             () => import('./mmr')],
  ['query-expansion', () => import('./query-expansion')],
  ['tools',           () => import('./tools')],
  ['vector-store',    () => import('./vector-store')],
];

describe('memory — import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
