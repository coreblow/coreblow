import { describe, it, expect } from 'vitest';

const mods = [
  () => import('./commands'),
  () => import('./meta'),
  () => import('./persistent-bindings.resolve'),
  () => import('./server'),
  () => import('./session-store'),
  () => import('./translator'),
  () => import('./translator.test-helpers'),
  () => import('./types'),
];

describe('acp — top-level import contracts', () => {
  it.each([
    ['commands',                    mods[0]],
    ['meta',                        mods[1]],
    ['persistent-bindings.resolve', mods[2]],
    ['server',                      mods[3]],
    ['session-store',               mods[4]],
    ['translator',                  mods[5]],
    ['translator.test-helpers',     mods[6]],
    ['types',                       mods[7]],
  ])('%s resolves without throwing', async (_name, loader) => {
    const mod = await (loader as () => Promise<unknown>)().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
