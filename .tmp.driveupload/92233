/**
 * pairing/setup-code.ts
 * Pairing setup payload resolution — URL, token, QR.
 * Ported from OpenClaw src/pairing/setup-code.ts.
 */

import os from 'node:os';
import crypto from 'node:crypto';

export type PairingSetupPayload = {
    url: string;
    bootstrapToken: string;
};

export type PairingSetupResolution =
    | { ok: true; payload: PairingSetupPayload; authLabel: 'token' | 'password'; urlSource: string }
    | { ok: false; error: string };

export type ResolvePairingSetupOptions = {
    env?: NodeJS.ProcessEnv;
    publicUrl?: string;
    preferRemoteUrl?: boolean;
    forceSecure?: boolean;
    gatewayPort?: number;
};

/**
 * Resolve the pairing setup payload (URL + bootstrap token).
 */
export function resolvePairingSetup(opts?: ResolvePairingSetupOptions): PairingSetupResolution {
    const env = opts?.env ?? process.env;
    const port = opts?.gatewayPort ?? parseInt(env.COREBLOW_PORT ?? '3007', 10);

    // Generate a one-time bootstrap token
    const bootstrapToken = crypto.randomBytes(32).toString('hex');

    // Resolve URL
    const url = resolveSetupUrl(port, opts);
    if (!url) {
        return { ok: false, error: 'Cannot determine pairing URL. Set COREBLOW_PUBLIC_URL or ensure the gateway is accessible.' };
    }

    return {
        ok: true,
        payload: { url, bootstrapToken },
        authLabel: 'token',
        urlSource: opts?.publicUrl ? 'explicit' : 'auto-detected',
    };
}

function resolveSetupUrl(port: number, opts?: ResolvePairingSetupOptions): string | null {
    if (opts?.publicUrl) return opts.publicUrl;

    // Try to find a LAN IP
    const lanIp = findLanIp();
    if (lanIp) {
        const proto = opts?.forceSecure ? 'https' : 'http';
        return `${proto}://${lanIp}:${port}`;
    }

    return `http://localhost:${port}`;
}

function findLanIp(): string | null {
    const interfaces = os.networkInterfaces();
    for (const entries of Object.values(interfaces)) {
        if (!entries) continue;
        for (const entry of entries) {
            if (entry.family === 'IPv4' && !entry.internal && isRfc1918(entry.address)) {
                return entry.address;
            }
        }
    }
    return null;
}

function isRfc1918(ip: string): boolean {
    return ip.startsWith('10.') || ip.startsWith('192.168.') ||
        (ip.startsWith('172.') && (() => { const s = parseInt(ip.split('.')[1], 10); return s >= 16 && s <= 31; })());
}

/**
 * Format a pairing setup for CLI display.
 */
export function formatPairingSetup(resolution: PairingSetupResolution): string {
    if (!resolution.ok) return `❌ Pairing setup failed: ${resolution.error}`;
    const lines = [
        '🔗 Device Pairing Setup',
        '',
        `  URL:   ${resolution.payload.url}`,
        `  Token: ${resolution.payload.bootstrapToken}`,
        `  Auth:  ${resolution.authLabel}`,
        `  Source: ${resolution.urlSource}`,
        '',
        'Share this URL with devices that need to pair with this instance.',
    ];
    return lines.join('\n');
}
