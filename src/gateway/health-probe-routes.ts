/**
 * CoreBlow Gateway — Health Probe Routes
 *
 * Liveness dan readiness probe endpoints untuk container orchestration.
 * Pola: identik dengan CoreBlow src/gateway/server-http.ts (GATEWAY_PROBE_STATUS_BY_PATH).
 *
 * Routes:
 *   GET /health  → liveness (alias)
 *   GET /healthz → liveness (utama, dipakai HEALTHCHECK Dockerfile)
 *   GET /ready   → readiness (alias)
 *   GET /readyz  → readiness (utama, dipakai load balancer / k8s)
 *
 * Response formats:
 *   liveness  → 200 { ok: true, status: "live" }
 *   readiness → 200 { ready: true, uptimeMs: N } | 503 { ready: false }
 *
 * IMPORTANT: Register probe routes SEBELUM auth middleware — probe harus
 *            accessible tanpa token agar container orchestrator bisa check health.
 *
 * Supports both:
 *   - Express Application  → mountHealthProbes(app, opts)
 *   - Native node:http     → handleHealthProbeRequest(req, res)
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ReadinessChecker, ReadinessResult } from './server/readiness.js';

// Re-export for consumers that only need the types
export type { ReadinessChecker, ReadinessResult };

// ─── Readiness Detail Visibility ──────────────────────────────────────────────

/**
 * Loopback / private addresses yang dianggap sebagai request lokal.
 * Pola CoreBlow `isLoopbackAddress()` via `isLocalDirectRequest()`.
 */
const LOOPBACK_ADDRESSES = new Set([
    '127.0.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'localhost',
]);

/**
 * Deteksi apakah request berasal langsung dari loopback (bukan via proxy).
 * Pola: CoreBlow `isLocalDirectRequest()` — simplified version tanpa trusted proxies.
 *
 * Returns true jika:
 * - socket.remoteAddress adalah loopback, DAN
 * - Tidak ada `x-forwarded-for` / `x-real-ip` header (cegah spoofing via proxy)
 */
function isLocalDirectRequest(req: IncomingMessage): boolean {
    const remoteAddr = req.socket?.remoteAddress ?? '';
    const isLoopback = LOOPBACK_ADDRESSES.has(remoteAddr) ||
        remoteAddr.startsWith('127.');

    if (!isLoopback) return false;

    // Jika ada forwarding headers → bukan direct request (ada proxy di depan)
    const hasForwarded =
        Boolean(req.headers['x-forwarded-for']) ||
        Boolean(req.headers['x-real-ip']) ||
        Boolean(req.headers['x-forwarded-host']);

    return !hasForwarded;
}

/**
 * Resolve bearer token dari Authorization header.
 * Pola CoreBlow `getBearerToken()`.
 */
function getBearerToken(req: IncomingMessage): string | null {
    const auth = req.headers['authorization'];
    if (typeof auth !== 'string') return null;
    const prefix = 'bearer ';
    if (!auth.toLowerCase().startsWith(prefix)) return null;
    return auth.slice(prefix.length).trim() || null;
}

/**
 * Opsi auth untuk `canRevealReadinessDetails`.
 * Diisi dari gateway config saat mounting probes.
 */
export type ReadinessDetailAuthOptions = {
    /**
     * Gateway token untuk validasi bearer token.
     * Jika tidak diset (undefined) → auth mode "none" → jangan reveal detail ke external.
     */
    gatewayToken?: string;
};

/**
 * Tentukan apakah detail readiness boleh ditampilkan ke requester.
 *
 * Pola CoreBlow `canRevealReadinessDetails()` (server-http.ts L200-222).
 *
 * Rules:
 * 1. **Loopback request** (socket dari 127.x.x.x / ::1, tanpa forwarding headers) → REVEAL
 * 2. **No auth configured** (gatewayToken = undefined) → HIDE (cegah info leak pada open gateway)
 * 3. **Bearer token valid** → REVEAL
 * 4. **Semua lainnya** → HIDE
 *
 * @example
 * // Internal orchestrator (kubernetes pod → loopback via hostNetwork):
 * canRevealReadinessDetails(req, {}) // → true (loopback)
 *
 * // External monitoring dengan token:
 * canRevealReadinessDetails(req, { gatewayToken: 'secret' }) // → true jika Authorization: Bearer secret
 *
 * // Anonymous external request:
 * canRevealReadinessDetails(req, { gatewayToken: 'secret' }) // → false
 */
export function canRevealReadinessDetails(
    req: IncomingMessage,
    auth: ReadinessDetailAuthOptions,
): boolean {
    // Rule 1: loopback → selalu reveal (pola CoreBlow L206-208)
    if (isLocalDirectRequest(req)) return true;

    // Rule 2: no auth configured → hide (cegah info leak, pola CoreBlow L209-211)
    if (!auth.gatewayToken) return false;

    // Rule 3: bearer token match → reveal (pola CoreBlow L213-221)
    const bearerToken = getBearerToken(req);
    if (bearerToken && bearerToken === auth.gatewayToken) return true;

    // Rule 4: everything else → hide
    return false;
}


