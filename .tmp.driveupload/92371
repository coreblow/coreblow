/**
 * CoreBlow Channel Framework — Directory & Contact Resolution
 *
 * Provides contact/group directory lookup, target resolution (raw input →
 * platform-specific ID), and directory entry types for dashboard display.
 *
 * Inspired by CoreBlow's DirectoryAdapter, ResolverAdapter, and
 * ChannelDirectoryEntry types.
 */

import type { ChannelId } from './adapter.js';

/** Kind of directory entry */
export type DirectoryEntryKind = 'user' | 'group' | 'channel';

/** A directory entry (contact, group, or channel) */
export interface DirectoryEntry {
    /** Platform-specific unique ID */
    id: string;
    /** Entry kind */
    kind: DirectoryEntryKind;
    /** Display name */
    name: string;
    /** Optional username/handle */
    username?: string;
    /** Avatar/icon URL */
    avatarUrl?: string;
    /** Whether this entity is online/active */
    online?: boolean;
    /** Member count (for groups/channels) */
    memberCount?: number;
    /** Extra platform-specific data */
    extra?: Record<string, unknown>;
}

/** Resolution result when looking up a raw target string */
export interface ResolveResult {
    /** Raw input that was resolved */
    input: string;
    /** Whether resolution succeeded */
    resolved: boolean;
    /** Resolved platform ID */
    id?: string;
    /** Resolved display name */
    name?: string;
    /** Resolution note (e.g. "matched by username") */
    note?: string;
}

/**
 * Directory provider interface — channels implement this for contact lookup.
 */
export interface DirectoryProvider {
    /** Get the bot/self identity */
    getSelf?(): Promise<DirectoryEntry | null>;
    /** List users/contacts */
    listPeers?(query?: string, limit?: number): Promise<DirectoryEntry[]>;
    /** List groups/channels */
    listGroups?(query?: string, limit?: number): Promise<DirectoryEntry[]>;
    /** List members of a specific group */
    listGroupMembers?(groupId: string, limit?: number): Promise<DirectoryEntry[]>;
    /** Resolve raw target strings to platform IDs */
    resolveTargets?(inputs: string[], kind: DirectoryEntryKind): Promise<ResolveResult[]>;
}

/** Registered directory providers per channel account */
const providers = new Map<string, DirectoryProvider>();

/**
 * Register a directory provider for a channel account.
 */
export function registerDirectoryProvider(
    channelId: ChannelId,
    accountId: string,
    provider: DirectoryProvider,
): void {
    providers.set(`${channelId}:${accountId}`, provider);
}

/**
 * Get the directory provider for a channel account.
 */
export function getDirectoryProvider(
    channelId: ChannelId,
    accountId: string,
): DirectoryProvider | null {
    return providers.get(`${channelId}:${accountId}`) ?? null;
}

/**
 * Resolve one or more targets on a channel.
 * Falls back to basic echo if no resolver is available.
 */
export async function resolveTargets(
    channelId: ChannelId,
    accountId: string,
    inputs: string[],
    kind: DirectoryEntryKind = 'user',
): Promise<ResolveResult[]> {
    const provider = getDirectoryProvider(channelId, accountId);

    if (provider?.resolveTargets) {
        return provider.resolveTargets(inputs, kind);
    }

    // Fallback: treat each input as already resolved
    return inputs.map((input) => ({
        input,
        resolved: true,
        id: input,
        note: 'passthrough (no resolver)',
    }));
}

/**
 * Search contacts across all connected channels.
 */
export async function searchContacts(
    query: string,
    opts?: { channels?: ChannelId[]; limit?: number },
): Promise<Array<DirectoryEntry & { channel: ChannelId; accountId: string }>> {
    const results: Array<DirectoryEntry & { channel: ChannelId; accountId: string }> = [];
    const limit = opts?.limit ?? 20;

    for (const [key, provider] of Array.from(providers)) {
        const [channelId, accountId] = key.split(':') as [ChannelId, string];

        if (opts?.channels && !opts.channels.includes(channelId)) continue;
        if (!provider.listPeers) continue;

        try {
            const peers = await provider.listPeers(query, limit);
            for (const peer of peers) {
                results.push({ ...peer, channel: channelId, accountId });
                if (results.length >= limit) return results;
            }
        } catch {
            // Provider error — skip silently
        }
    }

    return results;
}
