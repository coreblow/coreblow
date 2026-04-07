/**
 * CoreBlow — Auth Profile Display (CoreBlow Parity)
 */

import type { AuthProfileCredential } from './types.js';

export function formatCredentialType(credential: AuthProfileCredential): string {
    switch (credential.type) {
        case 'api_key': return 'API Key';
        case 'token': return 'Token';
        case 'oauth': return 'OAuth';
        default: return 'Unknown';
    }
}

export function maskCredentialValue(credential: AuthProfileCredential): string {
    if (credential.type === 'api_key' && credential.key) {
        return credential.key.length > 8
            ? `${credential.key.slice(0, 4)}...${credential.key.slice(-4)}`
            : '****';
    }
    if (credential.type === 'token' && credential.token) {
        return credential.token.length > 8
            ? `${credential.token.slice(0, 4)}...${credential.token.slice(-4)}`
            : '****';
    }
    if (credential.type === 'oauth') {
        return credential.access ? `oauth:${credential.access.slice(0, 8)}...` : 'oauth:none';
    }
    return '****';
}
