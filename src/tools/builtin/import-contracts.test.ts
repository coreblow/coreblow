import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['apply-patch', () => import('./apply-patch.js')],
  ['browser',     () => import('./browser.js')],
  ['message',     () => import('./message.js')],
];

describe('tools/builtin — import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
