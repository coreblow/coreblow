/**
 * secrets/ref-contract.ts
 * Secret reference validation and provider alias resolution.
 * Ported from CoreBlow src/secrets/ref-contract.ts.
 */

import type { SecretRef, SecretRefSource } from './types.js';
import { isNonEmptyString } from './shared.js';

export const SINGLE_VALUE_FILE_REF_ID = '_value';

const VALID_REF_ID_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_.-]*$/;
const EXEC_REF_ID_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_.-]{0,255}$/;

/**
 * Unique cache key for a secret ref: `source:provider:id`
 */
export function secretRefKey(ref: SecretRef): string {
    return `${ref.source}:${ref.provider}:${ref.id}`;
}

/**
 * Validate a ref ID for exec providers (stricter than env/file).
 */
export function isValidExecSecretRefId(id: string): boolean {
    return EXEC_REF_ID_PATTERN.test(id);
}

/**
 * Format a validation error message for exec ref IDs.
 */
export function formatExecSecretRefIdValidationMessage(id: string): string {
    return `Invalid exec secret ref ID "${id}". Must match ${EXEC_REF_ID_PATTERN.source} (max 256 chars).`;
}

/**
 * Validate a ref ID for any source.
 */
export function isValidRefId(id: string, source: SecretRefSource): boolean {
    if (!isNonEmptyString(id)) return false;
    if (source === 'exec') return isValidExecSecretRefId(id);
    if (source === 'file') return id === SINGLE_VALUE_FILE_REF_ID || VALID_REF_ID_PATTERN.test(id);
    return VALID_REF_ID_PATTERN.test(id);
}

/**
 * Resolve the default provider alias for a given source type.
 * CoreBlow pattern: if no provider config exists, fall back to source-specific defaults.
 */
export function resolveDefaultSecretProviderAlias(
    config: Record<string, unknown>,
    source: SecretRefSource,
): string {
    const secrets = config.secrets as Record<string, unknown> | undefined;
    const defaults = secrets?.defaults as Record<string, string> | undefined;
    return defaults?.[source] ?? source;
}

/**
 * Parse a secret reference string: `source:provider:id`
 */
export function parseSecretRefString(refStr: string): SecretRef | null {
    const parts = refStr.split(':');
    if (parts.length !== 3) return null;
    const [source, provider, id] = parts;
    if (!['env', 'file', 'exec'].includes(source)) return null;
    if (!isNonEmptyString(provider) || !isNonEmptyString(id)) return null;
    return { source: source as SecretRefSource, provider, id };
}

/**
 * Format a secret ref as a displayable string.
 */
export function formatSecretRef(ref: SecretRef): string {
    return `${ref.source}:${ref.provider}:${ref.id}`;
}
