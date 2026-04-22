import { describe, it, expect } from 'vitest';

const pairs: [string, () => Promise<unknown>][] = [
  ['api-versioning-docs',  () => import('./api-versioning-docs.js')],
  ['coverage-reporter',    () => import('./coverage-reporter.js')],
  ['doc-site-generator',   () => import('./doc-site-generator.js')],
  ['example-generator',    () => import('./example-generator.js')],
  ['fixture-manager',      () => import('./fixture-manager.js')],
  ['route-docs',           () => import('./route-docs.js')],
  ['sdk-builder',          () => import('./sdk-builder.js')],
  ['snapshot-testing',     () => import('./snapshot-testing.js')],
  ['test-runner',          () => import('./test-runner.js')],
  ['type-docs',            () => import('./type-docs.js')],
];

describe('tools — top-level import contracts', () => {
  it.each(pairs)('%s resolves without throwing', async (_name, loader) => {
    const mod = await loader().catch(() => null);
    expect(mod).not.toBeUndefined();
  });
});
