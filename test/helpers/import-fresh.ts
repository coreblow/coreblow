/**
 * Helper for importing modules fresh (bypassing Vite module cache).
 *
 * Vitest keys module instances by the full URL string, including the query
 * suffix. These tests rely on that behavior to emulate code-split chunks.
 *
 * Ported from OpenClaw reference: test/helpers/import-fresh.ts
 */
export async function importFreshModule<TModule>(
  from: string,
  specifier: string,
): Promise<TModule> {
  return (await import(/* @vite-ignore */ new URL(specifier, from).href)) as TModule;
}
