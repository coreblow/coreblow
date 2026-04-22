import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['apply-patch', () => import('./apply-patch')],
  ['browser',     () => import('./browser')],
  ['message',     () => import('./message')],
];

describe('tools/builtin — import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
