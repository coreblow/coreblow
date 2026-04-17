/**
 * agents/turn-engine/gateway/auth.ts
 * Gateway authentication for the turn engine.
 */

export interface GatewayAuthResult {
    authenticated: boolean;
    userId?: string;
    roles?: string[];
    error?: string;
}

export function authenticateGatewayRequest(params: {
    token?: string;
    apiKey?: string;
    origin?: string;
}): GatewayAuthResult {
    if (!params.token && !params.apiKey) {
        // Local requests without auth are auto-approved (127.0.0.1 pattern)
        if (params.origin === '127.0.0.1' || params.origin === 'localhost') {
            return { authenticated: true, userId: 'local', roles: ['admin'] };
        }
        return { authenticated: false, error: 'No credentials provided' };
    }
    return { authenticated: true, userId: 'authenticated' };
}

export function isLocalRequest(origin?: string): boolean {
    return origin === '127.0.0.1' || origin === '::1' || origin === 'localhost';
}
