/** CoreBlow — Hook Module Loader */ export async function loadHookModule(path: string): Promise<unknown> { try { return await import(path); } catch { return null; } }
