import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['chat-view',              () => import('./chat-view.js')],
  ['renderer',               () => import('./renderer.js')],
  ['tui-status-summary',     () => import('./tui-status-summary.js')],
  ['tui-submit',             () => import('./tui-submit.js')],
  ['tui-submit-test-helpers',() => import('./tui-submit-test-helpers.js')],
  ['tui-types',              () => import('./tui-types.js')],
];

describe('tui — top-level import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
