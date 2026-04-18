/** CoreBlow — Transport Ready */
export interface TransportReadyStatus { ready: boolean; transport: string; latencyMs?: number; error?: string; }
export function createReadyStatus(transport: string, ready: boolean, latencyMs?: number): TransportReadyStatus { return { ready, transport, latencyMs }; }