// === Pola CoreBlow server-http.ts line 128-133 ===
// Map of probe path → probe status type
const GATEWAY_PROBE_STATUS_BY_PATH = new Map<string, 'live' | 'ready'>([
    ['/health',  'live'],   // alias
    ['/healthz', 'live'],   // liveness probe (utama — dipakai di Dockerfile HEALTHCHECK)
    ['/ready',   'ready'],  // alias
    ['/readyz',  'ready'],  // readiness probe (utama — dipakai load balancer)
]);

// ─── Native node:http handler ─────────────────────────────────────────────────

/**
 * Check if the given pathname is a health probe path.
 * Use this in native node:http request handlers to fast-path probe requests.
 *
 * @example
 * ```typescript
 * const handler = (req, res) => {
 *   const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
 *   if (isHealthProbePath(pathname)) {
 *     handleHealthProbeRequest(req, res, pathname, { getReadiness: () => ... });
 *     return;
 *   }
 *   // ... rest of routing
 * };
 * ```
 */
export function isHealthProbePath(pathname: string): boolean {
    return GATEWAY_PROBE_STATUS_BY_PATH.has(pathname);
}

/**
 * Handle a health probe request for native node:http servers.
 * Returns true if the request was handled (is a probe path), false otherwise.
 *
 * Pola: identik dengan CoreBlow handleGatewayProbeRequest() (server-http.ts L224-276).
 *
 * @example
 * ```typescript
 * import { handleHealthProbeRequest } from './health-probe-routes.js';
 *
 * const startTime = Date.now();
 * let isReady = false;
 *
 * // In createRequestHandler():
 * const pathname = getPathname(req);
 * if (handleHealthProbeRequest(req, res, pathname, {
 *   getReadiness: () => ({ ready: isReady, uptimeMs: Date.now() - startTime }),
 * })) return;
 * ```
 */
export function handleHealthProbeRequest(
    req: IncomingMessage,
    res: ServerResponse,
    pathname: string,
    opts?: {
        getReadiness?: ReadinessChecker;
        /**
         * Auth options untuk `canRevealReadinessDetails()`.
         * Jika tidak diset → external requests hanya dapat { ready: boolean }.
         */
        auth?: ReadinessDetailAuthOptions;
    },
): boolean {
    const status = GATEWAY_PROBE_STATUS_BY_PATH.get(pathname);
    if (!status) return false;

    const method = (req.method ?? 'GET').toUpperCase();

    // Only GET and HEAD are valid for probe endpoints (pola CoreBlow L238-245)
    if (method !== 'GET' && method !== 'HEAD') {
        res.statusCode = 405;
        res.setHeader('Allow', 'GET, HEAD');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('Method Not Allowed');
        return true;
    }

    // Cache-Control: no-store agar probe tidak di-cache oleh CDN/proxy
    // (pola CoreBlow server-http.ts line 248)
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    let statusCode: number;
    let body: string;

    if (status === 'ready' && opts?.getReadiness) {
        // Pola CoreBlow L252-268: resolve canRevealReadinessDetails DULU,
        // baru panggil getReadiness(). Detail hanya dikembalikan jika diizinkan.
        const includeDetails = canRevealReadinessDetails(req, opts.auth ?? {});

        let result: ReturnType<ReadinessChecker>;
        try {
            result = opts.getReadiness();
        } catch {
            // Internal error → treat as not ready
            res.statusCode = 503;
            const body = includeDetails
                ? JSON.stringify({ ready: false, failing: ['internal'], uptimeMs: 0 })
                : JSON.stringify({ ready: false });
            res.end(method === 'HEAD' ? undefined : body);
            return true;
        }

        statusCode = result.ready ? 200 : 503;
        // Pola CoreBlow L262: `includeDetails ? result : { ready: result.ready }`
        body = JSON.stringify(includeDetails ? result : { ready: result.ready });
    } else {
        // Liveness: selalu 200 jika process bisa handle request
        // Format identik OC: { ok: true, status: "live" }
        statusCode = 200;
        body = JSON.stringify({ ok: true, status });
    }

    res.statusCode = statusCode;
    res.end(method === 'HEAD' ? undefined : body);
    return true;
}

// ─── Express adapter (optional) ──────────────────────────────────────────────

/**
 * Mount health probe routes pada Express Application.
 * Gunakan ini jika gateway menggunakan Express, bukan raw node:http.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { mountHealthProbes } from './health-probe-routes.js';
 *
 * const app = express();
 * const startTime = Date.now();
 * let isReady = false;
 *
 * // Mount PERTAMA sebelum auth middleware
 * mountHealthProbes(app, {
 *   getReadiness: () => ({ ready: isReady, uptimeMs: Date.now() - startTime }),
 * });
 * ```
 */
export function mountHealthProbes(
    app: { get: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => void },
    opts?: { getReadiness?: ReadinessChecker },
): void {
    GATEWAY_PROBE_STATUS_BY_PATH.forEach((_status, probePath) => {
        app.get(probePath, (req: IncomingMessage, res: ServerResponse) => {
            handleHealthProbeRequest(req, res, probePath, opts);
        });
    });
}

/**
 * List of probe paths registered by mountHealthProbes() / handleHealthProbeRequest().
 * Useful for logging which paths are mounted.
 */
export const HEALTH_PROBE_PATHS = Array.from(GATEWAY_PROBE_STATUS_BY_PATH.keys());
