/**
 * Ambient type augmentation for node:fs/promises.
 * fs.glob is available in Node 22.0+ but @types/node@20.x
 * does not include it.
 */
declare module "node:fs/promises" {
  export function glob(
    pattern: string | string[],
    options?: { cwd?: string; exclude?: ((path: string) => boolean) | string[] },
  ): AsyncIterable<string>;
}
