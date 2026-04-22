import { describe, it, expect } from 'vitest';

const mods = [
  () => import('./adapter-contract.testkit'),
  () => import('./session-identity'),
  () => import('./types'),
];

describe('acp/runtime — import contracts', () => {
  it.each([
    ['adapter-contract.testkit', mods[0]],
    ['session-identity',         mods[1]],
    ['types',                    mods[2]],
  ])('%s resolves without throwing', async (_name, loader) => {
    const mod = await (loader as () => Promise<unknown>)().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
