/**
 * src/skills/registry.ts
 * CoreBlow Skill Registry
 *
 * Manages the registration, discovery, and retrieval of dynamic skills.
 */

import { discoverSkills } from './loader.js';
import type { SkillEntry } from './types.js';

export class SkillRegistry {
    private skills = new Map<string, SkillEntry>();

    /**
     * Discover and register skills from a directory.
     * Overwrites any existing skill with the same ID.
     */
    async discover(
        searchDir: string,
        source: 'bundled' | 'workspace' | 'remote' = 'workspace'
    ): Promise<number> {
        const discovered = discoverSkills(searchDir, source);
        for (const entry of discovered) {
            this.register(entry);
        }
        return discovered.length;
    }

    /**
     * Register a skill manually.
     */
    register(entry: SkillEntry): void {
        this.skills.set(entry.id, entry);
    }

    /**
     * Unregister a skill by ID.
     */
    unregister(id: string): boolean {
        return this.skills.delete(id);
    }

    /**
     * Get a specific skill by ID.
     */
    getById(id: string): SkillEntry | undefined {
        return this.skills.get(id);
    }

    /**
     * List all registered skills.
     */
    list(): SkillEntry[] {
        return Array.from(this.skills.values());
    }

    /**
     * Get all skills matching a specific source.
     */
    getBySource(source: 'bundled' | 'workspace' | 'remote'): SkillEntry[] {
        return this.list().filter(skill => skill.source === source);
    }

    /**
     * Clear all registered skills.
     */
    clear(): void {
        this.skills.clear();
    }
}

let defaultRegistry: SkillRegistry | null = null;
export function getSkillRegistry(): SkillRegistry {
    if (!defaultRegistry) defaultRegistry = new SkillRegistry();
    return defaultRegistry;
}
