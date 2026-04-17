/**
 * src/skills/status.ts
 *
 * Skill status report builder. Generates a comprehensive snapshot
 * of all available skills in the workspace.
 */

import { getSkillRegistry } from './registry.js';
import type { SkillEntry } from './types.js';

export interface SkillStatusEntry {
    id: string;
    name: string;
    description: string;
    source: 'bundled' | 'workspace' | 'remote';
    events: string[];
    loadable: boolean;
    missingRequirements?: string[];
    filePath: string;
}

export interface SkillStatusReport {
    total: number;
    bundled: number;
    workspace: number;
    remote: number;
    loadable: number;
    skills: SkillStatusEntry[];
}

export function hasBinary(bin: string): boolean {
    try {
        const { execSync } = require('node:child_process');
        execSync(`which ${bin}`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

export function buildSkillStatusReport(): SkillStatusReport {
    const registry = getSkillRegistry();
    const skills = registry.list();
    const entries: SkillStatusEntry[] = [];

    let bundled = 0;
    let workspace = 0;
    let remote = 0;
    let loadableCount = 0;

    for (const skill of skills) {
        if (skill.source === 'bundled') bundled++;
        else if (skill.source === 'workspace') workspace++;
        else if (skill.source === 'remote') remote++;

        const missingRequirements: string[] = [];
        let loadable = true;

        if (skill.metadata.os && skill.metadata.os.length > 0) {
            if (!skill.metadata.os.includes(process.platform)) {
                missingRequirements.push(`OS mismatch (requires ${skill.metadata.os.join(', ')})`);
                loadable = false;
            }
        }

        if (skill.metadata.requires) {
            for (const req of skill.metadata.requires) {
                if (!hasBinary(req)) {
                    missingRequirements.push(`Missing binary: ${req}`);
                    loadable = false;
                }
            }
        }

        if (loadable) {
            loadableCount++;
        }

        entries.push({
            id: skill.id,
            name: skill.metadata.name || skill.id,
            description: skill.metadata.description || '',
            source: skill.source,
            events: skill.metadata.events || [],
            loadable,
            missingRequirements: missingRequirements.length > 0 ? missingRequirements : undefined,
            filePath: skill.markdownPath
        });
    }

    return {
        total: skills.length,
        bundled,
        workspace,
        remote,
        loadable: loadableCount,
        skills: entries
    };
}
