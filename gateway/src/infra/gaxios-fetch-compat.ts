/** CoreBlow — Gaxios Fetch Compat */ export function createGaxiosFetchAdapter(): typeof fetch { return globalThis.fetch; }
