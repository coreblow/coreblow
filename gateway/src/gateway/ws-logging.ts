/** CoreBlow — WS Logging */ export function logWsEvent(connectionId: string, event: string, details?: unknown): void { console.log("[ws:" + connectionId.slice(0, 8) + "] " + event); }
