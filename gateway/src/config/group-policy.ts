/**
 * CoreBlow Group Policy Resolution
 *
 * Resolves group-level access policies for channels and providers.
 * Supports fallback chains, provider-missing detection, and per-channel overrides.
 *
 * Equivalent: CoreBlow config/group-policy.ts (118 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('config:group-policy');

// ─── Types ────────────────────────────────────────────────────────

export type GroupPolicy = 'open' | 'allowlist' | 'denylist' | 'closed';

export interface GroupPolicyResolution {
    /** Resolved policy */
    groupPolicy: GroupPolicy;
    /** Whether a fallback was applied because provider config is missing */
    providerMissingFallbackApplied: boolean;
    /** Source of the resolution */
    source: 'explicit' | 'default' | 'fallback' | 'provider-missing';
}

export interface GroupPolicyParams {
    /** Whether the provider has configuration present */
    providerConfigPresent: boolean;
    /** Explicitly set policy */
    groupPolicy?: GroupPolicy;
    /** Default policy when no explicit setting */
    defaultGroupPolicy?: GroupPolicy;
    /** Fallback when provider IS configured but no policy set */
    configuredFallbackPolicy?: GroupPolicy;
    /** Fallback when provider is NOT configured */
    missingProviderFallbackPolicy?: GroupPolicy;
}

export interface ChannelGroupPolicyParams extends GroupPolicyParams {
    channelId: string;
    /** Per-channel policy overrides */
    channelOverrides?: Record<string, GroupPolicy>;
}

// ─── Policy Resolution ───────────────────────────────────────────

/**
 * Resolve runtime group policy with fallback chain
 */
export function resolveGroupPolicy(params: GroupPolicyParams): GroupPolicyResolution {
    const configuredFallback = params.configuredFallbackPolicy ?? 'open';
    const missingProviderFallback = params.missingProviderFallbackPolicy ?? 'allowlist';

    // Explicit policy always wins
    if (params.groupPolicy) {
        return {
            groupPolicy: params.groupPolicy,
            providerMissingFallbackApplied: false,
            source: 'explicit',
        };
    }

    // Provider is configured → use default or configured fallback
    if (params.providerConfigPresent) {
        const policy = params.defaultGroupPolicy ?? configuredFallback;
        return {
            groupPolicy: policy,
            providerMissingFallbackApplied: false,
            source: params.defaultGroupPolicy ? 'default' : 'fallback',
        };
    }

    // Provider NOT configured → more restrictive fallback
    return {
        groupPolicy: missingProviderFallback,
        providerMissingFallbackApplied: true,
        source: 'provider-missing',
    };
}

/**
 * Resolve group policy for a specific channel (with per-channel overrides)
 */
export function resolveChannelGroupPolicy(params: ChannelGroupPolicyParams): GroupPolicyResolution {
    // Check for channel-specific override
    const channelOverride = params.channelOverrides?.[params.channelId];
    if (channelOverride) {
        return {
            groupPolicy: channelOverride,
            providerMissingFallbackApplied: false,
            source: 'explicit',
        };
    }

    // Fall back to standard resolution
    return resolveGroupPolicy(params);
}

// ─── Validation ───────────────────────────────────────────────────

const VALID_POLICIES: GroupPolicy[] = ['open', 'allowlist', 'denylist', 'closed'];

/**
 * Validate a group policy value
 */
export function isValidGroupPolicy(value: unknown): value is GroupPolicy {
    return typeof value === 'string' && VALID_POLICIES.includes(value as GroupPolicy);
}

/**
 * Get policy description
 */
export function describeGroupPolicy(policy: GroupPolicy): string {
    switch (policy) {
        case 'open': return 'All users can interact (no restrictions)';
        case 'allowlist': return 'Only explicitly allowed users can interact';
        case 'denylist': return 'All users except explicitly denied ones can interact';
        case 'closed': return 'No users can interact (gateway disabled for this scope)';
    }
}

/**
 * Compare policy restrictiveness (higher = more restrictive)
 */
export function policyRestrictiveness(policy: GroupPolicy): number {
    switch (policy) {
        case 'open': return 0;
        case 'denylist': return 1;
        case 'allowlist': return 2;
        case 'closed': return 3;
    }
}

/**
 * Get the more restrictive of two policies
 */
export function moreRestrictive(a: GroupPolicy, b: GroupPolicy): GroupPolicy {
    return policyRestrictiveness(a) >= policyRestrictiveness(b) ? a : b;
}

/**
 * Get the less restrictive of two policies
 */
export function lessRestrictive(a: GroupPolicy, b: GroupPolicy): GroupPolicy {
    return policyRestrictiveness(a) <= policyRestrictiveness(b) ? a : b;
}
