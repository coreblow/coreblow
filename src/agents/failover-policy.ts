/**
 * agents/failover-policy.ts
 *
 * Model failover cooldown policy — 3 pure policy functions (port from OC).
 * CooldownRegistry telah digantikan oleh ProviderProfileStore (file-backed).
 *
 * Port CoreBlow coreblow/src/agents/failover-policy.ts:
 *   - shouldAllowCooldownProbeForReason()
 *   - shouldUseTransientCooldownProbeSlot()
 *   - shouldPreserveTransientCooldownProbeSlot()
 *
 * Re-exports dari failover-error.ts untuk backward compat:
 *   - FailoverError, FailoverReason, isFailoverError, isTimeoutError,
 *     coerceToFailoverError, resolveFailoverReasonFromError
 */

// ─── Re-exports from failover-error.ts (backward compat) ─────────────────────
export type { FailoverReason } from './failover-error.js';
export {
    FailoverError,
    isFailoverError,
    isTimeoutError,
    resolveFailoverStatus,
    resolveFailoverReasonFromError,
    coerceToFailoverError,
    describeFailoverError,
} from './failover-error.js';

import type { FailoverReason } from './failover-error.js';

// ─── CoreBlow Pure Policy Functions ──────────────────────────────────────────
// Port identik dari coreblow/src/agents/failover-policy.ts

/**
 * Should a cooldown probe attempt be allowed for a given failure reason?
 *
 * Transient errors (rate_limit, overloaded, billing, unknown) allow probing
 * to check if the provider has recovered. Permanent errors (auth, format,
 * model_not_found, session_expired, timeout) do not.
 *
 * @see coreblow/src/agents/failover-policy.ts
 */
export function shouldAllowCooldownProbeForReason(
    reason: FailoverReason | null | undefined,
): boolean {
    return (
        reason === 'rate_limit' ||
        reason === 'overloaded' ||
        reason === 'billing' ||
        reason === 'unknown'
    );
}

/**
 * Should a transient cooldown probe slot be used (not a permanent slot)?
 *
 * rate_limit, overloaded, and unknown are truly transient — probe with a
 * disposable slot so a failed probe doesn't consume a permanent retry.
 * billing is excluded because it may require account action, not just wait.
 *
 * @see coreblow/src/agents/failover-policy.ts
 */
export function shouldUseTransientCooldownProbeSlot(
    reason: FailoverReason | null | undefined,
): boolean {
    return reason === 'rate_limit' || reason === 'overloaded' || reason === 'unknown';
}

/**
 * Should the transient cooldown probe slot be preserved (not consumed)?
 *
 * Permanent errors (model_not_found, format, auth, auth_permanent,
 * session_expired) indicate the candidate will never recover — preserve
 * the probe slot to avoid wasting capacity on hopeless retries.
 *
 * @see coreblow/src/agents/failover-policy.ts
 */
export function shouldPreserveTransientCooldownProbeSlot(
    reason: FailoverReason | null | undefined,
): boolean {
    return (
        reason === 'model_not_found' ||
        reason === 'format' ||
        reason === 'auth' ||
        reason === 'auth_permanent' ||
        reason === 'session_expired'
    );
}

// ─── Helper: build profileId ──────────────────────────────────────────────────

/**
 * Build profileId untuk ProviderProfileStore dari provider + model.
 * Format: "provider:model" (e.g. "openai:gpt-4", "anthropic:claude-3")
 */
export function buildProviderProfileId(provider: string, model: string): string {
    return `${provider}:${model}`;
}

/**
 * Simplified probe check — alias untuk backward compat.
 * Prefer shouldAllowCooldownProbeForReason() untuk new code.
 */
export function shouldAllowCooldownProbe(reason: FailoverReason): boolean {
    return shouldAllowCooldownProbeForReason(reason);
}
