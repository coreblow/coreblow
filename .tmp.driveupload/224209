/**
 * src/security/tool-profiles.ts
 *
 * Layer 4: Tool Profiles + Access Profiles — CoreBlow Pattern
 *
 * Two-tier access control:
 * 1. ToolProfile (minimal/coding/messaging/full) — restricts which tools an agent can use
 * 2. AccessProfile (full/read-only/no-exec) — restricts agent capabilities
 *
 * Supports per-provider profile overrides following CoreBlow's `byProvider` config.
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('security:tool-profiles');

// ─── Tool Profiles (CoreBlow Pattern) ───────────────────────────

export type ToolProfile = 'minimal' | 'coding' | 'messaging' | 'full';

/**
 * Built-in tool profiles following CoreBlow's exact definitions.
 *
 * - `minimal`   → session_status only
 * - `coding`    → filesystem, runtime, sessions, memory, image
 * - `messaging` → messaging, session management
 * - `full`      → no restriction (empty array = allow all)
 */
const TOOL_PROFILES: Record<ToolProfile, string[]> = {
    minimal: ['session_status'],
    coding: [
        'group:fs', 'group:runtime', 'group:sessions', 'group:memory',
        'image', 'exec', 'process', 'apply_patch', 'web_search', 'web_fetch',
        'browser', 'canvas',
    ],
    messaging: [
        'group:messaging', 'sessions_list', 'sessions_history',
        'sessions_send', 'session_status', 'message',
    ],
    full: [], // Empty = no restriction
};

/**
 * Tool group expansions — resolves `group:xxx` to concrete tool names.
 */
const TOOL_GROUPS: Record<string, string[]> = {
    'group:fs': ['exec', 'apply_patch', 'process'],
    'group:runtime': ['exec', 'process', 'browser', 'canvas'],
    'group:sessions': ['sessions_list', 'sessions_history', 'sessions_send', 'session_status'],
    'group:memory': ['memory_search', 'memory_store'],
    'group:messaging': ['message', 'sessions_send'],
};

// ─── Access Profiles (CoreBlow Pattern) ─────────────────────────

export type AccessProfile = 'full' | 'read-only' | 'no-exec';

export interface ProfileRules {
    canExec: boolean;
    canWriteFiles: boolean;
    canAccessNetwork: boolean;
    canManageGateway: boolean;
    canMessageOtherChannels: boolean;
    allowedTools: string[] | 'all';
}

const ACCESS_PROFILES: Record<AccessProfile, ProfileRules> = {
    'full': {
        canExec: true,
        canWriteFiles: true,
        canAccessNetwork: true,
        canManageGateway: true,
        canMessageOtherChannels: true,
        allowedTools: 'all',
    },
    'read-only': {
        canExec: false,
        canWriteFiles: false,
        canAccessNetwork: true,
        canManageGateway: false,
        canMessageOtherChannels: false,
        allowedTools: ['web_search', 'web_fetch', 'image', 'session_status'],
    },
    'no-exec': {
        canExec: false,
        canWriteFiles: true,
        canAccessNetwork: true,
        canManageGateway: false,
        canMessageOtherChannels: true,
        allowedTools: 'all', // All except exec/process
    },
};

// ─── Tool Profile Config (with byProvider) ──────────────────────

export interface ToolProfileConfig {
    /** Default profile for all agents */
    profile: ToolProfile;
    /** Additional tools to allow beyond the profile */
    allow?: string[];
    /** Specific tools to deny */
    deny?: string[];
    /** Per-provider profile overrides (CoreBlow pattern) */
    byProvider?: Record<string, { profile: ToolProfile }>;
}

// ─── AccessControl (CoreBlow Pattern) ───────────────────────────

/**
 * Access Control following CoreBlow's dual-profile system.
 *
 * ```typescript
 * const ac = new AccessControl();
 * ac.canUseTool('read-only', 'exec');    // false
 * ac.canUseTool('full', 'exec');         // true
 * ac.canUseTool('no-exec', 'exec');      // false
 * ac.canUseTool('no-exec', 'web_search'); // true
 *
 * ac.isToolAllowed('coding', 'exec');     // true (in coding profile)
 * ac.isToolAllowed('minimal', 'exec');    // false
 * ```
 */
export class AccessControl {
    private readonly config: ToolProfileConfig;

    constructor(config?: Partial<ToolProfileConfig>) {
        this.config = {
            profile: config?.profile ?? 'full',
            allow: config?.allow,
            deny: config?.deny,
            byProvider: config?.byProvider,
        };
    }

    /**
     * Check if an AccessProfile allows a specific tool.
     * CoreBlow 1:1 interface.
     */
    canUseTool(profile: AccessProfile, toolName: string): boolean {
        const rules = this.getProfile(profile);

        if (rules.allowedTools === 'all') {
            // 'no-exec' blocks exec even with 'all' (CoreBlow pattern)
            if (!rules.canExec && ['exec', 'process'].includes(toolName)) return false;
            return true;
        }

        return rules.allowedTools.includes(toolName);
    }

    /**
     * Check if a ToolProfile allows a specific tool.
     * Takes into account allow/deny overrides and byProvider.
     */
    isToolAllowed(toolName: string, provider?: string): boolean {
        // Determine effective profile
        let effectiveProfile = this.config.profile;
        if (provider && this.config.byProvider?.[provider]) {
            effectiveProfile = this.config.byProvider[provider].profile;
        }

        const profileTools = TOOL_PROFILES[effectiveProfile];

        // 'full' profile → no restriction (empty array)
        if (profileTools.length === 0) {
            // Check deny list
            if (this.config.deny?.includes(toolName)) {
                log.debug({ toolName, profile: effectiveProfile }, 'Tool denied by deny list');
                return false;
            }
            return true;
        }

        // Expand groups in profile
        const expandedTools = this.expandGroups(profileTools);

        // Check if tool is in the expanded profile OR in allow list
        const inProfile = expandedTools.includes(toolName);
        const inAllow = this.config.allow?.includes(toolName) ?? false;
        const inDeny = this.config.deny?.includes(toolName) ?? false;

        // Deny always wins
        if (inDeny) return false;

        return inProfile || inAllow;
    }

    /**
     * Get the ProfileRules for an AccessProfile.
     */
    getProfile(name: AccessProfile): ProfileRules {
        return ACCESS_PROFILES[name] || ACCESS_PROFILES['read-only'];
    }

    /**
     * Get the effective ToolProfile for a provider.
     */
    getEffectiveProfile(provider?: string): ToolProfile {
        if (provider && this.config.byProvider?.[provider]) {
            return this.config.byProvider[provider].profile;
        }
        return this.config.profile;
    }

    /**
     * Get all tool names allowed by a ToolProfile (expanded).
     */
    getAllowedTools(profile?: ToolProfile): string[] {
        const p = profile ?? this.config.profile;
        const profileTools = TOOL_PROFILES[p];
        if (profileTools.length === 0) return ['*']; // full = everything
        return this.expandGroups(profileTools);
    }

    // ─── Private ────────────────────────────────────────────────

    private expandGroups(tools: string[]): string[] {
        const expanded: string[] = [];
        for (const t of tools) {
            if (t.startsWith('group:') && TOOL_GROUPS[t]) {
                expanded.push(...TOOL_GROUPS[t]);
            } else {
                expanded.push(t);
            }
        }
        return [...new Set(expanded)]; // Deduplicate
    }
}
