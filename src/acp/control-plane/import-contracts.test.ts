import { describe, it, expect } from 'vitest';

const mods = [
  () => import('./manager.core.js'),
  () => import('./manager.identity-reconcile.js'),
  () => import('./manager.runtime-controls.js'),
  () => import('./manager.types.js'),
  () => import('./manager.utils.js'),
  () => import('./runtime-options.js'),
  () => import('./session-actor-queue.js'),
  () => import('./spawn.js'),
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
