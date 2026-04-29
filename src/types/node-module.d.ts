/**
 * Ambient type augmentation for node:module.
 * enableCompileCache is available in Node 22.8+ but @types/node@20.x
 * does not include it.
 */
declare module "node:module" {
  export function enableCompileCache(cacheDir?: string): {
    status: number;
    message?: string;
    directory: string;
  };
}
