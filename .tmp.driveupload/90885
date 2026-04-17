/** Custom API endpoint registry. */
const customApis = new Map<string, { baseUrl: string; headers?: Record<string, string> }>();
export function registerCustomApi(name: string, baseUrl: string, headers?: Record<string, string>): void { customApis.set(name, { baseUrl, headers }); }
export function getCustomApi(name: string) { return customApis.get(name); }
export function listCustomApis(): string[] { return [...customApis.keys()]; }
export function clearCustomApis(): void { customApis.clear(); }
