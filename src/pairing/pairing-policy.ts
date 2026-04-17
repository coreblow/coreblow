/**
 * pairing/pairing-policy.ts
 * Pairing policy enforcement — which messages require pairing.
 * Ported from CoreBlow reference pairing policy patterns.
 */

export type PairingMode = 'off' | 'dm-only' | 'all';

export interface PairingPolicyResult {
    requiresPairing: boolean;
    reason?: string;
}

/**
 * Resolve the pairing mode from config.
 */
export function resolvePairingMode(cfg?: Record<string, unknown>): PairingMode {
    const security = cfg?.security as Record<string, unknown> | undefined;
    const mode = security?.pairingMode;
    if (mode === 'off' || mode === 'dm-only' || mode === 'all') return mode;
    return 'off'; // default: no pairing required
}

/**
 * Check if a message requires pairing.
 */
export function requiresPairing(params: {
    mode: PairingMode;
    isDirectMessage: boolean;
    isPaired: boolean;
    channel: string;
}): PairingPolicyResult {
    if (params.mode === 'off') return { requiresPairing: false };
    if (params.isPaired) return { requiresPairing: false };

    if (params.mode === 'dm-only') {
        if (!params.isDirectMessage) return { requiresPairing: false };
        return { requiresPairing: true, reason: `DM pairing required for ${params.channel}` };
    }

    // mode === 'all'
    return { requiresPairing: true, reason: `Pairing required for ${params.channel}` };
}

/**
 * Check if pairing can be bypassed (admin override, internal, etc.).
 */
export function canBypassPairing(params: {
    senderId: string;
    adminIds?: string[];
    allowPatterns?: string[];
}): boolean {
    // Admin bypass
    if (params.adminIds?.includes(params.senderId)) return true;

    // Pattern bypass
    if (params.allowPatterns) {
        for (const pattern of params.allowPatterns) {
            if (pattern === '*') return true;
            if (pattern.endsWith('*') && params.senderId.startsWith(pattern.slice(0, -1))) return true;
            if (params.senderId === pattern) return true;
        }
    }

    return false;
}
