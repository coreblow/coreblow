/**
 * CoreBlow Identity & Avatar Configuration
 *
 * Manages bot identity (name, avatar, bio) with per-channel overrides,
 * avatar validation (URL, data URI, file path), and identity profiles.
 */

import { createChildLogger } from '../utils/logger.js';
import * as path from 'node:path';

const log = createChildLogger('config:identity');

export interface BotIdentity {
    name: string;
    displayName?: string;
    avatar?: AvatarConfig;
    bio?: string;
    statusMessage?: string;
    language?: string;
    timezone?: string;
}

export interface AvatarConfig {
    type: 'url' | 'data-uri' | 'file' | 'none';
    value: string;
    fallback?: string;
}

export interface IdentityProfile {
    id: string;
    identity: BotIdentity;
    channels?: string[];
    description?: string;
}

export interface AvatarValidationResult {
    valid: boolean;
    type: AvatarConfig['type'];
    errors: string[];
    warnings: string[];
}

const profiles = new Map<string, IdentityProfile>();
let defaultProfileId = 'default';

export function registerProfile(profile: IdentityProfile): void {
    profiles.set(profile.id, profile);
}

export function getProfile(id: string): IdentityProfile | undefined {
    return profiles.get(id);
}

export function setDefaultProfile(id: string): void { defaultProfileId = id; }

export function getDefaultProfile(): IdentityProfile | undefined {
    return profiles.get(defaultProfileId);
}

export function listProfiles(): IdentityProfile[] {
    return Array.from(profiles.values());
}

export function clearProfiles(): void { profiles.clear(); }

export function resolveIdentity(channelId?: string): BotIdentity {
    if (channelId) {
        for (const profile of profiles.values()) {
            if (profile.channels?.includes(channelId)) return profile.identity;
        }
    }
    const def = profiles.get(defaultProfileId);
    return def?.identity ?? { name: 'CoreBlow', displayName: 'CoreBlow Assistant' };
}

export function parseAvatar(value: string | undefined): AvatarConfig {
    if (!value) return { type: 'none', value: '' };
    if (isHttpUrl(value)) return { type: 'url', value };
    if (isDataUri(value)) return { type: 'data-uri', value };
    return { type: 'file', value };
}

export function validateAvatar(avatar: AvatarConfig, rootDir?: string): AvatarValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    switch (avatar.type) {
        case 'url':
            if (!isHttpUrl(avatar.value)) errors.push('Invalid avatar URL');
            if (avatar.value.startsWith('http://')) warnings.push('HTTP instead of HTTPS');
            break;
        case 'data-uri':
            if (!isDataUri(avatar.value)) errors.push('Invalid data URI');
            if (avatar.value.length > 1_000_000) warnings.push('Data URI >1MB');
            break;
        case 'file':
            if (rootDir && !isPathWithinRoot(avatar.value, rootDir)) errors.push('Path outside root');
            if (path.isAbsolute(avatar.value)) warnings.push('Absolute path not portable');
            break;
    }
    return { valid: errors.length === 0, type: avatar.type, errors, warnings };
}

export function createIdentity(partial: Partial<BotIdentity>): BotIdentity {
    return {
        name: partial.name ?? 'CoreBlow',
        displayName: partial.displayName ?? partial.name,
        avatar: partial.avatar ? parseAvatar(partial.avatar.value) : undefined,
        bio: partial.bio,
        statusMessage: partial.statusMessage,
        language: partial.language ?? 'en',
        timezone: partial.timezone,
    };
}

export function isHttpUrl(v: string): boolean { return /^https?:\/\//.test(v); }
export function isDataUri(v: string): boolean { return /^data:image\/[a-zA-Z+]+;base64,/.test(v); }
export function isPathWithinRoot(fp: string, root: string): boolean {
    return path.resolve(root, fp).startsWith(path.resolve(root));
}
