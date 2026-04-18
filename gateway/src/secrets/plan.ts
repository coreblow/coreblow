/**
 * secrets/plan.ts
 * Resolution plan builder — collects SecretRefs from config tree.
 * Ported from CoreBlow src/secrets/plan.ts.
 */

import type { SecretRef, SecretRefSource } from './types.js';
import { isNonEmptyString, isRecord } from './shared.js';
import { parseSecretRefString, isValidRefId } from './ref-contract.js';

/** Sentinel prefix for secret references in config values. */
const SECRET_REF_PREFIX = 'secret:';

/**
 * Scan a config tree for secret references.
 * Secret refs in config are strings like: `secret:env:default:OPENAI_API_KEY`
 */
export function collectSecretRefs(config: Record<string, unknown>): SecretRef[] {
    const refs: SecretRef[] = [];
    const seen = new Set<string>();

    function walk(obj: unknown, path: string[]) {
        if (typeof obj === 'string' && obj.startsWith(SECRET_REF_PREFIX)) {
            const refStr = obj.slice(SECRET_REF_PREFIX.length);
            const ref = parseSecretRefString(refStr);
            if (ref && isValidRefId(ref.id, ref.source)) {
                const key = `${ref.source}:${ref.provider}:${ref.id}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    refs.push(ref);
                }
            }
        } else if (isRecord(obj)) {
            for (const [key, value] of Object.entries(obj)) {
                walk(value, [...path, key]);
            }
        } else if (Array.isArray(obj)) {
            obj.forEach((item, i) => walk(item, [...path, String(i)]));
        }
    }

    walk(config, []);
    return refs;
}

/**
 * Group refs by provider for batch resolution.
 */
export function groupRefsByProvider(refs: SecretRef[]): Map<string, SecretRef[]> {
    const groups = new Map<string, SecretRef[]>();
    for (const ref of refs) {
        const key = `${ref.source}:${ref.provider}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(ref);
    }
    return groups;
}

/**
 * Build a resolution plan summary for logging/audit.
 */
export function buildResolutionPlanSummary(refs: SecretRef[]): {
    totalRefs: number;
    providers: Array<{ source: SecretRefSource; provider: string; refCount: number }>;
} {
    const groups = groupRefsByProvider(refs);
    const providers: Array<{ source: SecretRefSource; provider: string; refCount: number }> = [];
    for (const [key, groupRefs] of groups) {
        const [source, provider] = key.split(':');
        providers.push({ source: source as SecretRefSource, provider, refCount: groupRefs.length });
    }
    return { totalRefs: refs.length, providers };
}
