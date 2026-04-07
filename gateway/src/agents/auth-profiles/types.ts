/**
 * CoreBlow — Auth Profiles Types (CoreBlow Parity)
 * 
 * Type definitions for the auth profile system.
 * Supports 3 credential types: api_key, token, oauth
 */

export type OAuthProvider = string;

export type OAuthCredentials = {
    access: string;
    refresh: string;
    expires: number;
    provider?: OAuthProvider;
    email?: string;
    enterpriseUrl?: string;
    projectId?: string;
    accountId?: string;
};

export type ApiKeyCredential = {
    type: 'api_key';
    provider: string;
    key?: string;
    keyRef?: SecretRef;
    email?: string;
    displayName?: string;
    metadata?: Record<string, string>;
};

export type TokenCredential = {
    type: 'token';
    provider: string;
    token?: string;
    tokenRef?: SecretRef;
    expires?: number;
    email?: string;
    displayName?: string;
};

export type OAuthCredential = OAuthCredentials & {
    type: 'oauth';
    provider: string;
    clientId?: string;
    email?: string;
    displayName?: string;
};

export type AuthProfileCredential = ApiKeyCredential | TokenCredential | OAuthCredential;

export type AuthProfileFailureReason =
    | 'auth'
    | 'auth_permanent'
    | 'format'
    | 'overloaded'
    | 'rate_limit'
    | 'billing'
    | 'timeout'
    | 'model_not_found'
    | 'session_expired'
    | 'unknown';

/** Per-profile usage statistics for round-robin and cooldown tracking */
export type ProfileUsageStats = {
    lastUsed?: number;
    cooldownUntil?: number;
    cooldownReason?: AuthProfileFailureReason;
    cooldownModel?: string;
    disabledUntil?: number;
    disabledReason?: AuthProfileFailureReason;
    errorCount?: number;
    failureCounts?: Partial<Record<AuthProfileFailureReason, number>>;
    lastFailureAt?: number;
};

export type AuthProfileStore = {
    version: number;
    profiles: Record<string, AuthProfileCredential>;
    order?: Record<string, string[]>;
    lastGood?: Record<string, string>;
    usageStats?: Record<string, ProfileUsageStats>;
};

export type AuthProfileIdRepairResult = {
    changes: string[];
    migrated: boolean;
    fromProfileId?: string;
    toProfileId?: string;
};

/** Secret reference — pointer to a secret stored externally */
export type SecretRef = {
    source: 'env' | 'file' | 'keychain' | 'vault';
    key: string;
};
