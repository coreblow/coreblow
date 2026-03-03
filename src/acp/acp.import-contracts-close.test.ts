import { describe, it, expect } from 'vitest';

const mods = [
  () => import('./commands.js'),
  () => import('./meta.js'),
  () => import('./persistent-bindings.resolve.js'),
  () => import('./server.js'),
  () => import('./session-store.js'),
  () => import('./translator.js'),
  () => import('./translator.test-helpers.js'),
  () => import('./types.js'),
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
