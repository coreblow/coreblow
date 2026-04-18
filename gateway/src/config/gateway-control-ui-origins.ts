/** CoreBlow — Gateway Control UI Origins */
export function resolveControlUiOrigins(port: number, extraOrigins?: string[]): string[] { const origins = ["http://localhost:" + port, "http://127.0.0.1:" + port]; if (extraOrigins) origins.push(...extraOrigins); return [...new Set(origins)]; }
