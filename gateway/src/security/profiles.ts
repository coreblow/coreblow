/**
 * src/security/profiles.ts
 * Per-agent tool access profiles
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('profiles');

export type ToolProfile = 'minimal' | 'coding' | 'messaging' | 'full';

/**
 * Tool groups for profile-based access control
 */
const TOOL_GROUPS: Record<string, string[]> = {
    'group:fs': ['exec'],
    'group:runtime': ['exec', 'process'],
    'group:sessions': ['cron'],
    'group:messaging': ['message'],
    'group:browser': ['browser', 'web_fetch', 'web_search'],
    'group:scrape': ['scrape'],
};

/**
 * Built-in profiles
 */
const PROFILES: Record<ToolProfile, { include: string[]; description: string }> = {
    minimal: {
        include: ['web_fetch'],
        description: 'Minimal tools — web fetch only',
    },
    coding: {
        include: ['group:fs', 'group:runtime', 'group:browser', 'image', 'web_search', 'web_fetch'],
        description: 'Coding tools — exec, process, browser, search',
    },
    messaging: {
        include: ['group:messaging', 'cron', 'web_fetch'],
        description: 'Messaging tools — cross-channel messaging, cron',
    },
    full: {
        include: [], // Empty = no restriction
        description: 'Full access — all tools enabled',
    },
};

/**
 * Resolve which tools are allowed for a given profile + overrides
 */
export function resolveAllowedTools(
    profile: ToolProfile,
    allow: string[] = [],
    deny: string[] = []
): Set<string> | null {
    const profileDef = PROFILES[profile];
    if (!profileDef) {
        log.warn({ profile }, 'Unknown profile, defaulting to full');
        return null; // null = no restrictions
    }

    // Full profile = no restrictions
    if (profile === 'full' && deny.length === 0) {
        return null;
    }

    // Resolve groups to individual tools
    const allowed = new Set<string>();

    for (const entry of profileDef.include) {
        if (entry.startsWith('group:')) {
            const groupTools = TOOL_GROUPS[entry];
            if (groupTools) {
                for (const tool of groupTools) allowed.add(tool);
            }
        } else {
            allowed.add(entry);
        }
    }

    // Add explicit allows
    for (const entry of allow) {
        if (entry.startsWith('group:')) {
            const groupTools = TOOL_GROUPS[entry];
            if (groupTools) {
                for (const tool of groupTools) allowed.add(tool);
            }
        } else {
            allowed.add(entry);
        }
    }

    // Remove explicit denies
    for (const entry of deny) {
        allowed.delete(entry);
    }

    return allowed;
}

/**
 * Check if a tool is allowed for a given profile
 */
export function isToolAllowed(
    toolName: string,
    profile: ToolProfile,
    allow: string[] = [],
    deny: string[] = []
): boolean {
    const allowedSet = resolveAllowedTools(profile, allow, deny);
    if (allowedSet === null) return true; // no restrictions
    return allowedSet.has(toolName);
}

export function getProfileDescription(profile: ToolProfile): string {
    return PROFILES[profile]?.description || 'Unknown profile';
}

export function listProfiles(): { name: ToolProfile; description: string }[] {
    return Object.entries(PROFILES).map(([name, def]) => ({
        name: name as ToolProfile,
        description: def.description,
    }));
}
