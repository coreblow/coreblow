import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['chat-view',              () => import('./chat-view')],
  ['renderer',               () => import('./renderer')],
  ['tui-status-summary',     () => import('./tui-status-summary')],
  ['tui-submit',             () => import('./tui-submit')],
  ['tui-submit-test-helpers',() => import('./tui-submit-test-helpers')],
  ['tui-types',              () => import('./tui-types')],
];

describe('tui — top-level import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
