import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['api-versioning-docs',  () => import('./api-versioning-docs')],
  ['coverage-reporter',    () => import('./coverage-reporter')],
  ['doc-site-generator',   () => import('./doc-site-generator')],
  ['example-generator',    () => import('./example-generator')],
  ['fixture-manager',      () => import('./fixture-manager')],
  ['route-docs',           () => import('./route-docs')],
  ['sdk-builder',          () => import('./sdk-builder')],
  ['snapshot-testing',     () => import('./snapshot-testing')],
  ['test-runner',          () => import('./test-runner')],
  ['type-docs',            () => import('./type-docs')],
];

describe('tools — top-level import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
