/** PI auth credential management. */
export interface PiCredential { provider: string; token: string; expiresAt?: number; }
export function isCredentialValid(cred: PiCredential): boolean { return !!cred.token && (cred.expiresAt === undefined || cred.expiresAt > Date.now()); }
export function createCredential(provider: string, token: string, expiresAt?: number): PiCredential { return { provider, token, expiresAt }; }
