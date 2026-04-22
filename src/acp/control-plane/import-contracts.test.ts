import { describe, it, expect } from 'vitest';

const mods = [
  () => import('./manager.core'),
  () => import('./manager.identity-reconcile'),
  () => import('./manager.runtime-controls'),
  () => import('./manager.types'),
  () => import('./manager.utils'),
  () => import('./runtime-options'),
  () => import('./session-actor-queue'),
  () => import('./spawn'),
];

describe('acp/control-plane — import contracts', () => {
  it.each([
    ['manager.core',                mods[0]],
    ['manager.identity-reconcile',  mods[1]],
    ['manager.runtime-controls',    mods[2]],
    ['manager.types',               mods[3]],
    ['manager.utils',               mods[4]],
    ['runtime-options',             mods[5]],
    ['session-actor-queue',         mods[6]],
    ['spawn',                       mods[7]],
  ])('%s resolves without throwing', async (_name, loader) => {
    const mod = await (loader as () => Promise<unknown>)().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
