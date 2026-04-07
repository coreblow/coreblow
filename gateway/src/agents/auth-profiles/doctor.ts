/**
 * CoreBlow — Auth Profile Doctor (CoreBlow Parity)
 *
 * Diagnostic tool to scan and report auth profile health.
 */

import { evaluateStoredCredentialEligibility } from './credential-state.js';
import { detectAuthProfileIssues } from './repair.js';
import { isProfileInCooldown, getRemainingCooldownMs } from './usage.js';
import type { AuthProfileStore } from './types.js';

export interface DiagnosticEntry {
    profileId: string;
    provider: string;
    type: string;
    eligible: boolean;
    reasonCode: string;
    inCooldown: boolean;
    cooldownRemainingMs: number;
    issues: string[];
}

export interface DiagnosticReport {
    totalProfiles: number;
    eligibleProfiles: number;
    inCooldownProfiles: number;
    providers: string[];
    entries: DiagnosticEntry[];
    globalIssues: string[];
}

export function diagnoseAuthProfiles(store: AuthProfileStore, now = Date.now()): DiagnosticReport {
    const globalIssues = detectAuthProfileIssues(store);
    const entries: DiagnosticEntry[] = [];

    for (const [profileId, credential] of Object.entries(store.profiles)) {
        const evaluation = evaluateStoredCredentialEligibility({ credential, now });
        const stats = store.usageStats?.[profileId];
        const issues: string[] = [];

        if (!evaluation.eligible) {
            issues.push(`Ineligible: ${evaluation.reasonCode}`);
        }
        if (isProfileInCooldown(profileId)) {
            issues.push(`In cooldown (${getRemainingCooldownMs(profileId)}ms remaining)`);
        }

        entries.push({
            profileId,
            provider: credential.provider,
            type: credential.type,
            eligible: evaluation.eligible,
            reasonCode: evaluation.reasonCode,
            inCooldown: isProfileInCooldown(profileId),
            cooldownRemainingMs: getRemainingCooldownMs(profileId),
            issues,
        });
    }

    const providers = [...new Set(entries.map(e => e.provider))].sort();

    return {
        totalProfiles: entries.length,
        eligibleProfiles: entries.filter(e => e.eligible).length,
        inCooldownProfiles: entries.filter(e => e.inCooldown).length,
        providers,
        entries,
        globalIssues,
    };
}
