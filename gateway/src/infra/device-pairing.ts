/** CoreBlow — Device Pairing */
export interface PairingRequest { deviceId: string; deviceName: string; token: string; expiresAt: number; }
export interface PairedDevice { deviceId: string; deviceName: string; pairedAt: number; lastSeen: number; }
export function createPairingToken(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase(); }
export function isPairingExpired(request: PairingRequest): boolean { return Date.now() > request.expiresAt; }
