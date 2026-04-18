/** CoreBlow — Session Store Runtime */
let storeDir: string | null = null;
export function setSessionStoreDir(dir: string): void { storeDir = dir; }
export function getSessionStoreDir(): string | null { return storeDir; }
